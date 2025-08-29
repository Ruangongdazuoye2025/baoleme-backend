import { Context, ServiceSchema, Errors } from "moleculer";
import { PrismaClient } from "@prisma/client";
import Joi from "joi";

// Joi Schema 定义
const shopIdAndItemIdRequestSchema = Joi.object({
    shopId: Joi.string().uuid().required(),
    itemId: Joi.string().uuid().required()
});

const shopIdRequestSchema = Joi.object({
    id: Joi.string().uuid().required()
});

const cartItemQuantityRequestSchema = Joi.object({
    shopId: Joi.string().uuid().required(),
    itemId: Joi.string().uuid().required(),
    quantity: Joi.number().integer().min(0).required()
});

// TypeScript Interface 定义
interface ShopIdAndItemIdRequest {
    shopId: string;
    itemId: string;
}

interface ShopIdRequest {
    id: string;
}

interface CartItemQuantityRequest {
    shopId: string;
    itemId: string;
    quantity: number;
}

const CART_ERROR_MESSAGES = {
    ITEM_NOT_FOUND_IN_CART: 'Item not found in cart',
    ITEM_NOT_FOUND_IN_SHOP: 'Item not found in shop',
    SHOP_NOT_FOUND: 'Shop not found',
} as const;

const CartService: ServiceSchema = {
    name: "cart",

    events: {
        // 处理用户删除事件
        "user.deleted": {
            async handler(ctx: Context<{ id: string }>) {
                const { id: userId } = ctx.params;
                await (this.prisma as PrismaClient).cartItem.deleteMany({
                    where: { customerId: userId }
                });
                this.logger.info(`Deleted all cart items for user: ${userId}`);
            }
        },
        "item.deleted": {
            async handler(ctx: Context<{ id: string }>) {
                const { id: itemId } = ctx.params;
                await (this.prisma as PrismaClient).cartItem.deleteMany({
                    where: { itemId }
                });
                this.logger.info(`Deleted all cart items for item: ${itemId}`);
            }
        }
    },

    actions: {
        // Get cart item quantity
        getCartItemQuantity: {
            params: shopIdAndItemIdRequestSchema as any,
            async handler(ctx: Context<ShopIdAndItemIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { shopId, itemId } = ctx.params;

                const cartItem = await (this.prisma as PrismaClient).cartItem.findUnique({
                    where: { customerId_itemId: { customerId: currentUserId, itemId } }
                });

                if (!cartItem) {
                    throw new Errors.MoleculerError(CART_ERROR_MESSAGES.ITEM_NOT_FOUND_IN_CART, 404);
                }

                // 通过服务调用验证商品属于指定店铺
                const item = await ctx.call("item.get", { id: itemId }) as any;
                if (!item || item.shopId !== shopId) {
                    throw new Errors.MoleculerError(CART_ERROR_MESSAGES.ITEM_NOT_FOUND_IN_CART, 404);
                }

                return { quantity: cartItem.quantity };
            }
        },

        // Update cart item quantity
        updateCartItemQuantity: {
            params: cartItemQuantityRequestSchema as any,
            async handler(ctx: Context<CartItemQuantityRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { shopId, itemId, quantity } = ctx.params;

                // 通过服务调用检查商品是否属于指定店铺
                const item = await ctx.call("item.get", { id: itemId }) as any;
                if (!item || item.shopId !== shopId) {
                    throw new Errors.MoleculerError(CART_ERROR_MESSAGES.ITEM_NOT_FOUND_IN_SHOP, 404);
                }

                const key = { customerId_itemId: { customerId: currentUserId, itemId } };
                if (quantity === 0) {
                    const existing = await (this.prisma as PrismaClient).cartItem.findUnique({ where: key });
                    if (existing) {
                        await (this.prisma as PrismaClient).cartItem.delete({ where: key });
                    }
                    const cart = await this.getCartInfoInternal(currentUserId, shopId);
                    return { quantity: 0, cart };
                } else {
                    await (this.prisma as PrismaClient).cartItem.upsert({
                        where: key,
                        update: { quantity },
                        create: { 
                            customerId: currentUserId,
                            itemId, 
                            quantity,
                            shopId
                        }
                    });
                    const cart = await this.getCartInfoInternal(currentUserId, shopId);
                    return { quantity, cart };
                }
            }
        },

        // Get cart information
        getCartInfo: {
            params: shopIdRequestSchema as any,
            async handler(ctx: Context<ShopIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: shopId } = ctx.params;

                const shopCartItems = await (this.prisma as PrismaClient).cartItem.findMany({
                    where: { customerId: currentUserId, shopId }
                });
                const shopCartItemsWithItem = await Promise.all(shopCartItems.map(async cartItem => {
                    return {...cartItem, item: await ctx.call("item.get", { id: cartItem.itemId }) as any};
                }));
                const shop = await ctx.call("shop.get", { id: shopId }) as any;
                const total = shopCartItemsWithItem.reduce((sum, i) => sum + i.quantity * i.item.price, 0);
                const totalWithoutPromotion = shopCartItemsWithItem.reduce((sum, i) => sum + i.quantity * i.item.priceWithoutPromotion, 0);
                const settlable = shopCartItemsWithItem.length > 0 &&
                    shopCartItemsWithItem.every(i => i.item.available && !i.item.stockout) &&
                    total + shop.deliveryPrice >= shop.deliveryThreshold;
                
                return {
                    total,
                    totalWithoutPromotion,
                    settlable: settlable
                };
            }
        },

        // Get cart items list
        getCartItems: {
            params: shopIdRequestSchema as any,
            async handler(ctx: Context<ShopIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: shopId } = ctx.params;

                // 获取用户的所有购物车商品
                const shopCartItems = await (this.prisma as PrismaClient).cartItem.findMany({
                    where: { customerId: currentUserId, shopId },
                    orderBy: { createdAt: 'asc' }
                });

                const result = [];
                for (const cartItem of shopCartItems) {
                    const item = await ctx.call("item.get", { id: cartItem.itemId });
                    result.push({
                        item,
                        quantity: cartItem.quantity 
                    });
                }

                return result;
            }
        },

        // Clear cart
        clearCart: {
            params: shopIdRequestSchema as any,
            async handler(ctx: Context<ShopIdRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta;
                const { id: shopId } = ctx.params;

                await (this.prisma as PrismaClient).cartItem.deleteMany({
                    where: { customerId: currentUserId, shopId }
                });
            }
        }
    },

    methods: {
        // Get cart information - internal method
        async getCartInfoInternal(userId: string, shopId: string) {
            
        }
    },

    created() {
        this.prisma = new PrismaClient();
    }
};

export default CartService;
