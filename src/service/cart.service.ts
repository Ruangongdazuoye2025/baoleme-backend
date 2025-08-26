import { PrismaClient } from '@prisma/client'
import { classInjection, injected } from '../util/injection-decorators'
import { ResponseError } from '../util/errors'
import { HTTP_STATUS } from '../constants/app.constants'
import ItemService from './item.service'

const CART_ERROR_MESSAGES = {
    ITEM_NOT_FOUND_IN_CART: 'Item not found in cart',
    ITEM_NOT_FOUND_IN_SHOP: 'Item not found in shop',
    SHOP_NOT_FOUND: 'Shop not found',
} as const

@classInjection
export default class CartService {
    @injected
    private prisma!: PrismaClient

    @injected
    private itemService!: ItemService

    // 获取购物车商品数量
    async getCartItemQuantity(userId: string, shopId: string, itemId: string) {
        const item = await this.prisma.cartItem.findUnique({
            where: { customerId_itemId: { customerId: userId, itemId } },
            include: { item: true }
        })
        if (!item || item.item.shopId !== shopId) throw new ResponseError(HTTP_STATUS.NOT_FOUND, CART_ERROR_MESSAGES.ITEM_NOT_FOUND_IN_CART)
        return { quantity: item.quantity }
    }

    // 修改购物车商品数量
    async updateCartItemQuantity(userId: string, shopId: string, itemId: string, quantity: number) {
        // 检查商品是否属于该店铺
        const item = await this.prisma.item.findUnique({ where: { id: itemId } })
        if (!item || item.shopId !== shopId) throw new ResponseError(HTTP_STATUS.NOT_FOUND, CART_ERROR_MESSAGES.ITEM_NOT_FOUND_IN_SHOP)
        const key = { customerId_itemId: { customerId: userId, itemId } }
        if (quantity === 0) {
            const existing = await this.prisma.cartItem.findUnique({ where: key });
            if (existing) {
                await this.prisma.cartItem.delete({ where: key });
            }
            return { quantity: 0, cart: await this.getCartInfo(userId, shopId) }
        } else {
            await this.prisma.cartItem.upsert({
                where: key,
                update: { quantity },
                create: { customerId: userId, itemId, quantity }
            })
            return { quantity, cart: await this.getCartInfo(userId, shopId) }
        }
    }

    // 获取购物车信息
    async getCartInfo(userId: string, shopId: string) {
        const shop = await this.prisma.shop.findUnique({ where: { id: shopId } })
        if (!shop)
            throw new ResponseError(HTTP_STATUS.NOT_FOUND, CART_ERROR_MESSAGES.SHOP_NOT_FOUND)
        const items = await this.prisma.cartItem.findMany({
            where: { customerId: userId, item: { shopId } },
            include: { item: true }
        })
        const total = items.reduce((sum, i) => sum + i.quantity * i.item.price, 0)
        const totalWithoutPromotion = items.reduce((sum, i) => sum + i.quantity * i.item.priceWithoutPromotion, 0)
        const settlable = items.length > 0 && items.every(i => i.item.available && !i.item.stockout) && total + shop.deliveryPrice >= shop.deliveryThreshold
        return {
            total,
            totalWithoutPromotion,
            settlable: settlable
        }
    }

    // 获取购物车商品列表
    async getCartItems(userId: string, shopId: string) {
        const items = await this.prisma.cartItem.findMany({
            where: { customerId: userId, item: { shopId } },
            include: { item: { include: { categories: true } } },
            orderBy: { createdAt: 'asc' }
        })
        return await Promise.all(items.map(async i => ({
            item: await this.itemService.itemDataToFullItemInfo(i.item),
            quantity: i.quantity 
        })))
    }

    // 清空购物车
    async clearCart(userId: string, shopId: string) {
        await this.prisma.cartItem.deleteMany({ where: { customerId: userId, item: { shopId } } })
    }
}
