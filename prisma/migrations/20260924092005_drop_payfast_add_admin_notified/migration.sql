/*
  Warnings:

  - You are about to drop the column `payfastPaymentId` on the `booking` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "booking" DROP COLUMN "payfastPaymentId",
ADD COLUMN     "adminNotifiedAt" TIMESTAMP(3);
