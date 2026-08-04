-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "uploaderId" INTEGER;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
