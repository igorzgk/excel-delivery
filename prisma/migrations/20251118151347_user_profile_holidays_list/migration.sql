/*
  Warnings:

  - The `holidayClosedDates` column on the `UserProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."UserProfile" DROP COLUMN "holidayClosedDates",
ADD COLUMN     "holidayClosedDates" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[];
