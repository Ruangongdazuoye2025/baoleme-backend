-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAtVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailVisible" BOOLEAN NOT NULL DEFAULT true;
