import { Context, ServiceSchema, Errors } from "moleculer";
import Joi from "joi";

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

const getOrderAsCustomerSchema = Joi.object({
    p: Joi.number().integer().optional(),
    pn: Joi.number().integer().optional(),
})

const OrderService: ServiceSchema = {
    name: "order",

    settings: {

    },

    actions: {
        getOrdersAsCustomer: {
            async handler(ctx: Context) {
 
                
            }
        }
    }
}

export default OrderService;