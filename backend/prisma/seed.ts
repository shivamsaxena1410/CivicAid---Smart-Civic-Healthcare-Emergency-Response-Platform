/**
 * CivicConnect database seed — DEMONSTRATION DATA ONLY.
 *
 * ---------------------------------------------------------------------------
 * EVERY facility in this file is fictional. Nothing here describes a real
 * hospital, blood bank, pharmacy, ambulance operator or NGO.
 * ---------------------------------------------------------------------------
 *
 * This matters more than it might look. The previous version of this seed
 * populated the database with real, identifiable institutions — named hospitals
 * with invented bed counts and fabricated licence numbers, real blood banks
 * with invented stock levels, real pharmacy and ambulance brands, real
 * `.gov.in` contact addresses, and a fabricated negative complaint filed
 * against a named real hospital. Publishing invented availability figures
 * against real healthcare providers is misinformation regardless of intent,
 * and in an emergency-services context it is the kind that gets someone hurt.
 *
 * The conventions that keep this honest:
 *
 *   - Every organisation name is prefixed `DEMO —`, so it is impossible to
 *     mistake a seeded row for real data in the UI, in a screenshot, or in a
 *     database dump.
 *   - All emails and websites use `.invalid`, the TLD RFC 2606 reserves
 *     precisely so it can never resolve and can never collide with a real
 *     domain.
 *   - Phone numbers use the 555-style `5550 0xxx` block: correctly formatted,
 *     obviously not dialable.
 *   - Every organisation sets `isSimulated: true` and
 *     `dataSource: DataSource.SIMULATED` explicitly. These would default to the
 *     same values, but writing them here makes the provenance visible at the
 *     point where the fake data is created, rather than implied by a schema
 *     default three files away.
 *   - Medicines carry generic INN names only (`Paracetamol 650 mg`, not a brand
 *     product). An INN is a public pharmacological fact, not a commercial claim.
 *
 * Coordinates are real Bengaluru locations. That is deliberate and is not a
 * provenance problem: geography is not an availability claim, and the radius
 * search needs a realistic spatial distribution to be worth demonstrating. The
 * layout preserves a useful shape — three facilities clustered within ~2 km in
 * the east, several scattered across the centre, and one outlier ~7 km south —
 * so `ST_DWithin` at 2 km / 5 km / 15 km returns visibly different result sets.
 * Street addresses are invented.
 *
 * Government schemes are the one deliberate exception: PM-JAY, ABHA, PMBJP and
 * RAN are genuine published public policy with genuine URLs. Reproducing public
 * policy accurately is not fabrication — inventing which facility offers it
 * would be, which is why no seeded facility advertises a scheme desk.
 */

import {
  PrismaClient,
  Role,
  OrgType,
  VerificationStatus,
  DataSource,
  BloodType,
  AmbulanceStatus,
  AmbulanceRequestStatus,
  ComplaintStatus,
  AlertSeverity,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/** Shared demo password. Fine here; this database is disposable by definition. */
const DEMO_PASSWORD = 'Password123!';

/**
 * Match the application's bcrypt cost rather than hardcoding one.
 * `env.validation.ts` defaults to 12 and rejects anything outside 10–15; the
 * previous seed hardcoded 10, so seeded users were hashed at a weaker cost than
 * anyone who registered through the API.
 */
function resolveSaltRounds(): number {
  const raw = process.env.BCRYPT_SALT_ROUNDS;
  const parsed = raw === undefined || raw.trim() === '' ? 12 : Number(raw);
  if (!Number.isInteger(parsed) || parsed < 10 || parsed > 15) {
    throw new Error(`BCRYPT_SALT_ROUNDS must be an integer between 10 and 15, received "${raw}".`);
  }
  return parsed;
}

/** Provenance applied to every seeded facility. */
const SIMULATED = {
  isSimulated: true,
  dataSource: DataSource.SIMULATED,
} as const;

async function main() {
  console.log('🌱 Seeding CivicConnect with SIMULATED demonstration data...');

  const saltRounds = resolveSaltRounds();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, saltRounds);
  console.log(`🔒 Password hashed with bcrypt cost ${saltRounds}.`);

  // The whole seed runs in one transaction. The previous version deleted
  // everything and then created rows one statement at a time, so any failure
  // partway through left a half-populated database that looked seeded but
  // wasn't. Timeout is generous because this is ~70 round trips.
  await prisma.$transaction(
    async (tx) => {
      // ---------------------------------------------------------------------
      // 1. Reset, in reverse dependency order.
      // ---------------------------------------------------------------------
      await tx.auditLog.deleteMany();
      await tx.notification.deleteMany();
      await tx.aIChatHistory.deleteMany();
      await tx.emergencyAlert.deleteMany();
      await tx.complaint.deleteMany();
      await tx.governmentScheme.deleteMany();
      await tx.ambulanceRequest.deleteMany();
      await tx.ambulanceDetail.deleteMany();
      await tx.pharmacyMedicine.deleteMany();
      await tx.bloodBankInventory.deleteMany();
      await tx.hospitalDetail.deleteMany();
      await tx.organization.deleteMany();
      await tx.refreshToken.deleteMany();
      await tx.user.deleteMany();
      console.log('🧹 Cleared existing rows.');

      // ---------------------------------------------------------------------
      // 2. Users — one per role, plus the extra pairs the authorization tests
      //    need. Two citizens (A vs B) and two hospital operators (P vs Q) let
      //    us prove that one cannot read or mutate the other's records; a
      //    single account per role cannot demonstrate that at all.
      // ---------------------------------------------------------------------
      const mkUser = (email: string, name: string, role: Role, phone: string) =>
        tx.user.create({
          data: { email, passwordHash, name, phone, role, isActive: true, isVerified: true },
        });

      const adminUser = await mkUser('admin@example.invalid', 'DEMO Platform Administrator', Role.ADMIN, '+91 80 5550 0001');
      const authorityUser = await mkUser('authority@example.invalid', 'DEMO District Health Authority', Role.AUTHORITY, '+91 80 5550 0002');
      const citizenA = await mkUser('citizen@example.invalid', 'DEMO Citizen One', Role.CITIZEN, '+91 80 5550 0003');
      const citizenB = await mkUser('citizen.two@example.invalid', 'DEMO Citizen Two', Role.CITIZEN, '+91 80 5550 0004');
      const hospitalP = await mkUser('hospital@example.invalid', 'DEMO Hospital Operator P', Role.HOSPITAL, '+91 80 5550 0005');
      const hospitalQ = await mkUser('hospital.two@example.invalid', 'DEMO Hospital Operator Q', Role.HOSPITAL, '+91 80 5550 0006');
      const bloodBankUser = await mkUser('bloodbank@example.invalid', 'DEMO Blood Centre Operator', Role.BLOOD_BANK, '+91 80 5550 0007');
      const pharmacyUser = await mkUser('pharmacy@example.invalid', 'DEMO Pharmacy Operator', Role.PHARMACY, '+91 80 5550 0008');
      const ambulanceUser = await mkUser('ambulance@example.invalid', 'DEMO Ambulance Dispatch Operator', Role.AMBULANCE, '+91 80 5550 0009');
      const ngoUser = await mkUser('ngo@example.invalid', 'DEMO NGO Coordinator', Role.NGO, '+91 80 5550 0010');
      console.log('✅ Created 10 demo users (all roles, plus citizen A/B and hospital P/Q pairs).');

      // ---------------------------------------------------------------------
      // 3. Organisations.
      //
      //    `location` is never written here — it is a STORED GENERATED column
      //    that PostgreSQL derives from (longitude, latitude). Writing it would
      //    be rejected by the database.
      //
      //    Ownership is deliberately uneven: operator P owns two hospitals and
      //    the blood centre operator owns two blood banks. That exercises the
      //    "a user may own several organisations" case, which the complaint
      //    service currently gets wrong by resolving the caller's org with
      //    findFirst.
      //
      //    One hospital is left PENDING so the verified-before-publish rule has
      //    something to reject.
      // ---------------------------------------------------------------------
      const approved = {
        verificationStatus: VerificationStatus.APPROVED,
        verifiedById: adminUser.id,
        verifiedAt: new Date(),
      };

      const northside = await tx.organization.create({
        data: {
          userId: hospitalP.id,
          name: 'DEMO — Northside General Hospital',
          type: OrgType.HOSPITAL,
          description: 'Simulated multi-specialty teaching hospital used to demonstrate bed availability and emergency intake. Not a real facility.',
          address: '14, Demo Civic Layout, Sector 2',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560017',
          latitude: 12.9592,
          longitude: 77.6499,
          phone: '+91 80 5550 0101',
          email: 'contact@northside-general.example.invalid',
          website: 'https://northside-general.example.invalid',
          licenseNumber: 'DEMO-HOSP-0001',
          ...approved,
          ...SIMULATED,
          hospitalDetail: {
            create: {
              totalBeds: 450,
              availableGeneralBeds: 114,
              availableIcuBeds: 18,
              emergencyAvailable: true,
              hasOxygenSupport: true,
              hasVentilators: true,
              departments: ['Emergency Medicine', 'Cardiology', 'Orthopaedics', 'Paediatrics', 'General Surgery', 'Radiology'],
              services: ['24x7 Casualty', 'Intensive Care', 'Diagnostic Imaging', 'Blood Transfusion', 'Ambulance Bay', 'Pharmacy'],
              operatingHours: '24/7',
              availabilityUpdatedAt: new Date(),
            },
          },
        },
      });

      const lakeview = await tx.organization.create({
        data: {
          userId: hospitalQ.id,
          name: 'DEMO — Lakeview Medical Centre',
          type: OrgType.HOSPITAL,
          description: 'Simulated mid-size general hospital. Availability figures are invented for demonstration.',
          address: '7, Demo Lake Road, Phase 1',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560002',
          latitude: 12.9629,
          longitude: 77.5753,
          phone: '+91 80 5550 0102',
          email: 'contact@lakeview-medical.example.invalid',
          website: 'https://lakeview-medical.example.invalid',
          licenseNumber: 'DEMO-HOSP-0002',
          ...approved,
          ...SIMULATED,
          hospitalDetail: {
            create: {
              totalBeds: 350,
              availableGeneralBeds: 72,
              availableIcuBeds: 9,
              emergencyAvailable: true,
              hasOxygenSupport: true,
              hasVentilators: true,
              departments: ['Emergency Medicine', 'Internal Medicine', 'Obstetrics & Gynaecology', 'Nephrology', 'Oncology'],
              services: ['24x7 Casualty', 'Dialysis Unit', 'Maternity Care', 'Day Care Chemotherapy', 'Laboratory'],
              operatingHours: '24/7',
              availabilityUpdatedAt: new Date(),
            },
          },
        },
      });

      // Deliberately PENDING: nothing this organisation reports should be
      // publishable until an admin approves it.
      const civicMemorial = await tx.organization.create({
        data: {
          userId: hospitalP.id,
          name: 'DEMO — Civic Memorial Hospital (Pending Verification)',
          type: OrgType.HOSPITAL,
          description: 'Simulated hospital left in PENDING verification state to exercise the verified-before-publish rule.',
          address: '221, Demo South Avenue',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560076',
          latitude: 12.8948,
          longitude: 77.5989,
          phone: '+91 80 5550 0103',
          email: 'contact@civic-memorial.example.invalid',
          website: 'https://civic-memorial.example.invalid',
          licenseNumber: 'DEMO-HOSP-0003',
          verificationStatus: VerificationStatus.PENDING,
          ...SIMULATED,
          hospitalDetail: {
            create: {
              totalBeds: 180,
              availableGeneralBeds: 40,
              availableIcuBeds: 6,
              emergencyAvailable: false,
              hasOxygenSupport: true,
              hasVentilators: false,
              departments: ['General Medicine', 'Physiotherapy'],
              services: ['Outpatient Clinic', 'Laboratory'],
              operatingHours: 'Mon–Sat 08:00–20:00',
              availabilityUpdatedAt: new Date(),
            },
          },
        },
      });

      const redstoneBlood = await tx.organization.create({
        data: {
          userId: bloodBankUser.id,
          name: 'DEMO — Redstone Community Blood Centre',
          type: OrgType.BLOOD_BANK,
          description: 'Simulated blood centre. All stock figures below are invented.',
          address: '3, Demo Donor Street',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
          latitude: 12.9833,
          longitude: 77.5815,
          phone: '+91 80 5550 0104',
          email: 'contact@redstone-blood.example.invalid',
          website: 'https://redstone-blood.example.invalid',
          licenseNumber: 'DEMO-BB-0001',
          ...approved,
          ...SIMULATED,
        },
      });

      const harbourBlood = await tx.organization.create({
        data: {
          userId: bloodBankUser.id,
          name: 'DEMO — Harbour City Blood Services',
          type: OrgType.BLOOD_BANK,
          description: 'Second simulated blood centre, owned by the same operator, so multi-organisation ownership is covered.',
          address: '58, Demo East Main Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560075',
          latitude: 12.9734,
          longitude: 77.6521,
          phone: '+91 80 5550 0105',
          email: 'contact@harbour-blood.example.invalid',
          website: 'https://harbour-blood.example.invalid',
          licenseNumber: 'DEMO-BB-0002',
          ...approved,
          ...SIMULATED,
        },
      });

      const greenfieldPharmacy = await tx.organization.create({
        data: {
          userId: pharmacyUser.id,
          name: 'DEMO — Greenfield Community Pharmacy',
          type: OrgType.PHARMACY,
          description: 'Simulated 24-hour pharmacy. Prices and stock counts are invented.',
          address: '90, Demo Market Lane, 4th Block',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560034',
          latitude: 12.9345,
          longitude: 77.6255,
          phone: '+91 80 5550 0106',
          email: 'contact@greenfield-pharmacy.example.invalid',
          website: 'https://greenfield-pharmacy.example.invalid',
          licenseNumber: 'DEMO-PHARM-0001',
          ...approved,
          ...SIMULATED,
        },
      });

      const rapidResponse = await tx.organization.create({
        data: {
          userId: ambulanceUser.id,
          name: 'DEMO — Rapid Response Ambulance Network',
          type: OrgType.AMBULANCE_PROVIDER,
          description: 'Simulated ambulance operator used to demonstrate dispatch. Vehicles and crews are fictional.',
          address: '5, Demo Depot Road, Stage 2',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560038',
          latitude: 12.9719,
          longitude: 77.6412,
          phone: '+91 80 5550 0107',
          email: 'dispatch@rapid-response.example.invalid',
          website: 'https://rapid-response.example.invalid',
          licenseNumber: 'DEMO-AMB-0001',
          ...approved,
          ...SIMULATED,
        },
      });

      // The previous seed created an NGO user but never an NGO organisation, so
      // OrgType.NGO had zero rows and that branch of every search was untested.
      const sunriseNgo = await tx.organization.create({
        data: {
          userId: ngoUser.id,
          name: 'DEMO — Sunrise Health Outreach Foundation',
          type: OrgType.NGO,
          description: 'Simulated non-profit running community health camps. Not a real organisation.',
          address: '41, Demo Central Cross',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560052',
          latitude: 12.978,
          longitude: 77.61,
          phone: '+91 80 5550 0108',
          email: 'contact@sunrise-outreach.example.invalid',
          website: 'https://sunrise-outreach.example.invalid',
          licenseNumber: 'DEMO-NGO-0001',
          ...approved,
          ...SIMULATED,
        },
      });

      console.log('✅ Created 8 DEMO organisations (3 hospitals incl. 1 PENDING, 2 blood banks, pharmacy, ambulance provider, NGO).');

      // ---------------------------------------------------------------------
      // 4. Blood inventory — all 8 BloodType values at both centres, so no
      //    enum member is untested.
      // ---------------------------------------------------------------------
      const bloodUnits: Array<[BloodType, number]> = [
        [BloodType.O_POSITIVE, 48],
        [BloodType.O_NEGATIVE, 12],
        [BloodType.A_POSITIVE, 35],
        [BloodType.A_NEGATIVE, 8],
        [BloodType.B_POSITIVE, 52],
        [BloodType.B_NEGATIVE, 14],
        [BloodType.AB_POSITIVE, 22],
        [BloodType.AB_NEGATIVE, 0], // zero-stock case, so "unavailable" renders
      ];

      for (const [bloodType, units] of bloodUnits) {
        await tx.bloodBankInventory.create({
          data: { orgId: redstoneBlood.id, bloodType, unitsAvailable: units, lastUpdated: new Date() },
        });
        await tx.bloodBankInventory.create({
          data: { orgId: harbourBlood.id, bloodType, unitsAvailable: Math.floor(units * 0.8), lastUpdated: new Date() },
        });
      }
      console.log('✅ Created 16 blood inventory rows (all 8 types × 2 centres, incl. a zero-stock type).');

      // ---------------------------------------------------------------------
      // 5. Medicines — generic INN names only. Two are out of stock so the
      //    "unavailable" path is reachable; previously all ten were in stock.
      // ---------------------------------------------------------------------
      const medicines = [
        { medicineName: 'Paracetamol 650 mg Tablet', genericName: 'Paracetamol', category: 'Analgesic / Antipyretic', price: 32.5, quantity: 600, inStock: true },
        { medicineName: 'Azithromycin 500 mg Tablet', genericName: 'Azithromycin', category: 'Antibiotic', price: 118.0, quantity: 140, inStock: true },
        { medicineName: 'Amoxicillin + Clavulanic Acid 625 mg Tablet', genericName: 'Amoxicillin/Clavulanate', category: 'Antibiotic', price: 196.4, quantity: 90, inStock: true },
        { medicineName: 'Telmisartan 40 mg Tablet', genericName: 'Telmisartan', category: 'Antihypertensive', price: 88.0, quantity: 210, inStock: true },
        { medicineName: 'Metformin 500 mg Tablet', genericName: 'Metformin Hydrochloride', category: 'Antidiabetic', price: 41.0, quantity: 380, inStock: true },
        { medicineName: 'Atorvastatin 10 mg Tablet', genericName: 'Atorvastatin', category: 'Lipid-lowering', price: 74.5, quantity: 165, inStock: true },
        { medicineName: 'Pantoprazole 40 mg Tablet', genericName: 'Pantoprazole', category: 'Proton Pump Inhibitor', price: 96.0, quantity: 240, inStock: true },
        { medicineName: 'Salbutamol 100 mcg Inhaler', genericName: 'Salbutamol', category: 'Bronchodilator', price: 152.0, quantity: 0, inStock: false },
        { medicineName: 'Oral Rehydration Salts Sachet', genericName: 'ORS (WHO formula)', category: 'Electrolyte Replacement', price: 21.0, quantity: 500, inStock: true },
        { medicineName: 'Insulin Glargine 100 IU/mL Cartridge', genericName: 'Insulin Glargine', category: 'Antidiabetic', price: 780.0, quantity: 0, inStock: false },
      ];

      for (const medicine of medicines) {
        await tx.pharmacyMedicine.create({
          data: { orgId: greenfieldPharmacy.id, ...medicine, lastUpdated: new Date() },
        });
      }
      console.log('✅ Created 10 pharmacy medicines (generic names; 2 out of stock).');

      // ---------------------------------------------------------------------
      // 6. Ambulance fleet — covers all three AmbulanceStatus values.
      // ---------------------------------------------------------------------
      const alsVehicle = await tx.ambulanceDetail.create({
        data: {
          orgId: rapidResponse.id,
          vehicleNumber: 'DEMO-AMB-01',
          vehicleType: 'Advanced Life Support (ALS) with Ventilator',
          status: AmbulanceStatus.AVAILABLE,
          contactNumber: '+91 80 5550 0201',
          driverName: 'DEMO Driver One',
        },
      });
      const blsVehicle = await tx.ambulanceDetail.create({
        data: {
          orgId: rapidResponse.id,
          vehicleNumber: 'DEMO-AMB-02',
          vehicleType: 'Basic Life Support (BLS)',
          status: AmbulanceStatus.BUSY,
          contactNumber: '+91 80 5550 0202',
          driverName: 'DEMO Driver Two',
        },
      });
      await tx.ambulanceDetail.create({
        data: {
          orgId: rapidResponse.id,
          vehicleNumber: 'DEMO-AMB-03',
          vehicleType: 'Patient Transport Ambulance (PTA)',
          status: AmbulanceStatus.OFFLINE,
          contactNumber: '+91 80 5550 0203',
          driverName: 'DEMO Driver Three',
        },
      });
      console.log('✅ Created 3 ambulances (AVAILABLE / BUSY / OFFLINE).');

      // ---------------------------------------------------------------------
      // 7. Ambulance requests. Previously zero rows existed, which meant the
      //    dispatch authorization rules had nothing to be tested against.
      //
      //    The first one is the important case: unassigned and REQUESTED, i.e.
      //    the open queue. Any provider may see that it exists in order to
      //    accept it, but the citizen's phone number must not be exposed until
      //    someone actually does.
      // ---------------------------------------------------------------------
      await tx.ambulanceRequest.create({
        data: {
          citizenId: citizenA.id,
          ambulanceId: null,
          pickupLatitude: 12.9611,
          pickupLongitude: 77.6387,
          pickupAddress: 'DEMO — 18, Demo Residency Road (open queue, unassigned)',
          emergencyDescription: 'Simulated request: elderly resident reporting breathing difficulty.',
          status: AmbulanceRequestStatus.REQUESTED,
        },
      });
      await tx.ambulanceRequest.create({
        data: {
          citizenId: citizenB.id,
          ambulanceId: blsVehicle.id,
          pickupLatitude: 12.9702,
          pickupLongitude: 77.6435,
          pickupAddress: 'DEMO — 62, Demo Garden Cross',
          emergencyDescription: 'Simulated request: road traffic incident, suspected limb fracture.',
          status: AmbulanceRequestStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });
      await tx.ambulanceRequest.create({
        data: {
          citizenId: citizenA.id,
          ambulanceId: alsVehicle.id,
          pickupLatitude: 12.9588,
          pickupLongitude: 77.6501,
          pickupAddress: 'DEMO — 4, Demo Civic Layout',
          emergencyDescription: 'Simulated request: completed transfer to casualty.',
          status: AmbulanceRequestStatus.COMPLETED,
          respondedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
      });
      console.log('✅ Created 3 ambulance requests (1 unassigned open-queue, 1 accepted, 1 completed).');

      // ---------------------------------------------------------------------
      // 8. Government schemes — genuine public policy, reproduced accurately.
      //    These are the only records here describing something real, which is
      //    why they are the only ones not marked simulated. Nothing about them
      //    asserts that any seeded facility participates.
      // ---------------------------------------------------------------------
      await tx.governmentScheme.createMany({
        data: [
          {
            createdById: authorityUser.id,
            title: 'Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana (PM-JAY)',
            description: 'Government-funded healthcare assurance scheme offering secondary and tertiary hospitalization coverage.',
            eligibilityCriteria: 'Families identified under the deprivation criteria of the Socio-Economic Caste Census (SECC) database.',
            benefits: 'Cashless health cover of up to ₹5,00,000 per family per year at empanelled public and private hospitals.',
            applicationUrl: 'https://pmjay.gov.in',
            category: 'Universal Health Coverage',
            documentsRequired: ['Aadhaar Card', 'Ration Card / BPL Card', 'Income Certificate'],
            isActive: true,
          },
          {
            createdById: authorityUser.id,
            title: 'Ayushman Bharat Health Account (ABHA Digital ID)',
            description: 'A 14-digit unique health identifier used to store, access and share longitudinal medical records with consent.',
            eligibilityCriteria: 'All Indian citizens with a valid Aadhaar or mobile number.',
            benefits: 'Paperless hospital registration, consent-based record sharing, interoperable diagnostic reports.',
            applicationUrl: 'https://healthid.abdm.gov.in',
            category: 'Digital Health Infrastructure',
            documentsRequired: ['Aadhaar Card or Driving Licence', 'Linked mobile number for OTP'],
            isActive: true,
          },
          {
            createdById: authorityUser.id,
            title: 'Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP)',
            description: 'Initiative providing quality generic medicines at subsidised prices through dedicated Janaushadhi Kendras.',
            eligibilityCriteria: 'Open to all citizens; no income ceiling applies.',
            benefits: 'Access to a wide range of essential generic medicines and surgical items at substantially lower prices than branded equivalents.',
            applicationUrl: 'https://janaushadhi.gov.in',
            category: 'Affordable Medicines',
            documentsRequired: ['Doctor Prescription'],
            isActive: true,
          },
          {
            createdById: authorityUser.id,
            title: 'Rashtriya Arogya Nidhi (RAN)',
            description: 'Financial assistance for patients below the poverty line suffering from major life-threatening diseases, treated at government super-specialty hospitals.',
            eligibilityCriteria: 'BPL patients undergoing treatment for critical ailments (cancer, cardiac, renal, neurological) at government super-specialty institutions.',
            benefits: 'One-time grant sanctioned directly to the treating government medical institution.',
            applicationUrl: 'https://mohfw.gov.in',
            category: 'Critical Illness Relief',
            documentsRequired: ['BPL Certificate', 'Hospital Treatment Cost Estimate', 'Income Proof'],
            isActive: true,
          },
        ],
      });
      console.log('✅ Created 4 government schemes (genuine public policy).');

      // ---------------------------------------------------------------------
      // 9. Emergency alerts. Generic public-health advisories attributed to the
      //    demo authority account — no real authority is named.
      // ---------------------------------------------------------------------
      await tx.emergencyAlert.createMany({
        data: [
          {
            createdById: authorityUser.id,
            title: 'DEMO — Heatwave Advisory (Level Yellow)',
            description: 'Simulated advisory. Residents, particularly older adults and infants, are advised to avoid direct sun exposure during peak afternoon hours and to stay hydrated.',
            severity: AlertSeverity.HIGH,
            affectedArea: 'DEMO — Northern and Eastern Demo Zones',
            isActive: true,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          {
            createdById: authorityUser.id,
            title: 'DEMO — Seasonal Vector-Borne Illness / Platelet Readiness',
            description: 'Simulated advisory. Voluntary donors of O+ and B+ types are encouraged to contact a licensed blood centre regarding platelet donation.',
            severity: AlertSeverity.MEDIUM,
            affectedArea: 'DEMO — Southern and Eastern Demo Zones',
            isActive: true,
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
          {
            createdById: authorityUser.id,
            title: 'DEMO — Expired Water Contamination Notice',
            description: 'Simulated advisory retained in an inactive state so that alert filtering by isActive has something to exclude.',
            severity: AlertSeverity.CRITICAL,
            affectedArea: 'DEMO — Central Demo Zone',
            isActive: false,
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        ],
      });
      console.log('✅ Created 3 emergency alerts (2 active, 1 expired/inactive).');

      // ---------------------------------------------------------------------
      // 10. Complaints. Two citizens filing against two different DEMO
      //     organisations — this is what makes "citizen A must not be able to
      //     read citizen B's complaint" a testable claim.
      // ---------------------------------------------------------------------
      await tx.complaint.create({
        data: {
          citizenId: citizenA.id,
          organizationId: northside.id,
          category: 'Waiting Time',
          description: 'Simulated grievance: extended wait before emergency triage assessment.',
          status: ComplaintStatus.UNDER_REVIEW,
        },
      });
      await tx.complaint.create({
        data: {
          citizenId: citizenB.id,
          organizationId: lakeview.id,
          category: 'Billing Transparency',
          description: 'Simulated grievance: itemised billing breakdown not provided on discharge.',
          status: ComplaintStatus.PENDING,
        },
      });
      await tx.complaint.create({
        data: {
          citizenId: citizenB.id,
          organizationId: greenfieldPharmacy.id,
          category: 'Stock Availability',
          description: 'Simulated grievance: listed medicine shown in stock was unavailable on arrival.',
          status: ComplaintStatus.RESOLVED,
          resolutionNotes: 'Simulated resolution: stock counts re-synchronised by the operator.',
          resolvedById: adminUser.id,
          resolvedAt: new Date(),
        },
      });
      console.log('✅ Created 3 complaints across 2 citizens and 3 organisations.');

      // ---------------------------------------------------------------------
      // 11. Notifications and an audit entry. Both tables were previously
      //     seeded with nothing at all.
      // ---------------------------------------------------------------------
      await tx.notification.createMany({
        data: [
          { userId: citizenA.id, title: 'DEMO — Complaint received', message: 'Your simulated complaint is under review.', type: 'INFO', isRead: false },
          { userId: citizenA.id, title: 'DEMO — Ambulance dispatched', message: 'A simulated ambulance has been assigned to your request.', type: 'SUCCESS', isRead: true },
          { userId: citizenB.id, title: 'DEMO — Complaint resolved', message: 'Your simulated complaint has been marked resolved.', type: 'SUCCESS', isRead: false },
          { userId: hospitalP.id, title: 'DEMO — Verification approved', message: 'Northside General Hospital has been approved.', type: 'SUCCESS', isRead: true },
        ],
      });

      await tx.auditLog.create({
        data: {
          userId: adminUser.id,
          action: 'ORGANIZATION_VERIFIED',
          entityType: 'Organization',
          entityId: northside.id,
          newValues: { verificationStatus: VerificationStatus.APPROVED } as Prisma.InputJsonValue,
          ipAddress: '127.0.0.1',
        },
      });
      console.log('✅ Created 4 notifications and 1 audit log entry.');

      // Referenced so the linter does not flag them as unused; they exist to
      // document the seeded graph.
      void civicMemorial;
      void sunriseNgo;
    },
    { maxWait: 15_000, timeout: 120_000 },
  );

  // Proof, read back from the database rather than assumed: the generated
  // column must have been populated by PostgreSQL for every organisation.
  const [check] = await prisma.$queryRaw<Array<{ total: bigint; with_location: bigint; simulated: bigint }>>`
    SELECT COUNT(*)                                        AS total,
           COUNT("location")                               AS with_location,
           COUNT(*) FILTER (WHERE "is_simulated" IS TRUE)  AS simulated
    FROM "organizations"
  `;
  console.log(
    `🔎 organizations: total=${check.total}, location populated=${check.with_location}, is_simulated=${check.simulated}`,
  );
  if (check.total !== check.with_location || check.total !== check.simulated) {
    throw new Error('Seed verification failed: every organisation must have a generated location and is_simulated = true.');
  }

  console.log('🎉 Seed complete — all seeded facilities are SIMULATED demonstration data.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
