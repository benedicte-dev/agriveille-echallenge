-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FARMER', 'BUYER', 'AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('fr', 'fon', 'yo');

-- CreateEnum
CREATE TYPE "AgroZone" AS ENUM ('PDA1', 'PDA2', 'PDA3', 'PDA4', 'PDA5', 'PDA6', 'PDA7');

-- CreateEnum
CREATE TYPE "PestKind" AS ENUM ('PEST', 'DISEASE');

-- CreateEnum
CREATE TYPE "PlantingStatus" AS ENUM ('PLANNED', 'GROWING', 'HARVESTED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('DROUGHT', 'HEAVY_RAIN', 'HEAT', 'WIND', 'PEST_RISK', 'PEST_OUTBREAK', 'SOWING_WINDOW', 'HARVEST_WINDOW');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertSource" AS ENUM ('AUTO_WEATHER', 'PEST_REPORT', 'AGENT_MANUAL');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('IN_APP', 'SMS_SIM', 'USSD_SIM', 'PUSH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'READ', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Market" AS ENUM ('LOCAL', 'EXPORT');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('OPEN', 'RESERVED', 'SOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LevyBasis" AS ENUM ('PER_KG', 'PERCENT_VALUE', 'FLAT');

-- CreateEnum
CREATE TYPE "DeclarationStatus" AS ENUM ('SUBMITTED', 'PAID', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RegulationCategory" AS ENUM ('PHYTO', 'SEEDS', 'EXPORT', 'TAX', 'LAND', 'ORGANIC');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FARMER',
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "communeId" TEXT,
    "organization" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "agroZone" "AgroZone" NOT NULL,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameFon" TEXT,
    "nameYo" TEXT,
    "icon" TEXT NOT NULL,
    "cycleDays" INTEGER NOT NULL,
    "sowingMonths" INTEGER[],
    "harvestMonths" INTEGER[],
    "minRainMm" INTEGER NOT NULL,
    "optimalTempMin" DOUBLE PRECISION NOT NULL,
    "optimalTempMax" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pest" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameFon" TEXT,
    "nameYo" TEXT,
    "kind" "PestKind" NOT NULL,
    "symptomsFr" TEXT NOT NULL,
    "symptomsFon" TEXT,
    "symptomsYo" TEXT,
    "preventionFr" TEXT NOT NULL,
    "preventionFon" TEXT,
    "preventionYo" TEXT,
    "treatmentFr" TEXT NOT NULL,
    "treatmentFon" TEXT,
    "treatmentYo" TEXT,
    "riskTempMin" DOUBLE PRECISION,
    "riskTempMax" DOUBLE PRECISION,
    "riskHumidityMin" DOUBLE PRECISION,
    "imageKey" TEXT,

    CONSTRAINT "Pest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "communeId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "areaHa" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planting" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "sowingDate" TIMESTAMP(3) NOT NULL,
    "expectedHarvestDate" TIMESTAMP(3) NOT NULL,
    "status" "PlantingStatus" NOT NULL DEFAULT 'PLANNED',
    "estimatedYieldKg" INTEGER,

    CONSTRAINT "Planting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherSnapshot" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'open-meteo',
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "source" "AlertSource" NOT NULL,
    "titleFr" TEXT NOT NULL,
    "titleFon" TEXT,
    "titleYo" TEXT,
    "messageFr" TEXT NOT NULL,
    "messageFon" TEXT,
    "messageYo" TEXT,
    "adviceFr" TEXT,
    "adviceFon" TEXT,
    "adviceYo" TEXT,
    "parcelId" TEXT,
    "communeId" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "radiusKm" DOUBLE PRECISION,
    "pestId" TEXT,
    "reportId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupKey" TEXT NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PestReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "parcelId" TEXT,
    "communeId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "pestId" TEXT,
    "description" TEXT,
    "voiceTranscript" TEXT,
    "voiceLang" TEXT,
    "photo" BYTEA,
    "photoMime" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT,

    CONSTRAINT "PestReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "quantityKg" INTEGER NOT NULL,
    "pricePerKgFcfa" INTEGER NOT NULL,
    "market" "Market" NOT NULL,
    "communeId" TEXT NOT NULL,
    "availableFrom" TIMESTAMP(3) NOT NULL,
    "qualityNote" TEXT,
    "certification" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "quantityKg" INTEGER NOT NULL,
    "pricePerKgFcfa" INTEGER NOT NULL,
    "message" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferencePrice" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "communeId" TEXT,
    "market" "Market" NOT NULL,
    "pricePerKgFcfa" INTEGER NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferencePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevyRate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "labelFon" TEXT,
    "labelYo" TEXT,
    "basis" "LevyBasis" NOT NULL,
    "rate" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LevyRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Declaration" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "levyRateId" TEXT NOT NULL,
    "cropId" TEXT,
    "quantityKg" INTEGER,
    "declaredValueFcfa" INTEGER,
    "amountDueFcfa" INTEGER NOT NULL,
    "status" "DeclarationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "receiptNumber" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Declaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Regulation" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "RegulationCategory" NOT NULL,
    "titleFr" TEXT NOT NULL,
    "titleFon" TEXT,
    "titleYo" TEXT,
    "summaryFr" TEXT NOT NULL,
    "summaryFon" TEXT,
    "summaryYo" TEXT,
    "bodyFr" TEXT NOT NULL,
    "bodyFon" TEXT,
    "bodyYo" TEXT,
    "sourceRef" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Regulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsOutbox" (
    "id" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "alertId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranslationCache" (
    "id" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranslationCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioCache" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CropToPest" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CropToPest_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_communeId_idx" ON "User"("communeId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "Commune_name_key" ON "Commune"("name");

-- CreateIndex
CREATE INDEX "Commune_department_idx" ON "Commune"("department");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_slug_key" ON "Crop"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Pest_slug_key" ON "Pest"("slug");

-- CreateIndex
CREATE INDEX "Parcel_ownerId_idx" ON "Parcel"("ownerId");

-- CreateIndex
CREATE INDEX "Parcel_communeId_idx" ON "Parcel"("communeId");

-- CreateIndex
CREATE INDEX "Planting_parcelId_status_idx" ON "Planting"("parcelId", "status");

-- CreateIndex
CREATE INDEX "Planting_status_expectedHarvestDate_idx" ON "Planting"("status", "expectedHarvestDate");

-- CreateIndex
CREATE INDEX "WeatherSnapshot_parcelId_fetchedAt_idx" ON "WeatherSnapshot"("parcelId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_dedupKey_key" ON "Alert"("dedupKey");

-- CreateIndex
CREATE INDEX "Alert_parcelId_createdAt_idx" ON "Alert"("parcelId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_communeId_createdAt_idx" ON "Alert"("communeId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_validUntil_idx" ON "Alert"("validUntil");

-- CreateIndex
CREATE INDEX "Alert_type_createdAt_idx" ON "Alert"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AlertDelivery_userId_status_idx" ON "AlertDelivery"("userId", "status");

-- CreateIndex
CREATE INDEX "AlertDelivery_alertId_status_idx" ON "AlertDelivery"("alertId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AlertDelivery_alertId_userId_channel_key" ON "AlertDelivery"("alertId", "userId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "PestReport_clientId_key" ON "PestReport"("clientId");

-- CreateIndex
CREATE INDEX "PestReport_status_createdAt_idx" ON "PestReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PestReport_communeId_createdAt_idx" ON "PestReport"("communeId", "createdAt");

-- CreateIndex
CREATE INDEX "PestReport_reporterId_createdAt_idx" ON "PestReport"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "Listing_status_cropId_idx" ON "Listing"("status", "cropId");

-- CreateIndex
CREATE INDEX "Listing_status_market_createdAt_idx" ON "Listing"("status", "market", "createdAt");

-- CreateIndex
CREATE INDEX "Listing_sellerId_createdAt_idx" ON "Listing"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "Offer_listingId_status_idx" ON "Offer"("listingId", "status");

-- CreateIndex
CREATE INDEX "Offer_buyerId_createdAt_idx" ON "Offer"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferencePrice_cropId_market_observedAt_idx" ON "ReferencePrice"("cropId", "market", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LevyRate_code_key" ON "LevyRate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Declaration_receiptNumber_key" ON "Declaration"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Declaration_verificationCode_key" ON "Declaration"("verificationCode");

-- CreateIndex
CREATE INDEX "Declaration_farmerId_createdAt_idx" ON "Declaration"("farmerId", "createdAt");

-- CreateIndex
CREATE INDEX "Declaration_status_createdAt_idx" ON "Declaration"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Regulation_slug_key" ON "Regulation"("slug");

-- CreateIndex
CREATE INDEX "Regulation_category_published_idx" ON "Regulation"("category", "published");

-- CreateIndex
CREATE INDEX "SmsOutbox_createdAt_idx" ON "SmsOutbox"("createdAt");

-- CreateIndex
CREATE INDEX "SmsOutbox_toPhone_createdAt_idx" ON "SmsOutbox"("toPhone", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationCache_sourceHash_key" ON "TranslationCache"("sourceHash");

-- CreateIndex
CREATE UNIQUE INDEX "AudioCache_key_key" ON "AudioCache"("key");

-- CreateIndex
CREATE INDEX "_CropToPest_B_index" ON "_CropToPest"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planting" ADD CONSTRAINT "Planting_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planting" ADD CONSTRAINT "Planting_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherSnapshot" ADD CONSTRAINT "WeatherSnapshot_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_pestId_fkey" FOREIGN KEY ("pestId") REFERENCES "Pest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "PestReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PestReport" ADD CONSTRAINT "PestReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PestReport" ADD CONSTRAINT "PestReport_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PestReport" ADD CONSTRAINT "PestReport_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PestReport" ADD CONSTRAINT "PestReport_pestId_fkey" FOREIGN KEY ("pestId") REFERENCES "Pest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PestReport" ADD CONSTRAINT "PestReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferencePrice" ADD CONSTRAINT "ReferencePrice_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferencePrice" ADD CONSTRAINT "ReferencePrice_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Declaration" ADD CONSTRAINT "Declaration_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Declaration" ADD CONSTRAINT "Declaration_levyRateId_fkey" FOREIGN KEY ("levyRateId") REFERENCES "LevyRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Declaration" ADD CONSTRAINT "Declaration_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Declaration" ADD CONSTRAINT "Declaration_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsOutbox" ADD CONSTRAINT "SmsOutbox_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CropToPest" ADD CONSTRAINT "_CropToPest_A_fkey" FOREIGN KEY ("A") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CropToPest" ADD CONSTRAINT "_CropToPest_B_fkey" FOREIGN KEY ("B") REFERENCES "Pest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
