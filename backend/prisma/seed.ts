import { PrismaClient, Role, OrgType, VerificationStatus, BloodType, AmbulanceStatus, ComplaintStatus, AlertSeverity } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting CivicConnect Database Seed...');

  // 1. Clean existing records (in dependency order)
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.aIChatHistory.deleteMany();
  await prisma.emergencyAlert.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.governmentScheme.deleteMany();
  await prisma.ambulanceRequest.deleteMany();
  await prisma.ambulanceDetail.deleteMany();
  await prisma.pharmacyMedicine.deleteMany();
  await prisma.bloodBankInventory.deleteMany();
  await prisma.hospitalDetail.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing database tables.');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 2. Create Master Users for all 8 Roles
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@civicconnect.org',
      passwordHash,
      name: 'Dr. Ramesh Sharma',
      phone: '+919876543210',
      role: Role.ADMIN,
      isActive: true,
      isVerified: true,
    },
  });

  const authorityUser = await prisma.user.create({
    data: {
      email: 'health.dept@karnataka.gov.in',
      passwordHash,
      name: 'District Health Officer (Bengaluru Urban)',
      phone: '+919876543211',
      role: Role.AUTHORITY,
      isActive: true,
      isVerified: true,
    },
  });

  const citizenUser = await prisma.user.create({
    data: {
      email: 'citizen@example.com',
      passwordHash,
      name: 'Priya Sundaram',
      phone: '+919876543212',
      role: Role.CITIZEN,
      isActive: true,
      isVerified: true,
    },
  });

  const hospitalUser = await prisma.user.create({
    data: {
      email: 'admin@manipalhospitals.com',
      passwordHash,
      name: 'Manipal Health Operations',
      phone: '+919876543213',
      role: Role.HOSPITAL,
      isActive: true,
      isVerified: true,
    },
  });

  const bloodBankUser = await prisma.user.create({
    data: {
      email: 'contact@redcrossbangalore.org',
      passwordHash,
      name: 'Indian Red Cross Society Karnataka',
      phone: '+919876543214',
      role: Role.BLOOD_BANK,
      isActive: true,
      isVerified: true,
    },
  });

  const pharmacyUser = await prisma.user.create({
    data: {
      email: 'koramangala@apollopharmacy.org',
      passwordHash,
      name: 'Apollo Pharmacy Lead',
      phone: '+919876543215',
      role: Role.PHARMACY,
      isActive: true,
      isVerified: true,
    },
  });

  const ambulanceUser = await prisma.user.create({
    data: {
      email: 'dispatch@stanplus.com',
      passwordHash,
      name: 'StanPlus Emergency Fleet Manager',
      phone: '+919876543216',
      role: Role.AMBULANCE,
      isActive: true,
      isVerified: true,
    },
  });

  const ngoUser = await prisma.user.create({
    data: {
      email: 'care@sevadrive.org',
      passwordHash,
      name: 'Seva Health Foundation',
      phone: '+919876543217',
      role: Role.NGO,
      isActive: true,
      isVerified: true,
    },
  });

  console.log('✅ Created 8 Master Role Users.');

  // 3. Create Verified Hospitals with Live Bed Capacities
  const manipalHospital = await prisma.organization.create({
    data: {
      userId: hospitalUser.id,
      name: 'Manipal Hospital (HAL Airport Road)',
      type: OrgType.HOSPITAL,
      description: 'Multi-specialty tertiary care hospital with 24/7 Level-1 Trauma Centre and Emergency Cardiac Care.',
      address: '98, HAL Old Airport Rd, Kodihalli',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560017',
      latitude: 12.9592,
      longitude: 77.6499,
      phone: '+91 80 2502 4444',
      email: 'info.hal@manipalhospitals.com',
      website: 'https://www.manipalhospitals.com',
      verificationStatus: VerificationStatus.APPROVED,
      licenseNumber: 'KAR-HOSP-2024-9841',
      verifiedById: adminUser.id,
      verifiedAt: new Date(),
      hospitalDetail: {
        create: {
          totalBeds: 450,
          availableGeneralBeds: 114,
          availableIcuBeds: 18,
          emergencyAvailable: true,
          hasOxygenSupport: true,
          hasVentilators: true,
          departments: ['Cardiology', 'Neurology', 'Oncology', 'Emergency Medicine', 'Pediatrics', 'Orthopedics'],
          services: ['24/7 Trauma Care', 'CT/MRI Scan', 'Dialysis Centre', 'Blood Bank', 'Pharmacy', 'Neonatal ICU'],
          operatingHours: '24/7',
          availabilityUpdatedAt: new Date(),
        },
      },
    },
  });

  const apolloHospital = await prisma.organization.create({
    data: {
      userId: adminUser.id,
      name: 'Apollo Hospital (Bannerghatta Road)',
      type: OrgType.HOSPITAL,
      description: 'JCI Accredited super specialty hospital featuring advanced Robotic Surgery and Coronary Care.',
      address: '154/11, Opp. IIMB, Bannerghatta Rd',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560076',
      latitude: 12.8948,
      longitude: 77.5989,
      phone: '+91 80 2630 4050',
      email: 'customercare_bangalore@apollohospitals.com',
      website: 'https://bangalore.apollohospitals.com',
      verificationStatus: VerificationStatus.APPROVED,
      licenseNumber: 'KAR-HOSP-2023-1102',
      verifiedById: adminUser.id,
      verifiedAt: new Date(),
      hospitalDetail: {
        create: {
          totalBeds: 350,
          availableGeneralBeds: 72,
          availableIcuBeds: 9,
          emergencyAvailable: true,
          hasOxygenSupport: true,
          hasVentilators: true,
          departments: ['Cardiology', 'Nephrology', 'Pulmonology', 'Gastroenterology', 'Urology'],
          services: ['Cath Lab', 'Organ Transplant', '24/7 Pharmacy', 'Ambulance Support', 'PET CT'],
          operatingHours: '24/7',
          availabilityUpdatedAt: new Date(),
        },
      },
    },
  });

  const victoriaHospital = await prisma.organization.create({
    data: {
      userId: authorityUser.id,
      name: 'Victoria Hospital (Govt. Medical College)',
      type: OrgType.HOSPITAL,
      description: 'Century-old premiere government hospital offering free and highly subsidized emergency care & trauma center.',
      address: 'Fort Rd, near City Market, Kalasipalya',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560002',
      latitude: 12.9629,
      longitude: 77.5753,
      phone: '+91 80 2670 1150',
      email: 'ms.victoria@karnataka.gov.in',
      website: 'https://bmc.gov.in',
      verificationStatus: VerificationStatus.APPROVED,
      licenseNumber: 'GOVT-KA-BMC-001',
      verifiedById: adminUser.id,
      verifiedAt: new Date(),
      hospitalDetail: {
        create: {
          totalBeds: 850,
          availableGeneralBeds: 215,
          availableIcuBeds: 32,
          emergencyAvailable: true,
          hasOxygenSupport: true,
          hasVentilators: true,
          departments: ['Emergency Trauma', 'General Surgery', 'General Medicine', 'Burns Unit', 'Orthopedics'],
          services: ['Free Emergency Ward', 'PM-JAY Scheme Desk', 'Govt Blood Bank', 'Anti-Rabies Clinic'],
          operatingHours: '24/7',
          availabilityUpdatedAt: new Date(),
        },
      },
    },
  });

  console.log('✅ Created Verified Hospitals.');

  // 4. Create Blood Banks with 8 Blood Groups
  const redCrossBloodBank = await prisma.organization.create({
    data: {
      userId: bloodBankUser.id,
      name: 'Indian Red Cross Society Blood Centre',
      type: OrgType.BLOOD_BANK,
      description: 'NABH-accredited voluntary blood bank supplying screened, component-separated blood units.',
      address: '26, Red Cross Bhavan, 1st Main Rd, Race Course',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      latitude: 12.9833,
      longitude: 77.5815,
      phone: '+91 80 2226 8435',
      email: 'bloodbank@redcrosskarnataka.org',
      website: 'https://redcrosskarnataka.org',
      verificationStatus: VerificationStatus.APPROVED,
      licenseNumber: 'BB-KA-BLR-019',
      verifiedById: adminUser.id,
      verifiedAt: new Date(),
    },
  });

  const bloodGroups: { type: BloodType; units: number }[] = [
    { type: BloodType.O_POSITIVE, units: 48 },
    { type: BloodType.O_NEGATIVE, units: 12 },
    { type: BloodType.A_POSITIVE, units: 35 },
    { type: BloodType.A_NEGATIVE, units: 8 },
    { type: BloodType.B_POSITIVE, units: 52 },
    { type: BloodType.B_NEGATIVE, units: 14 },
    { type: BloodType.AB_POSITIVE, units: 22 },
    { type: BloodType.AB_NEGATIVE, units: 6 },
  ];

  for (const bg of bloodGroups) {
    await prisma.bloodBankInventory.create({
      data: {
        orgId: redCrossBloodBank.id,
        bloodType: bg.type,
        unitsAvailable: bg.units,
        lastUpdated: new Date(),
      },
    });
  }

  const rotaryBloodBank = await prisma.organization.create({
    data: {
      userId: adminUser.id,
      name: 'Rotary Bangalore TTK Blood Centre',
      type: OrgType.BLOOD_BANK,
      description: 'Premier non-profit community blood centre specializing in rare blood group management and apheresis.',
      address: 'New Thippasandra Main Rd, HAL 3rd Stage',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560075',
      latitude: 12.9734,
      longitude: 77.6521,
      phone: '+91 80 2528 7903',
      email: 'blood@rotarybangalore.org',
      website: 'https://ttkrbb.org',
      verificationStatus: VerificationStatus.APPROVED,
      licenseNumber: 'BB-KA-BLR-054',
      verifiedById: adminUser.id,
      verifiedAt: new Date(),
    },
  });

  for (const bg of bloodGroups) {
    await prisma.bloodBankInventory.create({
      data: {
        orgId: rotaryBloodBank.id,
        bloodType: bg.type,
        unitsAvailable: Math.floor(bg.units * 0.8),
        lastUpdated: new Date(),
      },
    });
  }

  console.log('✅ Created Blood Banks with Full Inventory (8 Blood Types).');

  // 5. Create Pharmacies with Medicine Stock
  const apolloPharmacy = await prisma.organization.create({
    data: {
      userId: pharmacyUser.id,
      name: 'Apollo Pharmacy 24/7 (Koramangala 4th Block)',
      type: OrgType.PHARMACY,
      description: '24/7 open pharmacy stocking emergency prescription drugs, cardiac medications, and surgicals.',
      address: '423, 80 Feet Rd, 4th Block, Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
      latitude: 12.9345,
      longitude: 77.6255,
      phone: '+91 80 2553 9812',
      email: 'store423@apollopharmacy.org',
      website: 'https://www.apollopharmacy.in',
      verificationStatus: VerificationStatus.APPROVED,
      licenseNumber: 'PHARM-KA-BLR-7782',
      verifiedById: adminUser.id,
      verifiedAt: new Date(),
    },
  });

  const medicines = [
    { name: 'Paracetamol 650mg (Dolo 650)', generic: 'Paracetamol', category: 'Analgesic / Antipyretic', price: 32.5, inStock: true, qty: 500 },
    { name: 'Azithromycin 500mg (Azithral)', generic: 'Azithromycin', category: 'Antibiotic', price: 118.0, inStock: true, qty: 120 },
    { name: 'Amoxicillin + Clavulanate (Augmentin 625)', generic: 'Amoxicillin and Clavulanate Potassium', category: 'Antibiotic', price: 204.5, inStock: true, qty: 85 },
    { name: 'Telmisartan 40mg (Telma 40)', generic: 'Telmisartan', category: 'Anti-hypertensive (Blood Pressure)', price: 110.0, inStock: true, qty: 240 },
    { name: 'Metformin 500mg (Glycomet 500)', generic: 'Metformin Hydrochloride', category: 'Anti-diabetic', price: 42.0, inStock: true, qty: 310 },
    { name: 'Atorvastatin 10mg (Atorva 10)', generic: 'Atorvastatin', category: 'Cholesterol / Cardiovascular', price: 95.0, inStock: true, qty: 150 },
    { name: 'Pantoprazole 40mg (Pan 40)', generic: 'Pantoprazole', category: 'Gastrointestinal (Antacid)', price: 135.0, inStock: true, qty: 400 },
    { name: 'Salbutamol Inhaler (Asthalin 100mcg)', generic: 'Salbutamol', category: 'Respiratory / Asthma', price: 165.0, inStock: true, qty: 45 },
    { name: 'ORS Powder Sachets (Electral)', generic: 'Oral Rehydration Salts', category: 'Hydration / Emergency', price: 21.0, inStock: true, qty: 600 },
    { name: 'Insulin Glargine (Lantus Pen)', generic: 'Insulin Glargine', category: 'Diabetes / Critical', price: 780.0, inStock: true, qty: 25 },
  ];

  for (const med of medicines) {
    await prisma.pharmacyMedicine.create({
      data: {
        orgId: apolloPharmacy.id,
        medicineName: med.name,
        genericName: med.generic,
        category: med.category,
        price: med.price,
        inStock: med.inStock,
        quantity: med.qty,
        lastUpdated: new Date(),
      },
    });
  }

  console.log('✅ Created Pharmacies with Medicine Catalogs.');

  // 6. Create Ambulance Fleets
  const stanPlusAmbulanceOrg = await prisma.organization.create({
    data: {
      userId: ambulanceUser.id,
      name: 'StanPlus Red Emergency Ambulance Dispatch',
      type: OrgType.AMBULANCE_PROVIDER,
      description: 'Rapid response emergency medical transit provider equipped with GPS tracking and critical care paramedics.',
      address: 'Indiranagar 100ft Rd, HAL 2nd Stage',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      latitude: 12.9719,
      longitude: 77.6412,
      phone: '+91 80 4710 8888',
      email: 'dispatch.blr@stanplus.com',
      website: 'https://stanplus.com',
      verificationStatus: VerificationStatus.APPROVED,
      licenseNumber: 'AMB-KA-2024-009',
      verifiedById: adminUser.id,
      verifiedAt: new Date(),
    },
  });

  await prisma.ambulanceDetail.createMany({
    data: [
      {
        orgId: stanPlusAmbulanceOrg.id,
        vehicleNumber: 'KA-01-EA-1088',
        vehicleType: 'Advanced Life Support (ALS) with Ventilator',
        status: AmbulanceStatus.AVAILABLE,
        contactNumber: '+91 80 4710 8888',
        driverName: 'Manjunath Gowda (Paramedic Certified)',
      },
      {
        orgId: stanPlusAmbulanceOrg.id,
        vehicleNumber: 'KA-01-EA-2045',
        vehicleType: 'Basic Life Support (BLS)',
        status: AmbulanceStatus.AVAILABLE,
        contactNumber: '+91 80 4710 8889',
        driverName: 'Suresh Kumar',
      },
      {
        orgId: stanPlusAmbulanceOrg.id,
        vehicleNumber: 'KA-01-EA-3120',
        vehicleType: 'Patient Transport Ambulance (PTA)',
        status: AmbulanceStatus.BUSY,
        contactNumber: '+91 80 4710 8890',
        driverName: 'Raghavendra Prasad',
      },
    ],
  });

  console.log('✅ Created Ambulance Providers & Vehicle Fleets.');

  // 7. Create Government Health Schemes
  await prisma.governmentScheme.createMany({
    data: [
      {
        createdById: authorityUser.id,
        title: 'Ayushman Bharat — Pradhan Mantri Jan Arogya Yojana (PM-JAY)',
        description: 'World largest government-funded healthcare assurance scheme offering secondary and tertiary hospitalization coverage.',
        eligibilityCriteria: 'Families categorized under deprivation criteria as per Socio-Economic Caste Census (SECC) database and active BPL card holders.',
        benefits: 'Cashless health insurance coverage of up to ₹5,00,000 per family per year across empaneled public and private hospitals across India.',
        applicationUrl: 'https://pmjay.gov.in',
        category: 'Universal Health Coverage',
        documentsRequired: ['Aadhaar Card', 'Ration Card / BPL Card', 'Income Certificate'],
        isActive: true,
      },
      {
        createdById: authorityUser.id,
        title: 'Ayushman Bharat Health Account (ABHA Digital ID)',
        description: 'A 14-digit unique health identifier to store, access, and securely share longitudinal medical records across healthcare providers.',
        eligibilityCriteria: 'All Indian citizens with a valid Aadhaar or mobile number.',
        benefits: 'Paperless hospital registrations, consent-based medical records sharing, interoperable diagnostic reports.',
        applicationUrl: 'https://healthid.abdm.gov.in',
        category: 'Digital Health Infrastructure',
        documentsRequired: ['Aadhaar Card or Driving License', 'Linked Mobile for OTP'],
        isActive: true,
      },
      {
        createdById: authorityUser.id,
        title: 'Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP)',
        description: 'Initiative to provide high-quality generic medicines to the public at deeply subsidized prices through dedicated Kendras.',
        eligibilityCriteria: 'Open to all citizens without any income ceiling.',
        benefits: 'Access to over 1,800 essential medicines and 280 surgical items at 50% to 90% cheaper prices than branded market equivalents.',
        applicationUrl: 'http://janaushadhi.gov.in',
        category: 'Affordable Medicines',
        documentsRequired: ['Doctor Prescription'],
        isActive: true,
      },
      {
        createdById: authorityUser.id,
        title: 'Rashtriya Arogya Nidhi (RAN)',
        description: 'Financial assistance scheme for patients suffering from major life-threatening diseases receiving treatment in government super-specialty hospitals.',
        eligibilityCriteria: 'Patients living below the poverty line (BPL) suffering from critical ailments (Cancer, Cardiac, Kidney, Neuro).',
        benefits: 'One-time grant up to ₹15,00,000 directly sanctioned to the treating government medical institute.',
        applicationUrl: 'https://mohfw.gov.in',
        category: 'Critical Illness Relief',
        documentsRequired: ['BPL Certificate', 'Hospital Treatment Cost Estimate', 'Income Proof'],
        isActive: true,
      },
    ],
  });

  console.log('✅ Created Official Government Health Schemes.');

  // 8. Create Emergency Health Alerts
  await prisma.emergencyAlert.createMany({
    data: [
      {
        createdById: authorityUser.id,
        title: '⚠️ Heatwave Advisory & Hydration Directives (Level Yellow)',
        description: 'District Health Authority advises citizens, especially seniors and infants, to avoid direct sun exposure between 12 PM - 3:30 PM. Civic ORS kiosks active at major transit points.',
        severity: AlertSeverity.HIGH,
        affectedArea: 'Bengaluru Urban & Rural Districts',
        isActive: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        createdById: authorityUser.id,
        title: '📢 Seasonal Vector-Borne Disease / Dengue Platelet Readiness Call',
        description: 'Voluntary blood donors with O+ and B+ types are encouraged to visit licensed blood centres for single donor platelet (SDP) apheresis.',
        severity: AlertSeverity.MEDIUM,
        affectedArea: 'South Zone & East Zone, Bengaluru',
        isActive: true,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log('✅ Created Emergency Health Alerts.');

  // 9. Create Sample Citizen Complaints & Grievance Trail
  await prisma.complaint.create({
    data: {
      citizenId: citizenUser.id,
      organizationId: manipalHospital.id,
      category: 'Billing Transparency & Waiting Time',
      description: 'Encountered over 45 minutes delay in emergency room triage despite having severe chest discomfort.',
      status: ComplaintStatus.UNDER_REVIEW,
      resolutionNotes: 'Hospital nodal grievance officer assigned to investigate emergency intake queue logs on the specified date.',
    },
  });

  console.log('🎉 CivicConnect Database Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
