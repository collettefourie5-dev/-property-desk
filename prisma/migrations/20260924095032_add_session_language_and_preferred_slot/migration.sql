-- CreateEnum
CREATE TYPE "SessionLanguage" AS ENUM ('ENGLISH', 'AFRIKAANS');

-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "preferredSlotId" TEXT,
ADD COLUMN     "sessionLanguage" "SessionLanguage";
