-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('practice', 'race');

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "type" "SessionType" NOT NULL DEFAULT 'practice',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "venue" VARCHAR(100),
    "notes" TEXT,
    "marks" JSONB,
    "legs" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'team',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" INTEGER NOT NULL,
    "uploaderId" INTEGER NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "boatLabel" VARCHAR(50) NOT NULL,
    "startSec" INTEGER NOT NULL,
    "pointCount" INTEGER NOT NULL,
    "gridJson" JSONB NOT NULL,
    "rawGpx" TEXT NOT NULL,
    "sourceApp" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "tSec" INTEGER NOT NULL,
    "trackId" INTEGER,
    "legIndex" INTEGER,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_teamId_startedAt_idx" ON "Session"("teamId", "startedAt");

-- CreateIndex
CREATE INDEX "Annotation_sessionId_tSec_idx" ON "Annotation"("sessionId", "tSec");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;
