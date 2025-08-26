import { Router } from 'express'
import { factoryInjection, factoryMethod, injected } from '../util/injection-decorators'
import AuthMiddleware from '../middleware/auth.middleware'
import OrderService from '../service/order.service'
import * as OrderSchema from '../schema/order.schema'
import { validateBody, validateParams, validateQuery } from '../middleware/validator.middleware'
import { HTTP_STATUS } from '../constants/app.constants'

class OrderController {

    @factoryMethod
    static orderController(
        @injected('authMiddleware') authMiddleware: AuthMiddleware,
        @injected('orderService') orderService: OrderService
    ) {
        const router = Router()

        router.get(
            '/orders/as-customer',
            authMiddleware.requireAuth(),
            validateQuery(OrderSchema.getOrdersQuery),
            async (req, res) => {
                const { p, pn, s } = req.query as unknown as OrderSchema.GetOrdersQuery
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const orders = await orderService.getOrdersAsCustomer(req.user!.id, pageSkip, pageLimit, s)
                res.status(HTTP_STATUS.OK).json(await Promise.all(orders.map(async order => orderService.orderDataToOrderInfo(order))))
            }
        )

        router.get(
            '/orders/as-shop/:shopId',
            authMiddleware.requireAuth(),
            validateParams(OrderSchema.shopIdParams),
            validateQuery(OrderSchema.getOrdersAsShopQuery),
            async (req, res) => {
                const { shopId } = req.params as unknown as OrderSchema.ShopIdParams
                const { p, pn, s } = req.query as unknown as OrderSchema.GetOrdersAsShopQuery
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const orders = await orderService.getOrdersAsShop(req.user!.id, shopId, pageSkip, pageLimit, s)
                res.status(HTTP_STATUS.OK).json(await Promise.all(orders.map(async order => orderService.orderDataToOrderInfo(order))))
            }
        )

        router.get(
            '/orders/as-rider',
            authMiddleware.requireAuth(),
            validateQuery(OrderSchema.getOrdersQuery),
            async (req, res) => {
                const { p, pn, s } = req.query as unknown as OrderSchema.GetOrdersQuery
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const orders = await orderService.getOrdersAsRider(req.user!.id, pageSkip, pageLimit, s)
                res.status(HTTP_STATUS.OK).json(await Promise.all(orders.map(async order => orderService.orderDataToOrderInfo(order))))
            }
        )

        router.get(
            '/orders',
            authMiddleware.requireAuth(),
            validateQuery(OrderSchema.getOrdersQuery),
            async (req, res) => {
                const { p, pn, s } = req.query as unknown as OrderSchema.GetOrdersQuery
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const orders = await orderService.getOrders(req.user!.id, pageSkip, pageLimit, s)
                res.status(HTTP_STATUS.OK).json(await Promise.all(orders.map(async order => orderService.orderDataToOrderInfo(order))))
            }
        )

        router.post(
            '/orders',
            authMiddleware.requireAuth(),
            validateBody(OrderSchema.createOrder),
            async (req, res) => {
                const { shopId, addressId, note } = req.body as OrderSchema.CreateOrder
                const order = await orderService.createOrder(req.user!.id, shopId, addressId, note)
                res.status(HTTP_STATUS.CREATED).json(await orderService.orderDataToOrderInfo(order))
            }
        )

        router.get(
            '/orders/:id',
            authMiddleware.requireAuth(),
            validateParams(OrderSchema.orderIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as OrderSchema.OrderIdParams
                const { order, doOmit } = await orderService.getOrder(req.user!.id, id)
                if (doOmit) {
                    res.status(HTTP_STATUS.OK).json(orderService.orderDataToOmittedOrderInfo(order))
                } else {
                    res.status(HTTP_STATUS.OK).json(await orderService.orderDataToOrderInfo(order))
                }
            }
        )

        router.patch(
            '/orders/:id/rider',
            authMiddleware.requireAuth(),
            validateParams(OrderSchema.orderIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as OrderSchema.OrderIdParams
                const order = await orderService.updateOrderRider(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(await orderService.orderDataToOrderInfo(order))
            }
        )

        router.patch(
            '/orders/:id/status',
            authMiddleware.requireAuth(),
            validateParams(OrderSchema.orderIdParams),
            validateBody(OrderSchema.updateOrderStatus),
            async (req, res) => {
                const { id } = req.params as unknown as OrderSchema.OrderIdParams
                const { status } = req.body as OrderSchema.UpdateOrderStatus
                const order = await orderService.updateOrderStatus(req.user!.id, id, status)
                res.status(HTTP_STATUS.OK).json(await orderService.orderDataToOrderInfo(order))
            }
        )

        router.patch(
            '/orders/:id/delivery',
            authMiddleware.requireAuth(),
            validateParams(OrderSchema.orderIdParams),
            validateBody(OrderSchema.updateOrderDelivery),
            async (req, res) => {
                const { id } = req.params as unknown as OrderSchema.OrderIdParams
                const { longitude, latitude } = req.body as OrderSchema.UpdateOrderDelivery
                const order = await orderService.updateOrderDelivery(req.user!.id, id, longitude, latitude)
                res.status(HTTP_STATUS.OK).json(await orderService.orderDataToOrderInfo(order))
            }
        )

        router.delete(
            '/orders/:id',
            authMiddleware.requireAuth(),
            validateParams(OrderSchema.orderIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as OrderSchema.OrderIdParams
                await orderService.deleteOrder(req.user!.id, id)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        return router
    }

}

export default factoryInjection(OrderController)