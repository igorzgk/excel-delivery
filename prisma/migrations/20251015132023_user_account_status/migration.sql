/*
  Warnings:

  - You are about to drop the column `subscriptionEndsAt` on the `User` table. All the data in the column will be lost.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `passwordHash` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "subscriptionEndsAt",
ADD COLUMN     "status" "public"."AccountStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "passwordHash" SET NOT NULL;
