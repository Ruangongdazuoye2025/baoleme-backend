import { Context, ServiceSchema, Errors } from "moleculer";
import Joi from "joi";
import { AuthMeta } from "../mixins/api-auth.mixin";
import { OrderStatus, OrderItem, Order, Prisma} from "@prisma/client";
import { OrderData } from "../types/order.type";
import haversine from 'haversine-distance';

const ORDER_ERROR_MESSAGES = {
    PERMISSION_DENIED: 'Permission denied',
    UNAUTHORIZED: 'Unauthorized',
    SHOP_NOT_FOUND: 'Shop not found',
    SHOP_NOT_OPEN: 'Shop is not open',
    CART_EMPTY: 'Cart is empty',
    ITEMS_UNAVAILABLE: 'Some items are not available or out of stock',
    ORDER_BELOW_MINIMUM: 'Order total is below the minimum value',
    ADDRESS_NOT_FOUND: 'Address not found',
    DELIVERY_DISTANCE_EXCEEDED: 'Delivery distance exceeded',
    ORDER_NOT_FOUND: 'Order not found',
    ORDER_STATUS_NOT_PREPARED: 'Order status is not PREPARED',
} as const

type Status = 'unpaid' | 'preparing' | 'prepared' | 'delivering' | 'finished' | 'canceled'

const getOrdersAsShopSchema = Joi.object({
    id: Joi.string().uuid().required(),
    p: Joi.number().integer().optional(),
    pn: Joi.number().integer().optional(),
    s: Joi.string().valid('unpaid', 'preparing', 'prepared', 'delivering', 'finished', 'canceled').optional(),
})

const getOrdersSchema = Joi.object({
    p: Joi.number().integer().optional(),
    pn: Joi.number().integer().optional(),
    s: Joi.string().valid('unpaid', 'preparing', 'prepared', 'delivering', 'finished', 'canceled').optional(),
})

const getOrderByIdSchema = Joi.object({
    id: Joi.string().uuid().required(),
})

const createOrderSchema = Joi.object({
    shopId: Joi.string().uuid().required(),
    addressId: Joi.string().uuid().required(),
    note: Joi.string().required(),
})

const updateOrderRiderSchema = Joi.object({
    id: Joi.string().uuid().required(),
})

const updateOrderStatusSchema = Joi.object({
    id: Joi.string().uuid().required(),
    status: Joi.string().valid('unpaid', 'preparing', 'prepared', 'delivering', 'finished', 'canceled').required(),
})

const updateOrderDeliverySchema = Joi.object({
    id: Joi.string().uuid().required(),
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
})

const deleteOrderSchema = Joi.object({
    id: Joi.string().uuid().required(),
})

interface GetOrdersRequest {
    p?: number;
    pn?: number;
    s?: Status;
}

interface GetOrdersAsShopRequest {
    id: string;
    p?: number;
    pn?: number;
    s?: Status;
}

interface getOrderByIdPrams {
    id: string;
}

interface CreateOrderRequest {
    shopId: string;
    addressId: string;
    note: string;
}

interface UpdateOrderRiderRequest {
    id: string;
}

interface UpdateOrderStatusRequest {
    id: string;
    status: Status;
}

interface UpdateOrderDeliveryRequest {
    id: string;
    latitude: number;
    longitude: number;
}

interface deleteOrderRequest {
    id: string;
}

const OrderService: ServiceSchema = {
    name: "order",

    settings: {

    },

    actions: {
        getOrdersAsCustomer: {
            params: getOrdersSchema as any,
            async handler(ctx: Context<GetOrdersRequest, AuthMeta>) {
                const { p, pn, s } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;
                const pageSkip = p && pn ? (p - 1) * pn : undefined;
                const pageLimit = pn;

                if (!currentUserId) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.UNAUTHORIZED, 401);
                }

                const orders = await Promise.all(this.prisma.order.findMany({
                    where: { customerId: currentUserId, status: s},
                    skip: pageSkip,
                    take: pageLimit,
                    orderBy: { createAt: 'desc'},
                }).map(async (order: any) => await this.orderDataToOrderInfo(order)));

                return orders;
            }
        },

        getOrdersAsShop: {
            params: getOrdersAsShopSchema as any,
            async handler(ctx: Context<GetOrdersAsShopRequest, AuthMeta>) {
                const { id, p, pn, s } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;
                const pageSkip = p && pn ? (p - 1) * pn : undefined;
                const pageLimit = pn;

                if (!currentUserId) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.UNAUTHORIZED, 401);
                }

                const shop: any = await ctx.call('shop.get', { id });
                if (!shop || shop.owner !== currentUserId) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.PERMISSION_DENIED, 403);
                }

                const orders = await Promise.all(this.prisma.order.findMany({
                    where: { shopId: id, status: s },
                    skip: pageSkip,
                    take: pageLimit,
                    orderBy: { createdAt: 'desc' }
                }).map(async (order: any) => await this.orderDataToOrderInfo(order)));

                return orders;
            }
        },

        getOrdersAsRider: {
            params: getOrdersSchema as any,
            async handler(ctx: Context<GetOrdersRequest, AuthMeta>) {
                const { p, pn, s } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;
                const pageSkip = p && pn ? (p - 1) * pn : undefined;
                const pageLimit = pn;

                if (!currentUserId) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.UNAUTHORIZED, 401);
                }

                const orders = await Promise.all(this.prisma.order.findMany({
                    where: { riderId: currentUserId, status: s },
                    skip: pageSkip,
                    take: pageLimit,
                    orderBy: { createdAt: 'desc' }
                }).map(async (order: any) => await this.orderDataToOrderInfo(order)));

                return orders;
            }
        },

        getOrders: {
            params: getOrdersSchema as any,
            async handler(ctx: Context<GetOrdersRequest, AuthMeta>) {
                const { p, pn, s } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;
                const pageSkip = p && pn ? (p - 1) * pn : undefined;
                const pageLimit = pn;

                if (!currentUserId || currentUserRole !== 'ADMIN') {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.UNAUTHORIZED, 401);
                }
                
                const orders = await Promise.all(this.prisma.order.findMany({
                    skip: pageSkip,
                    take: pageLimit,
                    where: { status: s },
                    orderBy: { createdAt: 'desc' }
                }).map(async (order: any) => await this.orderDataToOrderInfo(order)));

                return orders;
            }
        },

        getOrderById: {
            params: getOrderByIdSchema as any,
            async handler(ctx: Context<getOrderByIdPrams, AuthMeta>) {
                const { id } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;

                if (!currentUserId) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.UNAUTHORIZED, 401);
                }
                const order = await this.prisma.order.findUnique({ where: { id } });
                if (!order) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.ORDER_NOT_FOUND, 404);
                }

                const shop: any = order.shopId ? await ctx.call('shop.get', { id: order.shopId}) : null;
            
                let doOmit = false
                if (order.customerId !== currentUserId && shop?.owner !== currentUserId && order.riderId !== currentUserId && currentUserRole !== 'ADMIN') {
                    if (order.status !== 'PREPARED') {
                        throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.PERMISSION_DENIED, 403)
                    } else {
                        doOmit = true
                    }
                }
                return doOmit ? this.orderDataToOmittedOrderInfo(order) : await this.orderDataToOrderInfo(order);
            }
        },

        createOrder: {
            params: createOrderSchema as any,
            async handler(ctx: Context<CreateOrderRequest, AuthMeta>) {
                const { shopId, addressId, note } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;

                if (!currentUserId) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.UNAUTHORIZED, 401);
                }

                const shop: any = await ctx.call('shop.get', { id: shopId });
                if (!shop || shop.verified) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.SHOP_NOT_FOUND, 404);
                }
                const now = new Date();
                const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
                const openMinutes = shop.openTimeStart
                const closeMinutes = shop.openTimeEnd

                let isOpen = shop.opened && (closeMinutes > openMinutes ? nowMinutes >= openMinutes && nowMinutes < closeMinutes : nowMinutes >= openMinutes || nowMinutes < closeMinutes)
                if (!isOpen) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.SHOP_NOT_OPEN, 403);
                }

                const cartItems: any = await ctx.call('cart.getCartItems', { shopId });
                if (cartItems.length === 0) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.CART_EMPTY, 400);
                }

                const itemsValidation = await Promise.all(cartItems.map(async (cartItemWithInfo: { item: any; quantity: any; }) => {
                    const item = cartItemWithInfo.item
                    if (!item.available || item.stockout) {
                        return { valid: false, reason: 'Item not available' }
                    }
                    return { 
                        valid: true, 
                        item: item,
                        cartItem: {
                            itemId: item.id,
                            quantity: cartItemWithInfo.quantity,
                            price: item.price
                        }
                    }
                }))

                if (itemsValidation.some(validation => !validation.valid)) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.ITEMS_UNAVAILABLE, 403);
                }

                const orderItems = itemsValidation.map(validation => {
                    const validationData = validation as { valid: true; item: any; cartItem: any }
                    return {
                        itemId: validationData.cartItem.itemId,
                        name: validationData.item.name,
                        quantity: validationData.cartItem.quantity,
                        price: validationData.item.price * validationData.cartItem.quantity,
                    }
                });

                const total = orderItems.reduce((sum, item) => sum + item.price, 0) + shop.deliveryPrice;
                if (total < shop.deliveryThreshold) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.ORDER_BELOW_MINIMUM, 403);
                }

                const address: any = await ctx.call('address.getAddressById', { id: addressId });
                const distance = 0.001 * haversine(
                    { latitude: shop.addressLatitude, longitude: shop.addressLongitude },
                    { latitude: address.coordinate[1]!, longitude: address.coordinate[0]! }
                )

                if (distance > shop.maximumDistance) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.DELIVERY_DISTANCE_EXCEEDED, 403);
                }

                await ctx.call('cart.clearCart', { shopId });

                const order = await this.prisma.order.create({
                    data: {
                        customerId: currentUserId,
                        shopId,
                        deliveryFee: shop.deliveryPrice,
                        total: shop.deliveryPrice + total,
                        note,
                        items: { create: orderItems },
                        shopLatitude: shop.addressLatitude,
                        shopLongitude: shop.addressLongitude,
                        shopProvince: shop.addressProvince,
                        shopCity: shop.addressCity,
                        shopDistrict: shop.addressDistrict,
                        shopAddress: shop.addressAddress,
                        shopName: shop.name, // 修正：使用 shop.name 而不是 shop.addressName
                        shopTel: shop.addressTel,
                        customerLatitude: address.coordinate[1]!,
                        customerLongitude: address.coordinate[0]!,
                        customerProvince: address.province,
                        customerCity: address.city,
                        customerDistrict: address.district,
                        customerAddress: address.address,
                        customerName: address.name,
                        customerTel: address.tel,
                    }
                })

                return await this.orderDataToOrderInfo(order);
            }
        },

        updateOrderRider: {
            params: updateOrderRiderSchema as any,
            async handler(ctx: Context<UpdateOrderRiderRequest, AuthMeta>) {
                const { id } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;

                if (!currentUserId) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.PERMISSION_DENIED, 403);
                }

                const order = await this.prisma.order.findUnique({ where: { id } });

                if (!order) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.ORDER_NOT_FOUND, 404);
                }

                if (order.status !== 'PREPARED') {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.ORDER_STATUS_NOT_PREPARED, 403);
                }

                const updatedOrder = await this.prisma.order.update({
                    where: { id },
                    data: { riderId: currentUserId, status: 'DELIVERING', deliveredAt: new Date() }
                });

                return await this.orderDataToOrderInfo(updatedOrder)
            }
        },

        updateOrderStatus: {
            params: updateOrderStatusSchema as any,
            async handler(ctx: Context<UpdateOrderStatusRequest, AuthMeta>) {
                const { id, status } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;

                if (!currentUserId) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.PERMISSION_DENIED, 403);
                }

                const order = await this.prisma.order.findUnique({ where: { id } });
                if (!order) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.ORDER_NOT_FOUND, 404);
                }

                const shop: any = order.shopId ? await ctx.call('shop.get', { id: order.shopId }) : null;

                const stateTransition: [boolean, 'canceledAt' | 'paidAt' | 'preparedAt' | 'finishedAt'][] = [
                    [currentUserId === order.customerId && order.status === 'UNPAID' && status === 'canceled', 'canceledAt'],
                    [currentUserId === order.customerId && order.status === 'UNPAID' && status === 'preparing', 'paidAt'],
                    [currentUserId === shop?.ownerId && order.status === 'PREPARING' && status === 'prepared', 'preparedAt'],
                    [currentUserId === order.riderId && order.status === 'DELIVERING' && status === 'finished', 'finishedAt'],
                ]

                const permittedStatusProp = stateTransition.find(([permitted]) => permitted)?.[1]

                if (permittedStatusProp) {
                    const ret = await this.prisma.order.update({
                        where: { id },
                        data: {
                            status: status,
                            [permittedStatusProp]: new Date(),
                        }
                    })
                    if (ret.status === 'FINISHED')
                        await this.updateItemsSale(ret.id, ret.shopId!)
                    return await this.orderDataToOrderInfo(ret)
                } else {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.PERMISSION_DENIED, 403);
                }
            }
        },

        updateOrderDelivery: {
            params: updateOrderDeliverySchema as any,
            async handler(ctx: Context<UpdateOrderDeliveryRequest, AuthMeta>) {
                const { id, latitude, longitude } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;

                if (!currentUserId) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.PERMISSION_DENIED, 403);
                }

                const order = await this.prisma.order.findUnique({ where: { id } });
                if (!order) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.ORDER_NOT_FOUND, 404);
                }

                if (order.riderId !== currentUserId) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.PERMISSION_DENIED, 403);
                }

                if (order.status !== 'DELIVERING') {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.ORDER_STATUS_NOT_PREPARED, 403);
                }

                const updatedOrder = await this.prisma.order.update({
                    where: { id },
                    data: { deliveryLatitude: latitude, deliveryLongitude: longitude }
                });

                return await this.orderDataToOrderInfo(updatedOrder)
            }
        },

        deleteOrder: {
            params: deleteOrderSchema as any,
            async handler(ctx: Context<deleteOrderRequest, AuthMeta>) {
                const { id } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;

                if (!currentUserId) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.PERMISSION_DENIED, 403);
                }

                const order = await this.prisma.order.findUnique({ where: { id } });

                if (!order) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.ORDER_NOT_FOUND, 404);
                }

                if (order.status !== 'CANCELED' || order.customerId !== currentUserId) {
                    throw new Errors.MoleculerClientError(ORDER_ERROR_MESSAGES.PERMISSION_DENIED, 403);
                }

                await this.prisma.order.delete({ where: { id } });

                ctx.emit('order.deleted', { id });
            }
        },
    },

    methods: {
        async orderDataToOrderInfo(order: OrderData) {
            // 获取订单项（不包含关联数据）
            const orderItems = await this.prisma.orderItem.findMany({
                where: { orderId: order.id }
            })
    
            return {
                id: order.id,
                status: order.status.toLowerCase(),
                createdAt: order.createdAt,
                paidAt: order.paidAt,
                preparedAt: order.preparedAt,
                deliveredAt: order.deliveredAt,
                finishedAt: order.finishedAt,
                canceledAt: order.canceledAt,
                customer: order.customerId,
                shop: order.shopId,
                rider: order.riderId,
                items: await Promise.all(orderItems.map(async (item: { itemId: any; name: any; quantity: any; price: any; }) => ({
                    id: item.itemId,
                    name: item.name,
                    cover: await this.getOrderItemCoverLinks(item.itemId ?? '0'),
                    quantity: item.quantity,
                    price: item.price,
                }))),
                deliveryFee: order.deliveryFee,
                total: order.total,
                note: order.note,
                delivery: (order.deliveryLatitude !== null && order.deliveryLongitude != null) ? {
                    latitude: order.deliveryLatitude,
                    longitude: order.deliveryLongitude,
                } : null,
                shopAddress: {
                    coordinate: [order.shopLongitude, order.shopLatitude],
                    province: order.shopProvince,
                    city: order.shopCity,
                    district: order.shopDistrict,
                    address: order.shopAddress,
                    name: order.shopName,
                    tel: order.shopTel,
                },
                customerAddress: {
                    coordinate: [order.customerLongitude, order.customerLatitude],
                    province: order.customerProvince,
                    city: order.customerCity,
                    district: order.customerDistrict,
                    address: order.customerAddress,
                    name: order.customerName,
                    tel: order.customerTel,
                }
            }
        },

        orderDataToOmittedOrderInfo(order: { 
            id: string; 
            status: OrderStatus; 
            preparedAt?: Date | null; 
            shopLongitude: number; 
            shopLatitude: number; 
            shopProvince: string; 
            shopCity: string; 
            shopDistrict: string; 
            shopAddress: string; 
            shopName: string; 
            shopTel: string; 
            customerLongitude: number; 
            customerLatitude: number; 
            customerProvince: string; 
            customerCity: string; 
            customerDistrict: string; 
            customerAddress: string; 
            customerName: string; 
            customerTel: string; 
        }) {
            return {
                id: order.id,
                status: order.status.toLowerCase(),
                preparedAt: order.preparedAt,
                shopAddress: {
                    coordinate: [order.shopLongitude, order.shopLatitude],
                    province: order.shopProvince,
                    city: order.shopCity,
                    district: order.shopDistrict,
                    address: order.shopAddress,
                    name: order.shopName,
                    tel: order.shopTel,
                },
                customerAddress: {
                    coordinate: [order.customerLongitude, order.customerLatitude],
                    province: order.customerProvince,
                    city: order.customerCity,
                    district: order.customerDistrict,
                    address: order.customerAddress,
                    name: order.customerName,
                    tel: order.customerTel,
                }
            }
        },

        async getOrderItemCoverLinks(id: string) {
            const [origin, thumbnail] = await Promise.all([
                this.ossService.getObjectUrl(`items/${id}/cover.webp`),
                this.ossService.getObjectUrl(`items/${id}/cover-thumbnail.webp`)])
            return { origin, thumbnail }
        },

        async updateItemsSale(orderId: string, shopId: string) {
            const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            
            // 获取订单项（不包含关联数据）
            const orderItems = await this.prisma.orderItem.findMany({
                where: { orderId }
            })
            
            // 收集需要更新的商品销量数据
            const itemSaleUpdates: Array<{ itemId: string; saleCount: number }> = []
            
            // 计算每个商品的销量
            for (const orderItem of orderItems) {
                if (orderItem.itemId) {
                    const itemOrderSum = (await this.prisma.orderItem.aggregate({
                        _sum: { quantity: true },
                        where: { 
                            itemId: orderItem.itemId,
                            order: {
                                status: 'FINISHED',
                                finishedAt: {
                                    gte: oneMonthAgo,
                                }
                            },
                        },
                    }))._sum.quantity || 0
                    
                    itemSaleUpdates.push({
                        itemId: orderItem.itemId,
                        saleCount: itemOrderSum
                    })
                }
            }
            
            // 计算店铺销量
            const shopItemIds = await this.itemService.getShopItemIds(shopId)
            const shopOrderSum = (await this.prisma.orderItem.aggregate({
                _sum: { quantity: true },
                where: {
                    itemId: { in: shopItemIds },
                    order: {
                        status: 'FINISHED',
                        finishedAt: {
                            gte: oneMonthAgo,
                        }
                    },
                },
            }))._sum.quantity || 0
            
            // 在当前事务完成后异步更新销量数据，确保数据一致性
            // 这样避免跨服务调用在事务中导致的死锁问题
            setImmediate(async () => {
                try {
                    await this.updateSalesWithRetry(itemSaleUpdates, shopId, shopOrderSum, orderId)
                } catch (error) {
                    console.error(`Failed to update sales for order ${orderId}:`, error)
                    // 可以在这里添加重试队列或者告警机制
                }
            })
        },
    }
}

export default OrderService;