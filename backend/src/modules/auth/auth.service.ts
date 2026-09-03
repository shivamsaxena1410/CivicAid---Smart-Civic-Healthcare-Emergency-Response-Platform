import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, SELF_REGISTERABLE_ROLES } from './dto/register.dto';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { Role } from '@prisma/client';

interface RefreshPayload {
  sub: string;
  email: string;
  role: string;
  /** Per-token unique id. See `generateTokens` for why this is required. */
  jti?: string;
  /** Standard JWT expiry claim, seconds since epoch. */
  exp: number;
  iat: number;
}

/**
 * Converts a JWT-style duration string ("15m", "7d") to seconds so the
 * `expiresIn` we advertise to clients always matches the token we actually
 * signed. The inherited code returned a hardcoded 900 regardless of
 * JWT_ACCESS_EXPIRATION, so changing the config silently made the API lie to
 * the frontend about when to refresh.
 */
export function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(duration.trim());
  if (!match) {
    // Fall back to 15 minutes rather than throwing: an odd-but-valid value like
    // "1h30m" should not take the whole API down.
    return 900;
  }
  const value = Number(match[1]);
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] ?? 's'] ?? 1;
  return value * multiplier;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    // Defence in depth. RegisterDto already rejects ADMIN/AUTHORITY via
    // @IsIn(SELF_REGISTERABLE_ROLES); this re-check means a future caller that
    // bypasses the pipe (a service-to-service call, a test, a refactor that
    // loosens the DTO) still cannot mint a privileged account.
    const requestedRole = dto.role ?? Role.CITIZEN;
    if (!SELF_REGISTERABLE_ROLES.includes(requestedRole)) {
      this.logger.warn(`Blocked attempt to self-register privileged role "${requestedRole}" for ${email}`);
      throw new BadRequestException(
        'This role cannot be self-assigned. Administrator and authority accounts are provisioned internally.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new ConflictException('An account with this email address already exists.');
    }

    // AGENTS.md mandates cost 12; the inherited code hardcoded 10.
    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 12;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name.trim(),
        phone: dto.phone?.trim(),
        role: requestedRole,
        isActive: true,
        // Citizens are usable immediately. Organizations stay unverified until
        // an ADMIN approves their KYC, which is what gates their ability to
        // publish availability data.
        isVerified: requestedRole === Role.CITIZEN,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    // The inherited register() issued a refresh token but never persisted it,
    // so the very first refresh after signup was unverifiable.
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    return {
      user,
      tokens,
      message: 'Account registered successfully.',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
            type: true,
            verificationStatus: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been disabled. Please contact support.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.persistRefreshToken(user.id, tokens.refreshToken);

    const { passwordHash: _passwordHash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
      message: 'Login successful.',
    };
  }

  /**
   * Exchanges a refresh token for a fresh token pair, with real rotation.
   *
   * The inherited implementation verified only the JWT signature and never
   * queried `refresh_tokens`, so `revoked`, `expiresAt` and `tokenHash` were
   * all dead columns: logout deleted rows nothing read, a stolen refresh token
   * stayed valid for its full 7 days, and there was no rotation at all.
   */
  async refreshTokens(dto: RefreshTokenDto) {
    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(dto.refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is expired or invalid.');
    }

    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    // Signature is valid but we never issued this token, or its record is gone.
    if (!stored) {
      throw new UnauthorizedException('Refresh session is no longer recognised. Please sign in again.');
    }

    // Reuse detection. A correctly-behaving client never presents a rotated
    // token twice, so a valid signature over an already-revoked record means
    // the token leaked. We cannot tell attacker from victim, so we end every
    // session for the account and force a fresh password login.
    if (stored.revoked) {
      this.logger.warn(
        `Refresh token reuse detected for user ${stored.userId}; revoking all sessions for that account.`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revoked: false },
        data: { revoked: true },
      });
      throw new UnauthorizedException('Refresh session is no longer valid. Please sign in again.');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
      throw new UnauthorizedException('Refresh token is expired or invalid.');
    }

    // A token whose record belongs to a different user than its own `sub` claim
    // should be impossible; treat it as tampering and burn the account's sessions.
    if (stored.userId !== payload.sub) {
      this.logger.error(`Refresh token subject mismatch: record user ${stored.userId} vs claim ${payload.sub}.`);
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revoked: false },
        data: { revoked: true },
      });
      throw new UnauthorizedException('Refresh session is no longer valid. Please sign in again.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isVerified: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh session.');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Rotate atomically: the presented token dies in the same transaction that
    // records its replacement, so a crash cannot leave two live tokens.
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } }),
      this.prisma.refreshToken.create({
        data: {
          tokenHash: this.hashRefreshToken(tokens.refreshToken),
          userId: user.id,
          expiresAt: this.refreshTokenExpiry(tokens.refreshToken),
        },
      }),
    ]);

    return { tokens, user };
  }

  /**
   * Ends every session for the user.
   *
   * Rows are marked `revoked` rather than deleted (the inherited behaviour) so
   * that a token presented after logout still matches a record and is caught by
   * reuse detection above, instead of looking like an unknown token.
   */
  async logout(userId: string) {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    return { message: 'Logged out successfully.', sessionsRevoked: count };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        organizations: {
          include: {
            hospitalDetail: true,
            ambulanceDetails: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found.');
    }

    return user;
  }

  /**
   * SHA-256, not bcrypt.
   *
   * The inherited code used `bcrypt.hash(refreshToken, 10)`, which is wrong on
   * two counts: bcrypt silently truncates its input at 72 bytes (a JWT is far
   * longer, so all tokens for a user could collide on their shared header and
   * payload prefix), and bcrypt's salt makes the digest unindexable, forcing an
   * O(n) scan-and-compare instead of a unique-key lookup. A refresh token is
   * already 256+ bits of unguessable entropy, so it needs no key stretching —
   * only a fast, deterministic, collision-resistant digest.
   */
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Derives `expiresAt` from the token's own `exp` claim so the two can never drift. */
  private refreshTokenExpiry(refreshToken: string): Date {
    const decoded = this.jwtService.decode(refreshToken) as RefreshPayload | null;
    if (decoded?.exp) {
      return new Date(decoded.exp * 1000);
    }
    const fallbackSeconds = parseDurationToSeconds(
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d',
    );
    return new Date(Date.now() + fallbackSeconds * 1000);
  }

  private async persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
    // Opportunistic cleanup so the table does not grow without bound; cheap
    // because it is indexed on userId and runs only on login/register.
    await this.prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashRefreshToken(refreshToken),
        userId,
        expiresAt: this.refreshTokenExpiry(refreshToken),
      },
    });
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    // getOrThrow, not `get() || '<committed default>'`. The previous fallbacks
    // meant anyone holding this repository could forge tokens against a
    // deployment whose environment was incomplete. validateEnv() now guarantees
    // both secrets exist, are >= 32 chars, differ, and are not the published
    // values, so reaching this line without them is impossible.
    const accessSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRATION') ?? '15m';
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';

    // Sign with the expiry expressed in seconds. @nestjs/jwt types `expiresIn`
    // as `number | ms.StringValue`, and a value read from config is a plain
    // `string` that TypeScript cannot narrow to that template-literal type;
    // seconds sidesteps the cast and matches the numeric `expiresIn` we return.
    const accessExpiresInSeconds = parseDurationToSeconds(accessExpiresIn);
    const refreshExpiresInSeconds = parseDurationToSeconds(refreshExpiresIn);

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresInSeconds,
      }),
      // `jti` is not decorative. Without it a refresh token's payload is just
      // {sub, email, role, iat, exp}, and `iat`/`exp` have one-second
      // resolution — so two tokens minted for the same user within the same
      // second are byte-identical. Rotation then "issued" the token it had just
      // revoked, and the insert collided with the unique index on `tokenHash`.
      // A random jti guarantees every issued token is distinct.
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: refreshSecret,
          expiresIn: refreshExpiresInSeconds,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresInSeconds,
    };
  }
}
