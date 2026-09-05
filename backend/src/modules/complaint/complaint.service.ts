import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateComplaintDto, ResolveComplaintDto } from './dto/complaint.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ComplaintStatus, Prisma, Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { hasPlatformWideRead } from '../../common/authorization/assert-org-access';

/**
 * Field sets for the citizen who filed a complaint.
 *
 * A complaint carries a person's name against a grievance about their own
 * medical care, so who sees which fields is a privacy decision, not a
 * convenience one.
 *
 * `CITIZEN_CONTACT` includes email and phone and is only for the people who may
 * need to contact the complainant: the complainant themselves, platform admins,
 * and the government oversight role. `CITIZEN_MINIMAL` is what a provider sees
 * about a grievance filed against it — enough to identify the case, not enough
 * to contact the person outside the platform.
 */
const CITIZEN_CONTACT = { id: true, name: true, email: true, phone: true } as const;
const CITIZEN_MINIMAL = { id: true, name: true } as const;

@Injectable()
export class ComplaintService {
  constructor(private prisma: PrismaService) {}

  /**
   * Ids of every organisation this user owns.
   *
   * Deliberately `findMany`, not `findFirst`. The previous code took only the
   * first organisation, so an operator running two facilities saw grievances
   * about one of them and silently none about the other — a correctness bug
   * that hid complaints from the party meant to act on them. The seed now
   * includes a two-organisation operator so this stays covered.
   */
  private async ownedOrgIds(userId: string): Promise<string[]> {
    const orgs = await this.prisma.organization.findMany({
      where: { userId },
      select: { id: true },
    });
    return orgs.map((o) => o.id);
  }

  /**
   * The visibility filter for a caller, or `null` if they may see everything.
   *
   * Written deny-by-default: any role not explicitly handled falls through to a
   * filter that matches nothing. The previous version used an if/else-if chain
   * that only covered CITIZEN and the three facility roles, so NGO, AMBULANCE
   * and AUTHORITY reached the query with an empty `where` and read every
   * complaint on the platform — including citizen email and phone.
   */
  private async visibilityFilter(user: AuthenticatedUser): Promise<Prisma.ComplaintWhereInput | null> {
    if (hasPlatformWideRead(user)) {
      return null;
    }

    if (user.role === Role.CITIZEN) {
      return { citizenId: user.id };
    }

    if (
      user.role === Role.HOSPITAL ||
      user.role === Role.PHARMACY ||
      user.role === Role.BLOOD_BANK ||
      user.role === Role.AMBULANCE ||
      user.role === Role.NGO
    ) {
      const orgIds = await this.ownedOrgIds(user.id);
      // `in: []` matches no rows, which is the correct result for a provider
      // account that owns no organisation yet.
      return { organizationId: { in: orgIds } };
    }

    // Unreachable today, but if a role is added to the enum without being
    // considered here, it sees nothing rather than everything.
    return { id: { in: [] } };
  }

  /** Whether this caller may see the complainant's contact details. */
  private canSeeCitizenContact(user: AuthenticatedUser, complaintCitizenId: string): boolean {
    return hasPlatformWideRead(user) || complaintCitizenId === user.id;
  }

  async create(citizenId: string, dto: CreateComplaintDto) {
    return this.prisma.complaint.create({
      data: {
        citizenId,
        organizationId: dto.organizationId,
        category: dto.category.trim(),
        description: dto.description.trim(),
        attachmentUrl: dto.attachmentUrl?.trim(),
        status: ComplaintStatus.PENDING,
      },
      include: {
        organization: { select: { id: true, name: true, type: true, city: true } },
      },
    });
  }

  async findAll(user: AuthenticatedUser, query: PaginationDto & { status?: ComplaintStatus }) {
    const { page = 1, limit = 20, status, search } = query;
    const skip = (page - 1) * limit;

    const scope = await this.visibilityFilter(user);

    const where: Prisma.ComplaintWhereInput = {
      ...scope,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { category: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    // A provider sees grievances filed against it, but not the complainant's
    // contact details; the platform and oversight roles see both.
    const citizenSelect = hasPlatformWideRead(user) || user.role === Role.CITIZEN ? CITIZEN_CONTACT : CITIZEN_MINIMAL;

    const [total, complaints] = await Promise.all([
      this.prisma.complaint.count({ where }),
      this.prisma.complaint.findMany({
        where,
        include: {
          citizen: { select: citizenSelect },
          organization: { select: { id: true, name: true, type: true, city: true } },
          resolvedBy: { select: CITIZEN_MINIMAL },
        },
        skip,
        take: limit,
        // Tie-break on id so pagination is stable when several complaints share
        // a createdAt — without it, rows can repeat or vanish between pages.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    return {
      data: complaints,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Fetches one complaint, scoped to what the caller may see.
   *
   * This method previously took only an id. Any authenticated user — including
   * any citizen — could read any complaint by guessing or observing its id, and
   * the response embedded the filing citizen's name, email and phone. That is a
   * direct IDOR against medical grievance records.
   *
   * The scope is applied inside the query rather than fetched-then-checked, so
   * an unauthorised id is indistinguishable from a nonexistent one.
   */
  async findOne(id: string, user: AuthenticatedUser) {
    const scope = await this.visibilityFilter(user);

    const complaint = await this.prisma.complaint.findFirst({
      where: { id, ...scope },
      include: {
        citizen: { select: CITIZEN_CONTACT },
        organization: { select: { id: true, name: true, type: true, city: true, address: true } },
        resolvedBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint record not found.');
    }

    // Row-level access does not imply field-level access: a provider may read a
    // grievance filed against it without receiving the complainant's contact
    // details.
    if (!this.canSeeCitizenContact(user, complaint.citizen.id)) {
      const { email: _email, phone: _phone, ...citizen } = complaint.citizen;
      return { ...complaint, citizen };
    }

    return complaint;
  }

  /**
   * Records a resolution. Reuses findOne, so the caller must already be able to
   * see the complaint — a provider cannot resolve a grievance filed against a
   * different organisation.
   */
  async resolve(id: string, user: AuthenticatedUser, dto: ResolveComplaintDto) {
    await this.findOne(id, user);

    return this.prisma.complaint.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionNotes: dto.resolutionNotes.trim(),
        resolvedById: user.id,
        resolvedAt: new Date(),
      },
      include: {
        citizen: { select: hasPlatformWideRead(user) ? CITIZEN_CONTACT : CITIZEN_MINIMAL },
        organization: { select: { id: true, name: true, type: true, city: true } },
      },
    });
  }
}
