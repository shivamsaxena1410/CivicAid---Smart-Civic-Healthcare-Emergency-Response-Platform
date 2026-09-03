import { http } from './api';
import type {
  AmbulanceDetail,
  AmbulanceRequestStatus,
  BloodType,
  Complaint,
  ComplaintStatus,
  EmergencyAlert,
  GovernmentScheme,
  Organization,
  OrgType,
  PharmacyMedicine,
  Role,
  User,
  VerificationStatus,
} from '../types';

/**
 * One typed wrapper per backend endpoint.
 *
 * Pages call these rather than `api.get('/some/path')` directly, so a route or
 * payload change is a compile error in one file instead of a runtime surprise
 * spread across ten screens. Query strings are built here too — every facility
 * search takes the same lat/lng/radiusKm triple.
 */

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

const EMPTY_META: PageMeta = { total: 0, page: 1, limit: 20, totalPages: 0 };

export interface GeoParams {
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
}

/**
 * Serialises query params, dropping only genuinely absent ones.
 *
 * `0` and `false` are meaningful here (longitude 0, `inStockOnly=false`), so
 * the check is explicitly against undefined/null/'' rather than falsiness —
 * the same class of bug that was dropping the radius filter on the backend.
 */
function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

function geoQs(params: GeoParams, extra: Record<string, string | number | boolean | undefined> = {}) {
  const { lat, lng, radiusKm, page, limit, search, city } = params;
  // Send coordinates only as a complete pair; the API treats a lone `lat` as a
  // client bug and there is no sensible interpretation of it.
  const hasCoords = lat !== undefined && lat !== null && lng !== undefined && lng !== null;
  return qs({
    ...(hasCoords ? { lat, lng, radiusKm } : {}),
    page,
    limit,
    search,
    city,
    ...extra,
  });
}

async function paged<T>(promise: Promise<{ data: T[]; meta?: PageMeta }>): Promise<Paged<T>> {
  const res = await promise;
  return { items: res.data ?? [], meta: res.meta ?? { ...EMPTY_META, total: res.data?.length ?? 0 } };
}

// --------------------------------------------------------------------- orgs

export type OrganizationWithDistance = Organization & { distanceKm: number | null };

export const organizations = {
  search: (params: GeoParams & { type?: OrgType }) =>
    paged<OrganizationWithDistance>(
      http.get(`/organizations${geoQs(params, { type: params.type })}`) as Promise<{
        data: OrganizationWithDistance[];
        meta?: PageMeta;
      }>,
    ),
  get: (id: string) => http.get<Organization>(`/organizations/${id}`).then((r) => r.data),
  update: (id: string, body: Partial<Organization>) =>
    http.patch<Organization>(`/organizations/${id}`, body).then((r) => r.data),
  create: (body: Record<string, unknown>) =>
    http.post<Organization>('/organizations', body).then((r) => r.data),
};

// ---------------------------------------------------------------- hospitals

export interface HospitalSearchParams extends GeoParams {
  icuOnly?: boolean;
  emergencyOnly?: boolean;
  oxygenOnly?: boolean;
  ventilatorOnly?: boolean;
  department?: string;
}

export const hospitals = {
  search: (params: HospitalSearchParams) =>
    paged<OrganizationWithDistance>(
      http.get(
        `/hospitals${geoQs(params, {
          icuOnly: params.icuOnly,
          emergencyOnly: params.emergencyOnly,
          oxygenOnly: params.oxygenOnly,
          ventilatorOnly: params.ventilatorOnly,
          department: params.department,
        })}`,
      ) as Promise<{ data: OrganizationWithDistance[]; meta?: PageMeta }>,
    ),
  get: (id: string) => http.get<Organization>(`/hospitals/${id}`).then((r) => r.data),
  updateCapacity: (
    orgId: string,
    body: {
      totalBeds?: number;
      availableGeneralBeds?: number;
      availableIcuBeds?: number;
      emergencyAvailable?: boolean;
      hasOxygenSupport?: boolean;
      hasVentilators?: boolean;
      departments?: string[];
      services?: string[];
      operatingHours?: string;
    },
  ) => http.patch<Organization>(`/hospitals/${orgId}/capacity`, body).then((r) => r.data),
};

// -------------------------------------------------------------- blood banks

export interface BloodBankSearchParams extends GeoParams {
  bloodType?: BloodType;
  minUnits?: number;
}

export const bloodBanks = {
  search: (params: BloodBankSearchParams) =>
    paged<OrganizationWithDistance>(
      http.get(
        `/blood-banks${geoQs(params, { bloodType: params.bloodType, minUnits: params.minUnits })}`,
      ) as Promise<{ data: OrganizationWithDistance[]; meta?: PageMeta }>,
    ),
  get: (id: string) => http.get<Organization>(`/blood-banks/${id}`).then((r) => r.data),
  updateInventory: (orgId: string, inventory: Array<{ bloodType: BloodType; unitsAvailable: number }>) =>
    http.patch<unknown>(`/blood-banks/${orgId}/inventory`, { inventory }).then((r) => r.data),
};

// --------------------------------------------------------------- pharmacies

export const pharmacies = {
  search: (params: GeoParams & { inStockOnly?: boolean }) =>
    paged<OrganizationWithDistance>(
      http.get(`/pharmacies${geoQs(params, { inStockOnly: params.inStockOnly })}`) as Promise<{
        data: OrganizationWithDistance[];
        meta?: PageMeta;
      }>,
    ),
  searchMedicines: (params: GeoParams & { inStockOnly?: boolean; medicineName?: string; genericName?: string }) =>
    paged<PharmacyMedicine & { distanceKm?: number | null }>(
      http.get(
        `/pharmacies/medicines/search${geoQs(params, {
          inStockOnly: params.inStockOnly,
          medicineName: params.medicineName,
          genericName: params.genericName,
        })}`,
      ) as Promise<{
        data: Array<PharmacyMedicine & { distanceKm?: number | null }>;
        meta?: PageMeta;
      }>,
    ),
  addMedicine: (
    orgId: string,
    body: { medicineName: string; genericName?: string; category?: string; price: number; quantity: number; inStock?: boolean },
  ) => http.post<PharmacyMedicine>(`/pharmacies/${orgId}/medicines`, body).then((r) => r.data),
  updateMedicine: (medicineId: string, body: Partial<{ price: number; quantity: number; inStock: boolean }>) =>
    http.patch<PharmacyMedicine>(`/pharmacies/medicines/${medicineId}`, body).then((r) => r.data),
  deleteMedicine: (medicineId: string) => http.delete<unknown>(`/pharmacies/medicines/${medicineId}`),
};

// --------------------------------------------------------------- ambulances

export interface AmbulanceRequest {
  id: string;
  citizenId: string;
  ambulanceId?: string | null;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string;
  emergencyDescription: string;
  status: AmbulanceRequestStatus;
  createdAt: string;
  citizen?: { id: string; name: string; phone?: string; email?: string };
  ambulance?: AmbulanceDetail & { organization?: Organization };
}

export const ambulances = {
  search: (params: GeoParams & { availableOnly?: boolean }) =>
    paged<OrganizationWithDistance>(
      http.get(`/ambulances${geoQs(params, { availableOnly: params.availableOnly })}`) as Promise<{
        data: OrganizationWithDistance[];
        meta?: PageMeta;
      }>,
    ),
  createRequest: (body: {
    pickupLatitude: number;
    pickupLongitude: number;
    pickupAddress: string;
    emergencyDescription: string;
    ambulanceId?: string;
  }) => http.post<AmbulanceRequest>('/ambulances/requests', body).then((r) => r.data),
  listRequests: () => http.get<AmbulanceRequest[]>('/ambulances/requests').then((r) => r.data ?? []),
  updateRequestStatus: (requestId: string, body: { status: AmbulanceRequestStatus; ambulanceId?: string }) =>
    http.patch<AmbulanceRequest>(`/ambulances/requests/${requestId}/status`, body).then((r) => r.data),
  updateVehicleStatus: (ambulanceId: string, status: 'AVAILABLE' | 'BUSY' | 'OFFLINE') =>
    http.patch<AmbulanceDetail>(`/ambulances/${ambulanceId}/status`, { status }).then((r) => r.data),
};

// --------------------------------------------------------------- complaints

export const complaints = {
  list: (params: { page?: number; limit?: number; status?: ComplaintStatus; search?: string } = {}) =>
    paged<Complaint>(
      http.get(`/complaints${qs(params)}`) as Promise<{ data: Complaint[]; meta?: PageMeta }>,
    ),
  get: (id: string) => http.get<Complaint>(`/complaints/${id}`).then((r) => r.data),
  create: (body: { category: string; description: string; organizationId?: string; attachmentUrl?: string }) =>
    http.post<Complaint>('/complaints', body).then((r) => r.data),
  resolve: (id: string, body: { status: ComplaintStatus; resolutionNotes: string }) =>
    http.patch<Complaint>(`/complaints/${id}/resolve`, body).then((r) => r.data),
};

// ------------------------------------------------------------------ schemes

export const schemes = {
  list: (params: { page?: number; limit?: number; search?: string; category?: string } = {}) =>
    paged<GovernmentScheme>(
      http.get(`/schemes${qs(params)}`) as Promise<{ data: GovernmentScheme[]; meta?: PageMeta }>,
    ),
  get: (id: string) => http.get<GovernmentScheme>(`/schemes/${id}`).then((r) => r.data),
  create: (body: Record<string, unknown>) => http.post<GovernmentScheme>('/schemes', body).then((r) => r.data),
  update: (id: string, body: Record<string, unknown>) =>
    http.patch<GovernmentScheme>(`/schemes/${id}`, body).then((r) => r.data),
  remove: (id: string) => http.delete<unknown>(`/schemes/${id}`),
};

// ------------------------------------------------------------------- alerts

export const alerts = {
  active: () => http.get<EmergencyAlert[]>('/alerts/active').then((r) => r.data ?? []),
  list: (params: { page?: number; limit?: number } = {}) =>
    paged<EmergencyAlert>(http.get(`/alerts${qs(params)}`) as Promise<{ data: EmergencyAlert[]; meta?: PageMeta }>),
  create: (body: { title: string; description: string; severity: string; affectedArea: string; expiresAt?: string }) =>
    http.post<EmergencyAlert>('/alerts', body).then((r) => r.data),
  toggle: (id: string, isActive: boolean) =>
    http.patch<EmergencyAlert>(`/alerts/${id}/toggle`, { isActive }).then((r) => r.data),
};

// -------------------------------------------------------------------- admin

/** Mirrors `AdminService.getPlatformAnalytics()`. */
export interface AdminAnalytics {
  overview: {
    totalUsers: number;
    totalHospitals: number;
    totalBloodBanks: number;
    totalPharmacies: number;
    totalAmbulances: number;
    pendingVerifications: number;
    totalComplaints: number;
    resolvedComplaints: number;
  };
  capacityMetrics: {
    totalBeds: number;
    availableGeneralBeds: number;
    availableIcuBeds: number;
    totalBloodUnitsInStock: number;
  };
}

export const admin = {
  analytics: () => http.get<AdminAnalytics>('/admin/analytics').then((r) => r.data),
  pendingOrganizations: (params: { page?: number; limit?: number } = {}) =>
    paged<Organization>(
      http.get(`/admin/organizations/pending${qs(params)}`) as Promise<{ data: Organization[]; meta?: PageMeta }>,
    ),
  verifyOrganization: (orgId: string, body: { status: VerificationStatus; rejectionReason?: string }) =>
    http.patch<Organization>(`/admin/organizations/${orgId}/verify`, body).then((r) => r.data),
  users: (params: { page?: number; limit?: number; search?: string } = {}) =>
    paged<User>(http.get(`/admin/users${qs(params)}`) as Promise<{ data: User[]; meta?: PageMeta }>),
  setUserStatus: (userId: string, isActive: boolean) =>
    http.patch<User>(`/admin/users/${userId}/status`, { isActive }).then((r) => r.data),
  auditLogs: (params: { page?: number; limit?: number } = {}) =>
    paged<Record<string, unknown>>(
      http.get(`/admin/audit-logs${qs(params)}`) as Promise<{ data: Record<string, unknown>[]; meta?: PageMeta }>,
    ),
};

// ----------------------------------------------------------------- ai chat

export const aiChat = {
  send: (message: string) => http.post<{ reply: string }>('/ai-chat/message', { message }).then((r) => r.data),
  history: () => http.get<Array<{ id: string; message: string; response: string; createdAt: string }>>('/ai-chat/history').then((r) => r.data ?? []),
};

export type { Role, User };
