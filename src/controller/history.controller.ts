import { Router } from "express";
import { factoryInjection, factoryMethod, injected } from "../util/injection-decorators";
import AuthMiddleware from "../middleware/auth.middleware";
import { validateParams,validateQuery } from "../middleware/validator.middleware";
import HistoryService from "../service/history.service";
import * as HistorySchema from "../schema/history.schema";
import { HTTP_STATUS } from "../constants/app.constants";
class HistoryController {
    @factoryMethod
    static recordController(
        @injected('authMiddleware') authMiddleware: AuthMiddleware,
        @injected('historyService') historyService: HistoryService,
    ) {
        const router = Router()

        router.get(
            '/records/shops',
            authMiddleware.requireAuth(),
            validateQuery(HistorySchema.historyQueryParams),
            async (req, res) => {
                const { p, pn} = req.query as unknown as HistorySchema.HistoryQueryParams
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const shopHistorys = await historyService.getShopHistory(req.user!.id, pageSkip, pageLimit)
                res.status(HTTP_STATUS.OK).json(await Promise.all(shopHistorys.map(async shopHistory => await historyService.shopHistoryDataToFullShopHistoryInfo(shopHistory))))
            }
        )

        router.post(
            '/records/shops/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                const shopHistory = await historyService.createShopHistory(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(await historyService.shopHistoryDataToFullShopHistoryInfo(shopHistory))
            }
        )

        router.get(
            '/records/items',
            authMiddleware.requireAuth(),
            validateQuery(HistorySchema.historyQueryParams),
            async (req, res) => {
                const { p, pn} = req.query as unknown as HistorySchema.HistoryQueryParams
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const itemHistorys = await historyService.getItemHistory(req.user!.id, pageSkip, pageLimit)
                res.status(HTTP_STATUS.OK).json(await Promise.all(itemHistorys.map(async itemHistory => await historyService.itemHistoryDataToFullItemHistoryInfo(itemHistory))))
            }
        )

        router.post(
            '/records/items/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                const itemHistory = await historyService.createItemHistory(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(await historyService.itemHistoryDataToFullItemHistoryInfo(itemHistory))
            }
        )

        router.get(
            '/favorites/shops',
            authMiddleware.requireAuth(),
            validateQuery(HistorySchema.historyQueryParams),
            async (req, res) => {
                const { p, pn} = req.query as unknown as HistorySchema.HistoryQueryParams
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const shopFavourites = await historyService.getShopFavourite(req.user!.id, pageSkip, pageLimit)
                res.status(HTTP_STATUS.OK).json(await Promise.all(shopFavourites.map(async shopFavourite => await historyService.shopFavouriteDataToFullShopFavouriteInfo(shopFavourite))))
            }
        )

        router.post(
            '/favorites/shops/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                const shopFavourite = await historyService.createShopFavourite(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(await historyService.shopFavouriteDataToFullShopFavouriteInfo(shopFavourite))
            }
        )

        router.get(
            '/favorites/items',
            authMiddleware.requireAuth(),
            validateQuery(HistorySchema.historyQueryParams),
            async (req, res) => {
                const { p, pn} = req.query as unknown as HistorySchema.HistoryQueryParams
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const itemFavourites = await historyService.getItemFavourite(req.user!.id, pageSkip, pageLimit)
                res.status(HTTP_STATUS.OK).json(await Promise.all(itemFavourites.map(async itemFavourite => await historyService.itemFavouriteDataToFullItemFavouriteInfo(itemFavourite))))
            }
        )

        router.post(
            '/favorites/items/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                const itemFavourite = await historyService.createItemFavourite(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(await historyService.itemFavouriteDataToFullItemFavouriteInfo(itemFavourite))
            }
        )

        router.get(
            '/favorites/shops/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                const shopFavourite = await historyService.getShopFavouriteById(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(await historyService.shopFavouriteDataToFullShopFavouriteInfo(shopFavourite))
            }
        )

        router.get(
            '/favorites/items/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                const itemFavourite = await historyService.getItemFavouriteById(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(await historyService.itemFavouriteDataToFullItemFavouriteInfo(itemFavourite))
            }
        )

        router.delete(
            '/records/shops/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                await historyService.deleteShopHistory(req.user!.id, id)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        router.delete(
            '/records/items/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                await historyService.deleteItemHistory(req.user!.id, id)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        router.delete(
            '/favorites/shops/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                await historyService.deleteShopFavourite(req.user!.id, id)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        router.delete(
            '/favorites/items/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                await historyService.deleteItemFavourite(req.user!.id, id)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        return router
    }
}

export default factoryInjection(HistoryController)
