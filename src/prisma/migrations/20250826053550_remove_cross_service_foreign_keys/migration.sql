-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_customerId_fkey";

-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_itemId_fkey";

-- DropForeignKey
ALTER TABLE "ItemFavourite" DROP CONSTRAINT "ItemFavourite_itemId_fkey";

-- DropForeignKey
ALTER TABLE "ItemHistory" DROP CONSTRAINT "ItemHistory_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_riderId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_shopId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_userId_fkey";

-- DropForeignKey
ALTER TABLE "Shop" DROP CONSTRAINT "Shop_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "ShopFavourite" DROP CONSTRAINT "ShopFavourite_shopId_fkey";

-- DropForeignKey
ALTER TABLE "ShopHistory" DROP CONSTRAINT "ShopHistory_shopId_fkey";

-- DropForeignKey
ALTER TABLE "addresses" DROP CONSTRAINT "addresses_userId_fkey";
