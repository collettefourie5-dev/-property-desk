/*
  Warnings:

  - You are about to drop the column `docReminderSentAt` on the `booking` table. All the data in the column will be lost.
  - You are about to drop the `booking_document` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "booking_document" DROP CONSTRAINT "booking_document_bookingId_fkey";

-- AlterTable
ALTER TABLE "booking" DROP COLUMN "docReminderSentAt";

-- DropTable
DROP TABLE "booking_document";
