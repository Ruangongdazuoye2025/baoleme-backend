import { PrismaClient } from '@prisma/client'
import { classInjection, injected } from '../util/injection-decorators'
import { ResponseError } from '../util/errors'
import { HTTP_STATUS } from '../constants/app.constants'
import ItemService from './item.service'
import ShopService from './shop.service'

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

    @injected
    private shopService!: ShopService

    // Get cart item quantity
    async getCartItemQuantity(userId: string, shopId: string, itemId: string) {
        const cartItem = await this.prisma.cartItem.findUnique({
            where: { customerId_itemId: { customerId: userId, itemId } }
        })
        if (!cartItem) {
            throw new ResponseError(HTTP_STATUS.NOT_FOUND, CART_ERROR_MESSAGES.ITEM_NOT_FOUND_IN_CART)
        }
        
        // 通过服务调用验证商品属于指定店铺
        const item = await this.itemService.getItem(userId, itemId)
        if (!item || item.shopId !== shopId) {
            throw new ResponseError(HTTP_STATUS.NOT_FOUND, CART_ERROR_MESSAGES.ITEM_NOT_FOUND_IN_CART)
        }
        
        return { quantity: cartItem.quantity }
    }

    // Update cart item quantity
    async updateCartItemQuantity(userId: string, shopId: string, itemId: string, quantity: number) {
        // 通过服务调用检查商品是否属于指定店铺
        const item = await this.itemService.getItem(userId, itemId)
        if (!item || item.shopId !== shopId) {
            throw new ResponseError(HTTP_STATUS.NOT_FOUND, CART_ERROR_MESSAGES.ITEM_NOT_FOUND_IN_SHOP)
        }
        
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

    // Get cart information
    async getCartInfo(userId: string, shopId: string) {
        const shop = await this.shopService.getShop(shopId)
        if (!shop) {
            throw new ResponseError(HTTP_STATUS.NOT_FOUND, CART_ERROR_MESSAGES.SHOP_NOT_FOUND)
        }
        
        // 获取用户的所有购物车商品
        const allCartItems = await this.prisma.cartItem.findMany({
            where: { customerId: userId }
        })
        
        // 过滤出属于指定店铺的商品
        const shopCartItems = []
        for (const cartItem of allCartItems) {
            const item = await this.itemService.getItem(userId, cartItem.itemId)
            if (item && item.shopId === shopId) {
                shopCartItems.push({ ...cartItem, item })
            }
        }
        
        const total = shopCartItems.reduce((sum, i) => sum + i.quantity * i.item.price, 0)
        const totalWithoutPromotion = shopCartItems.reduce((sum, i) => sum + i.quantity * i.item.priceWithoutPromotion, 0)
        const settlable = shopCartItems.length > 0 && 
            shopCartItems.every(i => i.item.available && !i.item.stockout) && 
            total + shop.deliveryPrice >= shop.deliveryThreshold
        
        return {
            total,
            totalWithoutPromotion,
            settlable: settlable
        }
    }

    // Get cart items list
    async getCartItems(userId: string, shopId: string) {
        // 获取用户的所有购物车商品
        const allCartItems = await this.prisma.cartItem.findMany({
            where: { customerId: userId },
            orderBy: { createdAt: 'asc' }
        })
        
        // 过滤出属于指定店铺的商品并获取完整信息
        const shopCartItems = []
        for (const cartItem of allCartItems) {
            const item = await this.itemService.getItem(userId, cartItem.itemId)
            if (item && item.shopId === shopId) {
                const fullItemInfo = await this.itemService.itemDataToFullItemInfo(item)
                shopCartItems.push({
                    item: fullItemInfo,
                    quantity: cartItem.quantity 
                })
            }
        }
        
        return shopCartItems
    }

    // Clear cart
    async clearCart(userId: string, shopId: string) {
        // 获取用户的所有购物车商品
        const allCartItems = await this.prisma.cartItem.findMany({
            where: { customerId: userId }
        })
        
        // 找出属于指定店铺的商品ID
        const itemIdsToDelete = []
        for (const cartItem of allCartItems) {
            const item = await this.itemService.getItem(userId, cartItem.itemId)
            if (item && item.shopId === shopId) {
                itemIdsToDelete.push(cartItem.itemId)
            }
        }
        
        // 删除属于指定店铺的购物车商品
        if (itemIdsToDelete.length > 0) {
            await this.prisma.cartItem.deleteMany({ 
                where: { 
                    customerId: userId,
                    itemId: { in: itemIdsToDelete }
                } 
            })
        }
    }
}
