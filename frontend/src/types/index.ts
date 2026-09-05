export type Role =
  | 'CITIZEN'
  | 'HOSPITAL'
  | 'BLOOD_BANK'
  | 'PHARMACY'
  | 'AMBULANCE'
  | 'NGO'
  | 'AUTHORITY'
  | 'ADMIN';

export type OrgType =
  | 'HOSPITAL'
  | 'BLOOD_BANK'
  | 'PHARMACY'
  | 'AMBULANCE_PROVIDER'
  | 'NGO';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type BloodType =
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE';

export type AmbulanceStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export type AmbulanceRequestStatus =
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'COMPLETED'
  | 'CANCELLED';

export type ComplaintStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  organizations?: Organization[];
}

export interface HospitalDetail {
  id: string;
  orgId: string;
  totalBeds: number;
  availableGeneralBeds: number;
  availableIcuBeds: number;
  emergencyAvailable: boolean;
  hasOxygenSupport: boolean;
  hasVentilators: boolean;
  departments: string[];
  services: string[];
  operatingHours: string;
  availabilityUpdatedAt: string;
}

export interface BloodBankInventory {
  id: string;
  orgId: string;
  bloodType: BloodType;
  unitsAvailable: number;
  lastUpdated: string;
}

export interface PharmacyMedicine {
  id: string;
  orgId: string;
  medicineName: string;
  genericName?: string;
  category?: string;
  price: number;
  inStock: boolean;
  quantity: number;
  lastUpdated: string;
  organization?: Organization;
}

export interface AmbulanceDetail {
  id: string;
  orgId: string;
  vehicleNumber: string;
  vehicleType: string;
  status: AmbulanceStatus;
  contactNumber: string;
  driverName?: string;
  statusUpdatedAt: string;
  organization?: Organization;
}

export interface Organization {
  id: string;
  userId: string;
  name: string;
  type: OrgType;
  description?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  website?: string;
  verificationStatus: VerificationStatus;
  licenseNumber?: string;
  rejectionReason?: string;
  verifiedAt?: string;
  distanceKm?: number | null;
  hospitalDetail?: HospitalDetail;
  bloodBankInventory?: BloodBankInventory[];
  pharmacyMedicines?: PharmacyMedicine[];
  ambulanceDetails?: AmbulanceDetail[];
}

export interface GovernmentScheme {
  id: string;
  createdById: string;
  title: string;
  description: string;
  eligibilityCriteria: string;
  benefits: string;
  applicationUrl?: string;
  category: string;
  documentsRequired: string[];
  isActive: boolean;
  createdAt: string;
}

export interface Complaint {
  id: string;
  citizenId: string;
  organizationId?: string;
  category: string;
  description: string;
  attachmentUrl?: string;
  status: ComplaintStatus;
  resolutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
  citizen?: { id: string; name: string; email: string; phone?: string };
  organization?: Organization;
  resolvedBy?: { id: string; name: string; role: string };
}

export interface EmergencyAlert {
  id: string;
  createdById: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  affectedArea: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  timestamp: string;
}

// ------------------------------------------------------- live (third-party)

/**
 * Shapes returned by `/api/v1/live/*`. These mirror the backend interfaces in
 * `backend/src/modules/live/`; they are genuinely live third-party data.
 *
 * Note what is absent: no availability fields. Real OSM facilities deliberately
 * carry no bed counts, blood units or stock levels — those figures are
 * simulated and belong only to seeded DEMO `Organization` rows. Keeping the two
 * types disjoint is what stops fabricated availability being rendered as fact.
 */
export type LiveFacilityCategory =
  | 'HOSPITAL'
  | 'CLINIC'
  | 'PHARMACY'
  | 'BLOOD_BANK'
  | 'AMBULANCE_STATION';

export interface LiveFacility {
  /** Stable OpenStreetMap reference, e.g. "way/38750705". Not a CivicConnect id. */
  osmRef: string;
  name: string;
  category: LiveFacilityCategory;
  latitude: number;
  longitude: number;
  distanceKm: number;
  /** Only present when OSM holds the tag; never fabricated. */
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  /** Tagged `emergency=yes` in OSM — a contributor's claim, not a verified fact. */
  hasEmergency: boolean;
}

export interface LiveFacilityResult {
  facilities: LiveFacility[];
  fetchedAt: string;
  /** Must be displayed: the ODbL licence requires attribution. */
  attribution: string;
  radiusKm: number;
}

export interface ReverseGeocodeResult {
  label: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface LiveEnvironment {
  location: string;
  fetchedAt: string;
  /** `null` when the upstream call failed — render "unavailable", not a placeholder number. */
  weather: {
    temperatureC: number;
    feelsLikeC: number;
    humidityPct: number;
    windKmh: number;
    /** WMO weather interpretation code; map to a label/icon at the call site. */
    weatherCode: number;
    observedAt: string;
  } | null;
  airQuality: {
    /** US EPA AQI as computed by Open-Meteo — NOT the Indian CPCB index. */
    usAqi: number;
    category: string;
    pm25: number | null;
    pm10: number | null;
    observedAt: string;
  } | null;
  place: ReverseGeocodeResult;
  sources: string[];
}
