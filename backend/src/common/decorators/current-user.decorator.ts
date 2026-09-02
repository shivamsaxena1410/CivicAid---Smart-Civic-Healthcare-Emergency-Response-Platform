import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * The authenticated principal attached to a request.
 *
 * This interface is one half of a contract whose other half is
 * `JwtStrategy.validate()` in `modules/auth/strategies/jwt.strategy.ts`. Passport
 * takes whatever that method returns and assigns it to `request.user`; this
 * decorator reads it back out. Nothing in TypeScript connects the two — the
 * Express `Request.user` slot is untyped — so the two halves can drift apart
 * silently, and they already had: `validate()` selected `isActive` while this
 * interface declared only four fields, and neither `isActive` nor `isVerified`
 * was visible to any consumer.
 *
 * That gap matters because authorization decisions are about to depend on these
 * flags. A missing field would not fail to compile; it would arrive as
 * `undefined` at runtime, and `undefined` is falsy, so a check like
 * `if (!user.isVerified) throw` would reject every user, while
 * `if (user.isVerified) allow` would admit none — or, worse, an inverted check
 * would admit everyone. `JwtStrategy` now declares its return type as this
 * interface, which makes the compiler enforce that its `select` produces
 * exactly these fields.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /**
   * Whether the account is enabled. `JwtStrategy` already rejects inactive
   * users at authentication time, so this is `true` for any request that gets
   * this far; it is surfaced for audit logging and for defence in depth.
   */
  isActive: boolean;
  /**
   * Whether the account's email/identity has been verified. Distinct from
   * organisation verification (`Organization.verificationStatus`), which is
   * what gates publishing availability data.
   */
  isVerified: boolean;
}

/**
 * Injects the authenticated user, or one property of it:
 *
 *   findAll(@CurrentUser() user: AuthenticatedUser)
 *   create(@CurrentUser('id') userId: string)
 *
 * Throws if no user is present. Previously this returned `undefined` in that
 * case, which meant a handler that forgot its guard received `undefined` and
 * carried on — typically resolving to an unscoped query. Failing loudly turns
 * that class of mistake into an immediate 500 instead of a silent data leak.
 * Public routes must not use this decorator; they have no user by definition.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser[keyof AuthenticatedUser] | AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new InternalServerErrorException(
        'No authenticated user on request. @CurrentUser() requires an authenticated route — check that the handler is not marked @Public().',
      );
    }

    return data ? user[data] : user;
  },
);
