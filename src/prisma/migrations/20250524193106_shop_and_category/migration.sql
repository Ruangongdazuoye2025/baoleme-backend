-- CreateTable
CREATE TABLE "ShopAddress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tel" TEXT NOT NULL,
    "shopId" UUID NOT NULL,

    CONSTRAINT "ShopAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tel" TEXT NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopCategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ShopCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "shopId" UUID NOT NULL,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "openTimeStart" INTEGER NOT NULL,
    "openTimeEnd" INTEGER NOT NULL,
    "deliveryThreshold" INTEGER NOT NULL,
    "deliveryPrice" INTEGER NOT NULL,
    "maximumDistance" DOUBLE PRECISION NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "sale" INTEGER NOT NULL DEFAULT 0,
    "averagePrice" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ShopToShopCategory" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ShopToShopCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopAddress_shopId_key" ON "ShopAddress"("shopId");

-- CreateIndex
CREATE INDEX "_ShopToShopCategory_B_index" ON "_ShopToShopCategory"("B");

-- AddForeignKey
ALTER TABLE "ShopAddress" ADD CONSTRAINT "ShopAddress_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShopToShopCategory" ADD CONSTRAINT "_ShopToShopCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ShopToShopCategory" ADD CONSTRAINT "_ShopToShopCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "ShopCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
