import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Proximity search against the PostGIS `location` column.
 *
 * Every facility service previously did its own version of this in JavaScript,
 * and all five had the same three defects:
 *
 *   1. **Paginate, then filter.** `findMany({ skip, take })` ran first and the
 *      radius filter was applied to the resulting page. Asking for hospitals
 *      within 5 km returned only those that happened to land on page 1 of an
 *      unordered query — in an emergency-services context, the nearest hospital
 *      could simply be missing from the results.
 *   2. **`total` counted the unfiltered set.** The meta block reported every
 *      approved hospital in the database, so a search returning 2 rows claimed
 *      `total: 40` and the client paged into empty results.
 *   3. **Sort after truncation.** Ordering by distance was applied to the page,
 *      not to the result set, so "nearest first" only held within one page.
 *
 * There was also a subtler bug in the guard `if (lat && lng)`: longitude 0 and
 * latitude 0 are real coordinates (Greenwich, the equator), and `0` is falsy,
 * so a query on the prime meridian silently fell back to unsorted results. This
 * module tests for `null`/`undefined` explicitly.
 *
 * The spatial work now happens in Postgres, where the GiST index on
 * `organizations.location` can be used: `ST_DWithin` filters, `ST_Distance`
 * orders and produces the returned distance, `COUNT(*) OVER ()` counts the
 * filtered set, and LIMIT/OFFSET apply last.
 */

export interface GeoQuery {
  lat: number;
  lng: number;
  /** Kilometres. 0 is valid and means "at this exact point". */
  radiusKm: number;
}

/**
 * Narrows a query DTO to a usable geo query.
 *
 * Both coordinates must be present; a lone `lat` is a client bug, and treating
 * it as "no location" silently returns nationwide results to someone who asked
 * for nearby ones.
 */
export function toGeoQuery(query: {
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number | null;
}): GeoQuery | null {
  const { lat, lng } = query;
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return null;
  }
  return { lat, lng, radiusKm: query.radiusKm ?? 15 };
}

interface ProximityRow {
  id: string;
  distance_km: number;
  total: bigint;
}

/**
 * Orders and paginates a candidate set of organisations by distance.
 *
 * `candidateIds` carries the non-spatial filters (type, city, verification
 * status, nested availability filters). Those stay in Prisma rather than being
 * hand-written into SQL five times over — the query builder already expresses
 * them correctly, and duplicating them raw is where filter drift starts.
 */
async function paginateByDistance(
  prisma: PrismaService,
  candidateIds: string[],
  geo: GeoQuery,
  skip: number,
  take: number,
): Promise<{ ids: string[]; distances: Map<string, number>; total: number }> {
  if (candidateIds.length === 0) {
    return { ids: [], distances: new Map(), total: 0 };
  }

  const radiusMeters = geo.radiusKm * 1000;

  const rows = await prisma.$queryRaw<ProximityRow[]>`
    SELECT
      o."id",
      ST_Distance(
        o."location",
        ST_SetSRID(ST_MakePoint(${geo.lng}::double precision, ${geo.lat}::double precision), 4326)::geography
      ) / 1000.0 AS distance_km,
      COUNT(*) OVER () AS total
    FROM "organizations" o
    WHERE o."id" IN (${Prisma.join(candidateIds)})
      AND o."location" IS NOT NULL
      AND ST_DWithin(
        o."location",
        ST_SetSRID(ST_MakePoint(${geo.lng}::double precision, ${geo.lat}::double precision), 4326)::geography,
        ${radiusMeters}::double precision
      )
    -- Tie-break on id: without it, two facilities at the same distance can swap
    -- places between page 1 and page 2, duplicating one and hiding the other.
    ORDER BY distance_km ASC, o."id" ASC
    LIMIT ${take}::int OFFSET ${skip}::int
  `;

  const distances = new Map<string, number>();
  for (const row of rows) {
    distances.set(row.id, Number(row.distance_km.toFixed(2)));
  }

  return {
    ids: rows.map((r) => r.id),
    // COUNT(*) OVER () is the size of the filtered set, before LIMIT. It is only
    // present on returned rows, so an empty page means an empty result set.
    total: rows.length > 0 ? Number(rows[0].total) : 0,
    distances,
  };
}

export interface ProximitySearchArgs<T extends { id: string }> {
  where: Prisma.OrganizationWhereInput;
  geo: GeoQuery | null;
  page: number;
  limit: number;
  /** Ordering used when no coordinates were supplied. */
  orderBy?: Prisma.OrganizationOrderByWithRelationInput[];
  /** Supplies the caller's own `include`/`select` shape. */
  hydrate: (args: {
    where: Prisma.OrganizationWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Prisma.OrganizationOrderByWithRelationInput[];
  }) => Promise<T[]>;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/**
 * Runs a facility search, spatially filtered when coordinates are supplied and
 * plainly paginated when they are not.
 *
 * `distanceKm` is `null` in the non-spatial case — the distance from an unknown
 * origin is unknown, and reporting `0` or omitting the field would both be read
 * by clients as "very close".
 */
export async function searchOrganizationsByProximity<T extends { id: string }>(
  prisma: PrismaService,
  args: ProximitySearchArgs<T>,
): Promise<PaginatedResult<T & { distanceKm: number | null }>> {
  const { where, geo, page, limit, orderBy = [{ name: 'asc' }, { id: 'asc' }], hydrate } = args;
  const skip = (page - 1) * limit;

  if (!geo) {
    const [total, rows] = await Promise.all([
      prisma.organization.count({ where }),
      hydrate({ where, skip, take: limit, orderBy }),
    ]);
    return {
      data: rows.map((row) => ({ ...row, distanceKm: null })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  const candidates = await prisma.organization.findMany({ where, select: { id: true } });
  const { ids, distances, total } = await paginateByDistance(
    prisma,
    candidates.map((c) => c.id),
    geo,
    skip,
    limit,
  );

  if (ids.length === 0) {
    return { data: [], meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // Prisma cannot order by a computed distance, so the page is selected and
  // ordered by Postgres above and merely hydrated here.
  const rows = await hydrate({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((row) => [row.id, row]));

  return {
    data: ids
      .map((id) => {
        const row = byId.get(id);
        return row ? { ...row, distanceKm: distances.get(id) ?? null } : null;
      })
      .filter((row): row is T & { distanceKm: number | null } => row !== null),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Distances for an arbitrary set of organisation ids, for callers whose primary
 * records are not organisations (medicine search lists medicines, each attached
 * to a pharmacy). Returns only ids inside the radius, so the caller can use the
 * map both to filter and to annotate.
 */
export async function distancesWithinRadius(
  prisma: PrismaService,
  orgIds: string[],
  geo: GeoQuery,
): Promise<Map<string, number>> {
  if (orgIds.length === 0) {
    return new Map();
  }

  const radiusMeters = geo.radiusKm * 1000;

  const rows = await prisma.$queryRaw<Array<{ id: string; distance_km: number }>>`
    SELECT
      o."id",
      ST_Distance(
        o."location",
        ST_SetSRID(ST_MakePoint(${geo.lng}::double precision, ${geo.lat}::double precision), 4326)::geography
      ) / 1000.0 AS distance_km
    FROM "organizations" o
    WHERE o."id" IN (${Prisma.join(orgIds)})
      AND o."location" IS NOT NULL
      AND ST_DWithin(
        o."location",
        ST_SetSRID(ST_MakePoint(${geo.lng}::double precision, ${geo.lat}::double precision), 4326)::geography,
        ${radiusMeters}::double precision
      )
  `;

  return new Map(rows.map((row) => [row.id, Number(row.distance_km.toFixed(2))]));
}
