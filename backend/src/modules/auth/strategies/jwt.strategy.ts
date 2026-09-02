import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // getOrThrow, not `get() || '<committed default>'`. A deployment missing
      // its secret must refuse to start, not accept tokens signed with a key
      // that is published in this repository.
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Runs on every authenticated request.
   *
   * The declared return type is the contract: Passport assigns whatever this
   * returns to `request.user`, and `@CurrentUser()` reads it back typed as
   * `AuthenticatedUser`. Annotating it here is what makes the compiler reject a
   * `select` that omits a field the interface promises — previously the two
   * were connected by nothing at all, and had already drifted (`isActive` was
   * selected but undeclared; `isVerified` was neither).
   *
   * The database lookup on every request is deliberate. A JWT is a bearer token
   * that stays valid until it expires, so without this an account that is
   * deactivated mid-session would keep working for the remainder of the access
   * token's lifetime.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
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
      throw new UnauthorizedException('User account not found or has been deactivated.');
    }

    return user;
  }
}
