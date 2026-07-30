-- AlterTable
ALTER TABLE "Annotation" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "learningSummary" TEXT,
ADD COLUMN     "publicSlug" VARCHAR(32),
ADD COLUMN     "publicViewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedById" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Session_publicSlug_key" ON "Session"("publicSlug");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

