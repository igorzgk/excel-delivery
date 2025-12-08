/*
  Warnings:

  - You are about to drop the column `closedDaysText` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `easterClosedFrom` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `easterClosedTo` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `equipmentCount` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `equipmentFlags` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `hasDryAged` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `holidayClosedDates` on the `UserProfile` table. All the data in the column will be lost.
  - The `businessTypes` column on the `UserProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."BusinessType" AS ENUM ('RESTAURANT_GRILL', 'BAR_WINE', 'REFRESHMENT_CAFE', 'SCHOOL_KIOSK', 'PASTRY_SHOP_WITH_COFFEE', 'PASTRY_SHOP_NO_COFFEE', 'BREAD_SHOP_WITH_COFFEE', 'BUTCHER', 'BUTCHER_HOT_CORNER', 'FISHMONGER', 'FISHMONGER_HOT_CORNER', 'DELI_CHEESE_CURED_MEAT', 'BAKERY_WITH_COFFEE', 'BAKERY_NO_COFFEE', 'BAKERY_PASTRY_WITH_COFFEE', 'PASTRY_WITH_COFFEE', 'PASTRY_NO_COFFEE', 'GROCERY_FRUIT', 'WINE_NUTS_SHOP', 'FROZEN_PRODUCTS_SHOP', 'PACKAGED_FRESH_FROZEN_DRY', 'ICE_CREAM_SHOP', 'PUFF_PASTRY_PRODUCTION');

-- CreateEnum
CREATE TYPE "public"."Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "public"."PublicHoliday" AS ENUM ('NEW_YEAR', 'CLEAN_MONDAY', 'MARCH_25', 'EASTER_SUNDAY', 'EASTER_MONDAY', 'AUG_15', 'OCT_28', 'CHRISTMAS', 'BOXING_DAY');

-- DropIndex
DROP INDEX "public"."UserProfile_userId_idx";

-- AlterTable
ALTER TABLE "public"."UserProfile" DROP COLUMN "closedDaysText",
DROP COLUMN "easterClosedFrom",
DROP COLUMN "easterClosedTo",
DROP COLUMN "equipmentCount",
DROP COLUMN "equipmentFlags",
DROP COLUMN "hasDryAged",
DROP COLUMN "holidayClosedDates",
ADD COLUMN     "closedHolidays" "public"."PublicHoliday"[],
ADD COLUMN     "closedWeekdays" "public"."Weekday"[],
ADD COLUMN     "dryAgedChamberCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "freezerCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fridgeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hotCabinetCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "iceCreamFreezerCount" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "businessTypes",
ADD COLUMN     "businessTypes" "public"."BusinessType"[];
