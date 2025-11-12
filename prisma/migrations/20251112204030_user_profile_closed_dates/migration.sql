-- AlterTable
ALTER TABLE "public"."UserProfile" ADD COLUMN     "augustClosedFrom" TIMESTAMP(3),
ADD COLUMN     "augustClosedTo" TIMESTAMP(3),
ADD COLUMN     "closedDaysText" TEXT,
ADD COLUMN     "easterClosedFrom" TIMESTAMP(3),
ADD COLUMN     "easterClosedTo" TIMESTAMP(3),
ADD COLUMN     "holidayClosedDates" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "UserProfile_userId_idx" ON "public"."UserProfile"("userId");
