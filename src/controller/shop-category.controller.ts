import { Router } from "express";
import { factoryInjection, factoryMethod, injected } from "../util/injection-decorators";
import AuthService from "../service/auth.service";
import ShopService from "../service/shop.service";
import * as ShopCategorySchema from "../schema/shop-category.schema";
import { validateBody, validateParams } from "../middleware/validator.middleware";

class ShopCategoryController {

    @factoryMethod
    static shopCategoryController(
        @injected('authService') authService: AuthService,
        @injected('shopService') shopService: ShopService,
    ) {

        const router = Router()

        router.get(
            '/shop-categories',
            authService.requireAuth(),
            async (req, res) => {
                const categories = await shopService.getShopCategories()
                res.status(200).json(categories.map(category => shopService.shopCategoryDataToShopCategoryInfo(category)))
            }
        )

        router.post(
            '/shop-categories',
            authService.requireAuth(),
            validateBody(ShopCategorySchema.addUpdateShopCategory),
            async (req, res) => {
                const { name } = req.body as ShopCategorySchema.AddUpdateShopCategory
                const category = await shopService.addShopCategory(req.user!.id, name)
                res.status(201).json(shopService.shopCategoryDataToShopCategoryInfo(category))
            }
        )

        router.get(
            '/shop-categories/:id',
            authService.requireAuth(),
            validateParams(ShopCategorySchema.shopCategoryParams),
            async (req, res) => {
                const { id } = req.params
                const category = await shopService.getShopCategory(id)
                res.status(200).json(shopService.shopCategoryDataToShopCategoryInfo(category))
            }
        )

        router.patch(
            '/shop-categories/:id',
            authService.requireAuth(),
            validateParams(ShopCategorySchema.shopCategoryParams),
            validateBody(ShopCategorySchema.addUpdateShopCategory),
            async (req, res) => {
                const { id } = req.params
                const { name } = req.body as ShopCategorySchema.AddUpdateShopCategory
                const category = await shopService.updateShopCategory(req.user!.id, id, name)
                res.status(200).json(shopService.shopCategoryDataToShopCategoryInfo(category))
            }
        )

        router.patch(
            '/shop-categories/:id/pos',
            authService.requireAuth(),
            validateParams(ShopCategorySchema.shopCategoryParams),
            validateBody(ShopCategorySchema.updateShopCategoryPos),
            async (req, res) => {
                const { id } = req.params
                const { before } = req.body as ShopCategorySchema.UpdateShopCategoryPos
                await shopService.updateShopCategoryPos(req.user!.id, id, before)
                res.status(204).send()
            }
        )

        router.delete(
            '/shop-categories/:id',
            authService.requireAuth(),
            validateParams(ShopCategorySchema.shopCategoryParams),
            async (req, res) => {
                const { id } = req.params
                await shopService.deleteShopCategory(req.user!.id, id)
                res.status(204).send()
            }
        )

        return router
    }

}

export default factoryInjection(ShopCategoryController)