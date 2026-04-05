-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'administrator', 'revisioner', 'teacher', 'student');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "baseRole" "Role" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "preferredLang" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseRole" "Role" NOT NULL,
    "activeRoleMode" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edit_candidates" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "sceneId" TEXT,
    "stepId" TEXT,
    "locationKey" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "candidateType" TEXT NOT NULL,
    "originalValue" TEXT NOT NULL,
    "proposedValue" TEXT NOT NULL,
    "languageCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "authorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "publishVersionId" TEXT,

    CONSTRAINT "edit_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_versions" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publish_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "app_sessions_userId_idx" ON "app_sessions"("userId");

-- CreateIndex
CREATE INDEX "edit_candidates_lessonId_status_idx" ON "edit_candidates"("lessonId", "status");

-- CreateIndex
CREATE INDEX "edit_candidates_authorUserId_idx" ON "edit_candidates"("authorUserId");

-- CreateIndex
CREATE INDEX "publish_versions_lessonId_isActive_idx" ON "publish_versions"("lessonId", "isActive");

-- CreateIndex
CREATE INDEX "audit_events_actorUserId_idx" ON "audit_events"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_events_targetType_targetId_idx" ON "audit_events"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "app_sessions" ADD CONSTRAINT "app_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edit_candidates" ADD CONSTRAINT "edit_candidates_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edit_candidates" ADD CONSTRAINT "edit_candidates_publishVersionId_fkey" FOREIGN KEY ("publishVersionId") REFERENCES "publish_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
