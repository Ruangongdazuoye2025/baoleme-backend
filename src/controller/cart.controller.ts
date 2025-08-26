import { Router } from 'express'
import * as CartSchema from '../schema/cart.schema'
import AuthService from '../service/auth.service'
import CartService from '../service/cart.service'
import { validateBody, validateParams } from '../middleware/validator.middleware'
import { factoryInjection, factoryMethod, injected } from '../util/injection-decorators'
import { HTTP_STATUS } from '../constants/app.constants'

class CartController {
    @factoryMethod
    static cartController(
        @injected('authService') authService: AuthService,
        @injected('cartService') cartService: CartService,
    ) {
        const router = Router()

        // 获取购物车商品数量
        router.get(
            '/cart/:shopId/item/:itemId',
            authService.requireAuth(),
            validateParams(CartSchema.shopIdAndItemIdParams),
            async (req, res) => {
                const { shopId, itemId } = req.params
                const result = await cartService.getCartItemQuantity(req.user!.id, shopId, itemId)
                res.status(HTTP_STATUS.OK).json(result)
            }
        )

        // 修改购物车商品数量
        router.patch(
            '/cart/:shopId/item/:itemId',
            authService.requireAuth(),
            validateParams(CartSchema.shopIdAndItemIdParams),
            validateBody(CartSchema.cartItemQuantityBody),
            async (req, res) => {
                const { shopId, itemId } = req.params
                const { quantity } = req.body
                const result = await cartService.updateCartItemQuantity(req.user!.id, shopId, itemId, quantity)
                res.status(HTTP_STATUS.OK).json(result)
            }
        )

        // 获取购物车信息
        router.get(
            '/cart/:id',
            authService.requireAuth(),
            validateParams(CartSchema.shopIdParams),
            async (req, res) => {
                const { id: shopId } = req.params
                const result = await cartService.getCartInfo(req.user!.id, shopId)
                res.status(HTTP_STATUS.OK).json(result)
            }
        )

        // 获取购物车商品列表
        router.get(
            '/cart/:id/items',
            authService.requireAuth(),
            validateParams(CartSchema.shopIdParams),
            async (req, res) => {
                const { id: shopId } = req.params
                const result = await cartService.getCartItems(req.user!.id, shopId)
                res.status(HTTP_STATUS.OK).json(result)
            }
        )

        // 清空购物车
        router.delete(
            '/cart/:id/items',
            authService.requireAuth(),
            validateParams(CartSchema.shopIdParams),
            async (req, res) => {
                const { id: shopId } = req.params
                await cartService.clearCart(req.user!.id, shopId)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        return router
    }
}

export default factoryInjection(CartController)
