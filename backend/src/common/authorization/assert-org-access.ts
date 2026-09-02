import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Organization, Role, VerificationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Shared ownership check for organisation-scoped resources.
 *
 * Every provider-facing service was repeating this inline as
 * `org.userId !== userId && userRole !== 'ADMIN'`, with two recurring problems:
 *
 *   1. The role was compared against the string literal `'ADMIN'` rather than
 *      the `Role` enum, so a typo would silently never match and quietly deny
 *      admins instead of failing to compile.
 *   2. Several call sites omitted the check entirely — scheme updates, ambulance
 *      request status changes — because there was nothing central to forget to
 *      call.
 *
 * Centralising it also gives one place to enforce the verified-before-publish
 * rule, which no call site implemented at all.
 */

/** The subset of an organisation this check needs. */
export type OrgAccessSubject = Pick<Organization, 'id' | 'userId' | 'verificationStatus'>;

export interface OrgAccessOptions {
  /**
   * Require the organisation to be APPROVED before allowing the write.
   *
   * Set this on anything that publishes information the public will act on —
   * bed counts, blood stock, medicine availability, ambulance status. Without
   * it, anyone can self-register an organisation and immediately publish
   * availability figures that appear in emergency search results, with no
   * administrator ever having reviewed them.
   *
   * Reads and profile edits do not need it; a pending organisation is allowed
   * to correct its own address while it waits.
   */
  requireApproved?: boolean;
  /** Noun used in error messages, e.g. "hospital". Defaults to "organization". */
  resourceName?: string;
}

/**
 * Throws unless `user` may act on `org`.
 *
 * Admins bypass ownership but NOT approval: an admin editing a pending
 * organisation's public availability would publish unreviewed data just as
 * surely as its owner would. Admins have their own verification endpoints for
 * changing approval state.
 *
 * Deliberately throws rather than returning a boolean — a helper that returns
 * `false` can be called and ignored, and an authorization check that is easy to
 * ignore eventually is.
 */
export function assertOrgAccess(
  org: OrgAccessSubject | null | undefined,
  user: Pick<AuthenticatedUser, 'id' | 'role'>,
  options: OrgAccessOptions = {},
): asserts org is OrgAccessSubject {
  const { requireApproved = false, resourceName = 'organization' } = options;

  if (!org) {
    throw new NotFoundException(`The requested ${resourceName} was not found.`);
  }

  const isOwner = org.userId === user.id;
  const isAdmin = user.role === Role.ADMIN;

  if (!isOwner && !isAdmin) {
    // Deliberately identical to the not-found message. Distinguishing "exists
    // but is not yours" from "does not exist" turns this endpoint into an
    // oracle for enumerating which organisation ids are real.
    throw new NotFoundException(`The requested ${resourceName} was not found.`);
  }

  if (requireApproved && org.verificationStatus !== VerificationStatus.APPROVED) {
    throw new ForbiddenException(
      `This ${resourceName} is ${org.verificationStatus.toLowerCase()} and cannot publish public information until an administrator approves it.`,
    );
  }
}

/**
 * True when the caller can see every record of a type regardless of ownership.
 *
 * ADMIN is the platform operator. AUTHORITY is the government oversight role,
 * whose entire purpose is reviewing grievances and provider conduct across
 * organisations — scoping it to "organisations it owns" would leave it seeing
 * nothing, since it owns none.
 *
 * Note this is about which *records* are visible, not which *fields*. Neither
 * role should receive citizen contact details where the endpoint does not need
 * them; that is decided by the `select` at each call site.
 */
export function hasPlatformWideRead(user: Pick<AuthenticatedUser, 'role'>): boolean {
  return user.role === Role.ADMIN || user.role === Role.AUTHORITY;
}
