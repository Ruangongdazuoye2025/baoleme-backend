/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the `CustomerAddress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShopAddress` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `addressAddress` to the `Shop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addressCity` to the `Shop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addressDistrict` to the `Shop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addressLatitude` to the `Shop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addressLongitude` to the `Shop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addressName` to the `Shop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addressProvince` to the `Shop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addressTel` to the `Shop` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('UNPAID', 'PREPARING', 'PREPARED', 'DELIVERING', 'FINISHED', 'CANCELED');

-- DropForeignKey
ALTER TABLE "ShopAddress" DROP CONSTRAINT "ShopAddress_shopId_fkey";

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "updatedAt",
ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sale" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "addressAddress" TEXT NOT NULL,
ADD COLUMN     "addressCity" TEXT NOT NULL,
ADD COLUMN     "addressDistrict" TEXT NOT NULL,
ADD COLUMN     "addressLatitude" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "addressLongitude" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "addressName" TEXT NOT NULL,
ADD COLUMN     "addressProvince" TEXT NOT NULL,
ADD COLUMN     "addressTel" TEXT NOT NULL;

-- DropTable
DROP TABLE "CustomerAddress";

-- DropTable
DROP TABLE "ShopAddress";

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tel" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "customerId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "itemId" UUID,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" "OrderStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "preparedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "customerId" UUID,
    "shopId" UUID,
    "riderId" UUID,
    "deliveryFee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "deliveryLatitude" DOUBLE PRECISION,
    "deliveryLongitude" DOUBLE PRECISION,
    "shopLatitude" DOUBLE PRECISION NOT NULL,
    "shopLongitude" DOUBLE PRECISION NOT NULL,
    "shopProvince" TEXT NOT NULL,
    "shopCity" TEXT NOT NULL,
    "shopDistrict" TEXT NOT NULL,
    "shopAddress" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "shopTel" TEXT NOT NULL,
    "customerLatitude" DOUBLE PRECISION NOT NULL,
    "customerLongitude" DOUBLE PRECISION NOT NULL,
    "customerProvince" TEXT NOT NULL,
    "customerCity" TEXT NOT NULL,
    "customerDistrict" TEXT NOT NULL,
    "customerAddress" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerTel" TEXT NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_customerId_itemId_key" ON "CartItem"("customerId", "itemId");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
