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
                res.status(HTTP_STATUS.OK).json(shopHistorys)
            }
        )

        router.post(
            '/records/shops/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                const shopHistory = await historyService.createShopHistory(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(shopHistory)
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
                res.status(HTTP_STATUS.OK).json(itemHistorys)
            }
        )

        router.post(
            '/records/items/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                const itemHistory = await historyService.createItemHistory(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(itemHistory)
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
                res.status(HTTP_STATUS.OK).json(shopFavourites)
            }
        )

        router.post(
            '/favorites/shops/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                const shopFavourite = await historyService.createShopFavourite(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(shopFavourite)
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
                res.status(HTTP_STATUS.OK).json(itemFavourites)
            }
        )

        router.post(
            '/favorites/items/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                const itemFavourite = await historyService.createItemFavourite(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(itemFavourite)
            }
        )

        router.get(
            '/favorites/shops/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                const shopFavourite = await historyService.getShopFavouriteById(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(shopFavourite)
            }
        )

        router.get(
            '/favorites/items/:id',
            authMiddleware.requireAuth(),
            validateParams(HistorySchema.historyIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as HistorySchema.HistoryIdParams
                const itemFavourite = await historyService.getItemFavouriteById(req.user!.id, id)
                res.status(HTTP_STATUS.OK).json(itemFavourite)
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

