/*
  Warnings:

  - You are about to drop the `ItemFavourite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ItemHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShopFavourite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShopHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ItemToItemCategory` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `shopId` to the `CartItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."RecordType" AS ENUM ('HISTORY', 'FAVORITE');

-- DropForeignKey
ALTER TABLE "public"."Item" DROP CONSTRAINT "Item_shopId_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ItemToItemCategory" DROP CONSTRAINT "_ItemToItemCategory_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ItemToItemCategory" DROP CONSTRAINT "_ItemToItemCategory_B_fkey";

-- AlterTable
ALTER TABLE "public"."CartItem" ADD COLUMN     "shopId" UUID NOT NULL;

-- DropTable
DROP TABLE "public"."ItemFavourite";

-- DropTable
DROP TABLE "public"."ItemHistory";

-- DropTable
DROP TABLE "public"."ShopFavourite";

-- DropTable
DROP TABLE "public"."ShopHistory";

-- DropTable
DROP TABLE "public"."_ItemToItemCategory";

-- CreateTable
CREATE TABLE "public"."ShopRecord" (
    "userId" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "type" "public"."RecordType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopRecord_pkey" PRIMARY KEY ("userId","shopId")
);

-- CreateTable
CREATE TABLE "public"."ItemRecord" (
    "userId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "type" "public"."RecordType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemRecord_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateTable
CREATE TABLE "public"."ItemItemCategory" (
    "itemId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "ItemItemCategory_pkey" PRIMARY KEY ("itemId","categoryId")
);

-- AddForeignKey
ALTER TABLE "public"."ItemItemCategory" ADD CONSTRAINT "ItemItemCategory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
