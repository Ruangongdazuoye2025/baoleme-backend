import { PrismaClient } from '@prisma/client'
import { classInjection, injected } from '../util/injection-decorators'
import { ResponseError } from '../util/errors'
import ItemService from './item.service'

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
        if (!item || item.item.shopId !== shopId) throw new ResponseError(404, 'Item not found in cart')
        return { quantity: item.quantity }
    }

    // 修改购物车商品数量
    async updateCartItemQuantity(userId: string, shopId: string, itemId: string, quantity: number) {
        // 检查商品是否属于该店铺
        const item = await this.prisma.item.findUnique({ where: { id: itemId } })
        if (!item || item.shopId !== shopId) throw new ResponseError(404, 'Item not found in shop')
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
        const items = await this.prisma.cartItem.findMany({
            where: { customerId: userId, item: { shopId } },
            include: { item: true }
        })
        const total = items.reduce((sum, i) => sum + i.quantity * i.item.price, 0)
        const totalWithoutPromotion = items.reduce((sum, i) => sum + i.quantity * i.item.priceWithoutPromotion, 0)
        return {
            total,
            totalWithoutPromotion,
            settlable: items.length > 0
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
