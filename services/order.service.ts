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

        getOrdersById: {

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
        }
    }
}

export default OrderService;