-- PostGIS must exist before any geography(Point, 4326) column is created below.
-- Kept here, in migration SQL, rather than declared via the `postgresqlExtensions`
-- preview feature: that feature makes Prisma diff the database's full extension
-- list, and the postgis/postgis image ships three extensions beyond this one,
-- which it then reports as drift and tries to resolve with a destructive reset.
-- IF NOT EXISTS makes this a no-op against the already-provisioned dev database
-- while still creating the extension in the shadow database and in any fresh
-- environment.
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CITIZEN', 'HOSPITAL', 'BLOOD_BANK', 'PHARMACY', 'AMBULANCE', 'NGO', 'AUTHORITY', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('HOSPITAL', 'BLOOD_BANK', 'PHARMACY', 'AMBULANCE_PROVIDER', 'NGO');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('SIMULATED', 'PUBLIC_DIRECTORY', 'SELF_REPORTED', 'VERIFIED_INTEGRATION');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "AmbulanceStatus" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "AmbulanceRequestStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CITIZEN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "location" geography(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography) STORED,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "license_number" TEXT,
    "rejection_reason" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by_id" UUID,
    "is_simulated" BOOLEAN NOT NULL DEFAULT true,
    "data_source" "DataSource" NOT NULL DEFAULT 'SIMULATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_details" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "total_beds" INTEGER NOT NULL DEFAULT 0,
    "available_general_beds" INTEGER NOT NULL DEFAULT 0,
    "available_icu_beds" INTEGER NOT NULL DEFAULT 0,
    "emergency_available" BOOLEAN NOT NULL DEFAULT true,
    "has_oxygen_support" BOOLEAN NOT NULL DEFAULT true,
    "has_ventilators" BOOLEAN NOT NULL DEFAULT true,
    "departments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "operating_hours" TEXT NOT NULL DEFAULT '24/7',
    "availability_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_bank_inventory" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "blood_type" "BloodType" NOT NULL,
    "units_available" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_bank_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_medicines" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "medicine_name" TEXT NOT NULL,
    "generic_name" TEXT,
    "category" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulance_details" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "vehicle_number" TEXT NOT NULL,
    "vehicle_type" TEXT NOT NULL DEFAULT 'Basic Life Support',
    "status" "AmbulanceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "contact_number" TEXT NOT NULL,
    "driver_name" TEXT,
    "status_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambulance_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulance_requests" (
    "id" UUID NOT NULL,
    "citizen_id" UUID NOT NULL,
    "ambulance_id" UUID,
    "pickup_latitude" DOUBLE PRECISION NOT NULL,
    "pickup_longitude" DOUBLE PRECISION NOT NULL,
    "pickup_address" TEXT NOT NULL,
    "emergency_description" TEXT NOT NULL,
    "status" "AmbulanceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ambulance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "government_schemes" (
    "id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eligibility_criteria" TEXT NOT NULL,
    "benefits" TEXT NOT NULL,
    "application_url" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "documents_required" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "government_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "citizen_id" UUID NOT NULL,
    "organization_id" UUID,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachment_url" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'PENDING',
    "resolution_notes" TEXT,
    "resolved_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_alerts" (
    "id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'HIGH',
    "affected_area" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "emergency_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "user_message" TEXT NOT NULL,
    "ai_response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "organizations_type_idx" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "organizations_city_idx" ON "organizations"("city");

-- CreateIndex
CREATE INDEX "organizations_verification_status_idx" ON "organizations"("verification_status");

-- CreateIndex
CREATE INDEX "organizations_is_simulated_idx" ON "organizations"("is_simulated");

-- CreateIndex
CREATE INDEX "organizations_location_idx" ON "organizations" USING GIST ("location");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_details_org_id_key" ON "hospital_details"("org_id");

-- CreateIndex
CREATE INDEX "hospital_details_available_general_beds_idx" ON "hospital_details"("available_general_beds");

-- CreateIndex
CREATE INDEX "hospital_details_available_icu_beds_idx" ON "hospital_details"("available_icu_beds");

-- CreateIndex
CREATE INDEX "hospital_details_emergency_available_idx" ON "hospital_details"("emergency_available");

-- CreateIndex
CREATE INDEX "blood_bank_inventory_blood_type_units_available_idx" ON "blood_bank_inventory"("blood_type", "units_available");

-- CreateIndex
CREATE UNIQUE INDEX "blood_bank_inventory_org_id_blood_type_key" ON "blood_bank_inventory"("org_id", "blood_type");

-- CreateIndex
CREATE INDEX "pharmacy_medicines_medicine_name_idx" ON "pharmacy_medicines"("medicine_name");

-- CreateIndex
CREATE INDEX "pharmacy_medicines_generic_name_idx" ON "pharmacy_medicines"("generic_name");

-- CreateIndex
CREATE INDEX "pharmacy_medicines_in_stock_idx" ON "pharmacy_medicines"("in_stock");

-- CreateIndex
CREATE INDEX "ambulance_details_status_idx" ON "ambulance_details"("status");

-- CreateIndex
CREATE INDEX "ambulance_requests_status_idx" ON "ambulance_requests"("status");

-- CreateIndex
CREATE INDEX "ambulance_requests_citizen_id_idx" ON "ambulance_requests"("citizen_id");

-- CreateIndex
CREATE INDEX "government_schemes_category_idx" ON "government_schemes"("category");

-- CreateIndex
CREATE INDEX "government_schemes_is_active_idx" ON "government_schemes"("is_active");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE INDEX "complaints_citizen_id_idx" ON "complaints"("citizen_id");

-- CreateIndex
CREATE INDEX "complaints_organization_id_idx" ON "complaints"("organization_id");

-- CreateIndex
CREATE INDEX "emergency_alerts_severity_idx" ON "emergency_alerts"("severity");

-- CreateIndex
CREATE INDEX "emergency_alerts_is_active_idx" ON "emergency_alerts"("is_active");

-- CreateIndex
CREATE INDEX "ai_chat_history_user_id_idx" ON "ai_chat_history"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_details" ADD CONSTRAINT "hospital_details_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_bank_inventory" ADD CONSTRAINT "blood_bank_inventory_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_medicines" ADD CONSTRAINT "pharmacy_medicines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_details" ADD CONSTRAINT "ambulance_details_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_requests" ADD CONSTRAINT "ambulance_requests_citizen_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_requests" ADD CONSTRAINT "ambulance_requests_ambulance_id_fkey" FOREIGN KEY ("ambulance_id") REFERENCES "ambulance_details"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "government_schemes" ADD CONSTRAINT "government_schemes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_citizen_id_fkey" FOREIGN KEY ("citizen_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_alerts" ADD CONSTRAINT "emergency_alerts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_history" ADD CONSTRAINT "ai_chat_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
