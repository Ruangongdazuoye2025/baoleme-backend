import { Router } from 'express'
import { factoryInjection, factoryMethod, injected } from '../util/injection-decorators'
import AuthMiddleware from '../middleware/auth.middleware'
import ItemService from '../service/item.service'
import { validateBody, validateParams } from '../middleware/validator.middleware'
import * as ItemCategorySchema from '../schema/item-category.schema'
import { HTTP_STATUS } from '../constants/app.constants'

class ItemCategoryController {
    @factoryMethod
    static itemCategoryController(
        @injected('authMiddleware') authMiddleware: AuthMiddleware,
        @injected('itemService') itemService: ItemService
    ) {
        const router = Router()

        router.get(
            '/shops/:shopId/item-categories',
            authMiddleware.requireAuth(),
            validateParams(ItemCategorySchema.shopIdParams),
            async (req, res) => {
                const { shopId } = req.params
                const categories = await itemService.getItemCategories(shopId)
                res.status(HTTP_STATUS.OK).json(categories.map(category => itemService.itemCategoryDataToItemCategoryInfo(category)))
            }
        )

        router.post(
            '/shops/:shopId/item-categories',
            authMiddleware.requireAuth(),
            validateParams(ItemCategorySchema.shopIdParams),
            validateBody(ItemCategorySchema.addUpdateItemCategory),
            async (req, res) => {
                const { shopId } = req.params
                const { name } = req.body as ItemCategorySchema.AddUpdateItemCategory
                const category = await itemService.addItemCategory(req.user!.id, shopId, name)
                res.status(HTTP_STATUS.CREATED).json(itemService.itemCategoryDataToItemCategoryInfo(category))
            }
        )

        router.get(
            '/shops/:shopId/item-categories/:categoryId',
            authMiddleware.requireAuth(),
            validateParams(ItemCategorySchema.shopIdCategoryIdParams),
            async (req, res) => {
                const { shopId, categoryId } = req.params
                const category = await itemService.getItemCategory(shopId, categoryId)
                res.status(HTTP_STATUS.OK).json(itemService.itemCategoryDataToItemCategoryInfo(category))
            }
        )

        router.patch(
            '/shops/:shopId/item-categories/:categoryId',
            authMiddleware.requireAuth(),
            validateParams(ItemCategorySchema.shopIdCategoryIdParams),
            validateBody(ItemCategorySchema.addUpdateItemCategory),
            async (req, res) => {
                const { shopId, categoryId } = req.params
                const { name } = req.body as ItemCategorySchema.AddUpdateItemCategory
                const category = await itemService.updateItemCategory(req.user!.id, shopId, categoryId, name)
                res.status(HTTP_STATUS.OK).json(itemService.itemCategoryDataToItemCategoryInfo(category))
            }
        )

        router.patch(
            '/shops/:shopId/item-categories/:categoryId/pos',
            authMiddleware.requireAuth(),
            validateParams(ItemCategorySchema.shopIdCategoryIdParams),
            validateBody(ItemCategorySchema.updateItemCategoryPos),
            async (req, res) => {
                const { shopId, categoryId } = req.params
                const { before } = req.body as ItemCategorySchema.UpdateItemCategoryPos
                await itemService.updateItemCategoryPos(req.user!.id, shopId, categoryId, before)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        router.delete(
            '/shops/:shopId/item-categories/:categoryId',
            authMiddleware.requireAuth(),
            validateParams(ItemCategorySchema.shopIdCategoryIdParams),
            async (req, res) => {
                const { shopId, categoryId } = req.params
                await itemService.deleteItemCategory(req.user!.id, shopId, categoryId)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        return router
    }
}

export default factoryInjection(ItemCategoryController)