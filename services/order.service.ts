import { Context, ServiceSchema, Errors } from "moleculer";
import Joi from "joi";
import { AuthMeta } from "../mixins/api-auth.mixin";
import { OrderStatus, OrderItem, Order} from "@prisma/client";
import { OrderData } from "../types/order.type";

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
            
        },

        getOrdersAsRider: {

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

                // todo: 验证权限要获取店铺信息，需要shop.service，随后再修改
                const shop = order.shopId ? await this.broker.call('shop.getShop', { id: order.shopId}) : null;
            
                let doOmit = false
                if (order.customerId !== currentUserId /*&& shop?.owner !== currentUserId*/ && order.riderId !== currentUserId && currentUserRole !== 'ADMIN') {
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

        },

        updateOrderRider: {

        },

        updateOrderStatus: {

        },

        updateOrderDelivery: {

        },

        deleteOrder: {
            // 删除事件，级联删除
            // ctx.emit('order.deleted', { id: 'test' })
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
    }
}

export default OrderService;