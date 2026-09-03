import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateAmbulanceRequestDto,
  UpdateAmbulanceStatusDto,
  UpdateRequestStatusDto,
  AmbulanceSearchDto,
} from './dto/ambulance.dto';
import {
  AmbulanceStatus,
  AmbulanceRequestStatus,
  OrgType,
  Prisma,
  Role,
  VerificationStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertOrgAccess, hasPlatformWideRead } from '../../common/authorization/assert-org-access';
import { searchOrganizationsByProximity, toGeoQuery } from '../../common/geo/geo-search';

/**
 * Legal next states for a dispatch request.
 *
 * Without this, `updateRequestStatus` accepted any status from any status: a
 * COMPLETED run could be moved back to REQUESTED, and a CANCELLED one could be
 * silently resurrected. Both corrupt the dispatch record that respondedAt /
 * completedAt timestamps are derived from.
 *
 * COMPLETED and CANCELLED are terminal, so they map to empty arrays.
 */
const ALLOWED_TRANSITIONS: Record<AmbulanceRequestStatus, AmbulanceRequestStatus[]> = {
  [AmbulanceRequestStatus.REQUESTED]: [AmbulanceRequestStatus.ACCEPTED, AmbulanceRequestStatus.CANCELLED],
  [AmbulanceRequestStatus.ACCEPTED]: [AmbulanceRequestStatus.EN_ROUTE, AmbulanceRequestStatus.CANCELLED],
  [AmbulanceRequestStatus.EN_ROUTE]: [AmbulanceRequestStatus.COMPLETED, AmbulanceRequestStatus.CANCELLED],
  [AmbulanceRequestStatus.COMPLETED]: [],
  [AmbulanceRequestStatus.CANCELLED]: [],
};

/**
 * Statuses at which a responder has committed to the call and therefore needs
 * to be able to reach the patient. Before this point the request is just an
 * entry in a queue, and the patient's phone number is not the responder's to
 * have.
 */
const CONTACT_VISIBLE_STATUSES: AmbulanceRequestStatus[] = [
  AmbulanceRequestStatus.ACCEPTED,
  AmbulanceRequestStatus.EN_ROUTE,
  AmbulanceRequestStatus.COMPLETED,
];

const CITIZEN_CONTACT = { id: true, name: true, phone: true, email: true } as const;
const CITIZEN_MINIMAL = { id: true, name: true } as const;

@Injectable()
export class AmbulanceService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: AmbulanceSearchDto) {
    const { page = 1, limit = 20, search, city, lat, lng, radiusKm, availableOnly } = query;

    const where: Prisma.OrganizationWhereInput = {
      type: OrgType.AMBULANCE_PROVIDER,
      verificationStatus: VerificationStatus.APPROVED,
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { address: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      // Filter on the provider, not just on the included vehicles: previously
      // availableOnly only narrowed the nested list, so a provider with zero
      // available vehicles still appeared in the results with an empty fleet.
      ...(availableOnly && {
        ambulanceDetails: { some: { status: AmbulanceStatus.AVAILABLE } },
      }),
    };

    return searchOrganizationsByProximity(this.prisma, {
      where,
      geo: toGeoQuery({ lat, lng, radiusKm }),
      page,
      limit,
      hydrate: (args) =>
        this.prisma.organization.findMany({
          ...args,
          include: {
            ambulanceDetails: {
              where: availableOnly ? { status: AmbulanceStatus.AVAILABLE } : undefined,
              orderBy: { status: 'asc' },
            },
          },
        }),
    });
  }

  async createRequest(citizenId: string, dto: CreateAmbulanceRequestDto) {
    return this.prisma.ambulanceRequest.create({
      data: {
        citizenId,
        ambulanceId: dto.ambulanceId,
        pickupLatitude: dto.pickupLatitude,
        pickupLongitude: dto.pickupLongitude,
        pickupAddress: dto.pickupAddress.trim(),
        emergencyDescription: dto.emergencyDescription.trim(),
        status: AmbulanceRequestStatus.REQUESTED,
      },
      include: {
        citizen: {
          select: { id: true, name: true, phone: true },
        },
        ambulance: true,
      },
    });
  }

  /**
   * The dispatch queue visible to this caller.
   *
   * The previous implementation branched on CITIZEN and, for everybody else,
   * ran an unfiltered `findMany` — so any authenticated ambulance operator (and
   * any account whose role simply was not CITIZEN) received the 50 most recent
   * emergency requests on the platform, each including the caller's name, phone
   * number, email, pickup address and a free-text description of their medical
   * emergency. That is the single largest data exposure in the codebase.
   *
   * A provider now sees exactly two things: requests assigned to a vehicle in
   * its own fleet, and the unassigned open queue it is entitled to respond to.
   */
  async getRequests(user: AuthenticatedUser) {
    if (user.role === Role.CITIZEN) {
      return this.prisma.ambulanceRequest.findMany({
        where: { citizenId: user.id },
        include: {
          ambulance: { include: { organization: { select: { id: true, name: true, phone: true } } } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    }

    const where: Prisma.AmbulanceRequestWhereInput = hasPlatformWideRead(user)
      ? {}
      : {
          OR: [
            // Assigned to one of this operator's own vehicles.
            { ambulance: { organization: { userId: user.id } } },
            // The open queue: nobody has taken this call yet, so any verified
            // provider may see it in order to accept it. Pickup location and
            // description are needed to decide; contact details are not, and
            // are withheld below until the request is ACCEPTED.
            { ambulanceId: null, status: AmbulanceRequestStatus.REQUESTED },
          ],
        };

    const requests = await this.prisma.ambulanceRequest.findMany({
      where,
      include: {
        citizen: { select: CITIZEN_CONTACT },
        ambulance: { include: { organization: { select: { id: true, name: true, phone: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });

    if (hasPlatformWideRead(user)) {
      return requests;
    }

    // Row-level access does not imply field-level access. A responder gets the
    // patient's phone and email only once it has committed to the call.
    return requests.map((request) => {
      if (CONTACT_VISIBLE_STATUSES.includes(request.status)) {
        return request;
      }
      const { email: _email, phone: _phone, ...citizen } = request.citizen;
      return { ...request, citizen };
    });
  }

  /**
   * Moves a dispatch request along its lifecycle.
   *
   * Previously took only `(requestId, dto)` — no caller at all. Any account with
   * the AMBULANCE role could cancel, accept or complete any request on the
   * platform, including one being handled by a different provider. Cancelling a
   * stranger's active emergency dispatch was a two-line HTTP call.
   */
  async updateRequestStatus(requestId: string, user: AuthenticatedUser, dto: UpdateRequestStatusDto) {
    const request = await this.prisma.ambulanceRequest.findUnique({
      where: { id: requestId },
      include: { ambulance: { include: { organization: true } } },
    });

    if (!request) {
      throw new NotFoundException('Ambulance emergency request not found.');
    }

    const allowed = ALLOWED_TRANSITIONS[request.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        allowed.length === 0
          ? `This request is already ${request.status.toLowerCase()} and can no longer be changed.`
          : `Cannot change a ${request.status.toLowerCase()} request to ${dto.status.toLowerCase()}. Allowed: ${allowed.join(', ')}.`,
      );
    }

    const data: Prisma.AmbulanceRequestUpdateInput = { status: dto.status };

    if (request.ambulance) {
      // Already claimed — only the owning provider (or an admin) may touch it.
      assertOrgAccess(request.ambulance.organization, user, { resourceName: 'ambulance request' });
    } else if (dto.status === AmbulanceRequestStatus.ACCEPTED) {
      // Claiming an open request. The caller must nominate one of its own
      // vehicles, otherwise the request would be marked accepted with nobody
      // actually dispatched.
      if (!dto.ambulanceId) {
        throw new BadRequestException('Accepting an unassigned request requires the ambulanceId being dispatched.');
      }
      const ambulance = await this.prisma.ambulanceDetail.findUnique({
        where: { id: dto.ambulanceId },
        include: { organization: true },
      });
      if (!ambulance) {
        throw new NotFoundException('Ambulance vehicle record not found.');
      }
      assertOrgAccess(ambulance.organization, user, {
        requireApproved: true,
        resourceName: 'ambulance fleet',
      });
      data.ambulance = { connect: { id: ambulance.id } };
    } else if (user.role !== Role.ADMIN && request.citizenId !== user.id) {
      // Unassigned and not being accepted: only the citizen who raised it (or
      // an admin) can cancel it. Otherwise anyone could clear the open queue.
      throw new ForbiddenException('Only the requesting citizen can cancel an unassigned request.');
    }

    if (dto.status === AmbulanceRequestStatus.ACCEPTED) {
      data.respondedAt = new Date();
    } else if (dto.status === AmbulanceRequestStatus.COMPLETED) {
      data.completedAt = new Date();
    }

    return this.prisma.ambulanceRequest.update({
      where: { id: requestId },
      data,
      include: {
        citizen: { select: CITIZEN_CONTACT },
        ambulance: true,
      },
    });
  }

  async updateAmbulanceStatus(ambulanceId: string, user: AuthenticatedUser, dto: UpdateAmbulanceStatusDto) {
    const ambulance = await this.prisma.ambulanceDetail.findUnique({
      where: { id: ambulanceId },
      include: { organization: true },
    });

    if (!ambulance) {
      throw new NotFoundException('Ambulance vehicle record not found.');
    }

    // requireApproved: vehicle status is published straight into emergency
    // search results, so an unreviewed provider must not be able to advertise
    // itself as available.
    assertOrgAccess(ambulance.organization, user, {
      requireApproved: true,
      resourceName: 'ambulance fleet',
    });

    return this.prisma.ambulanceDetail.update({
      where: { id: ambulanceId },
      data: {
        status: dto.status,
        statusUpdatedAt: new Date(),
      },
    });
  }

  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
