import { Router } from 'express'
import * as CartSchema from '../schema/cart.schema'
import AuthMiddleware from '../middleware/auth.middleware'
import CartService from '../service/cart.service'
import { validateBody, validateParams } from '../middleware/validator.middleware'
import { factoryInjection, factoryMethod, injected } from '../util/injection-decorators'
import { HTTP_STATUS } from '../constants/app.constants'

class CartController {
    @factoryMethod
    static cartController(
        @injected('authMiddleware') authMiddleware: AuthMiddleware,
        @injected('cartService') cartService: CartService,
    ) {
        const router = Router()

        // Get cart item quantity
        router.get(
            '/cart/:shopId/item/:itemId',
            authMiddleware.requireAuth(),
            validateParams(CartSchema.shopIdAndItemIdParams),
            async (req, res) => {
                const { shopId, itemId } = req.params
                const result = await cartService.getCartItemQuantity(req.user!.id, shopId, itemId)
                res.status(HTTP_STATUS.OK).json(result)
            }
        )

        // Update cart item quantity
        router.patch(
            '/cart/:shopId/item/:itemId',
            authMiddleware.requireAuth(),
            validateParams(CartSchema.shopIdAndItemIdParams),
            validateBody(CartSchema.cartItemQuantityBody),
            async (req, res) => {
                const { shopId, itemId } = req.params
                const { quantity } = req.body
                const result = await cartService.updateCartItemQuantity(req.user!.id, shopId, itemId, quantity)
                res.status(HTTP_STATUS.OK).json(result)
            }
        )

        // Get cart information
        router.get(
            '/cart/:id',
            authMiddleware.requireAuth(),
            validateParams(CartSchema.shopIdParams),
            async (req, res) => {
                const { id: shopId } = req.params
                const result = await cartService.getCartInfo(req.user!.id, shopId)
                res.status(HTTP_STATUS.OK).json(result)
            }
        )

        // Get cart items list
        router.get(
            '/cart/:id/items',
            authMiddleware.requireAuth(),
            validateParams(CartSchema.shopIdParams),
            async (req, res) => {
                const { id: shopId } = req.params
                const result = await cartService.getCartItems(req.user!.id, shopId)
                res.status(HTTP_STATUS.OK).json(result)
            }
        )

        // Clear cart
        router.delete(
            '/cart/:id/items',
            authMiddleware.requireAuth(),
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
