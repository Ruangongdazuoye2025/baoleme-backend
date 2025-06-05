import { Router } from 'express'
import { factoryInjection, factoryMethod, injected } from '../util/injection-decorators'
import AuthService from '../service/auth.service'
import ItemService from '../service/item.service'
import { validateBody, validateParams } from '../middleware/validator.middleware'
import * as ItemCategorySchema from '../schema/item-category.schema'

class ItemCategoryController {
    @factoryMethod
    static itemCategoryController(
        @injected('authService') authService: AuthService,
        @injected('itemService') itemService: ItemService
    ) {
        const router = Router()

        router.get(
            '/shops/:shopId/item-categories',
            authService.requireAuth(),
            validateParams(ItemCategorySchema.shopIdParams),
            async (req, res) => {
                const { shopId } = req.params
                const categories = await itemService.getItemCategories(shopId)
                res.status(200).json(categories.map(category => itemService.itemCategoryDataToItemCategoryInfo(category)))
            }
        )

        router.post(
            '/shops/:shopId/item-categories',
            authService.requireAuth(),
            validateParams(ItemCategorySchema.shopIdParams),
            validateBody(ItemCategorySchema.addUpdateItemCategory),
            async (req, res) => {
                const { shopId } = req.params
                const { name } = req.body as ItemCategorySchema.AddUpdateItemCategory
                const category = await itemService.addItemCategory(req.user!.id, shopId, name)
                res.status(201).json(itemService.itemCategoryDataToItemCategoryInfo(category))
            }
        )

        router.get(
            '/shops/:shopId/item-categories/:categoryId',
            authService.requireAuth(),
            validateParams(ItemCategorySchema.shopIdCategoryIdParams),
            async (req, res) => {
                const { shopId, categoryId } = req.params
                const category = await itemService.getItemCategory(shopId, categoryId)
                res.status(200).json(itemService.itemCategoryDataToItemCategoryInfo(category))
            }
        )

        router.patch(
            '/shops/:shopId/item-categories/:categoryId',
            authService.requireAuth(),
            validateParams(ItemCategorySchema.shopIdCategoryIdParams),
            validateBody(ItemCategorySchema.addUpdateItemCategory),
            async (req, res) => {
                const { shopId, categoryId } = req.params
                const { name } = req.body as ItemCategorySchema.AddUpdateItemCategory
                const category = await itemService.updateItemCategory(req.user!.id, shopId, categoryId, name)
                res.status(200).json(itemService.itemCategoryDataToItemCategoryInfo(category))
            }
        )

        router.patch(
            '/shops/:shopId/item-categories/:categoryId/pos',
            authService.requireAuth(),
            validateParams(ItemCategorySchema.shopIdCategoryIdParams),
            validateBody(ItemCategorySchema.updateItemCategoryPos),
            async (req, res) => {
                const { shopId, categoryId } = req.params
                const { before } = req.body as ItemCategorySchema.UpdateItemCategoryPos
                await itemService.updateItemCategoryPos(req.user!.id, shopId, categoryId, before)
                res.status(204).send()
            }
        )

        router.delete(
            '/shops/:shopId/item-categories/:categoryId',
            authService.requireAuth(),
            validateParams(ItemCategorySchema.shopIdCategoryIdParams),
            async (req, res) => {
                const { shopId, categoryId } = req.params
                await itemService.deleteItemCategory(req.user!.id, shopId, categoryId)
                res.status(204).send()
            }
        )

        return router
    }
}

export default factoryInjection(ItemCategoryController)