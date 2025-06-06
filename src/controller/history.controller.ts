import { Router } from "express";
import { factoryInjection, factoryMethod, injected } from "../util/injection-decorators";
import AuthService from "../service/auth.service";

import { validateBody,validateQuery } from "../middleware/validator.middleware";
import HistoryService from "../service/history.service";
import * as HistorySchema from "../schema/history.schema";
class HistoryController {
    @factoryMethod
    static recordController(
        @injected('authService') authService: AuthService,
        @injected('historyService') historyService: HistoryService,
    ) {
        const router = Router()

        router.get(
            '/records/shops',
            authService.requireAuth(),
            validateQuery(HistorySchema.historyQueryParams),
            async (req, res) => {
                const { p, pn} = req.query as unknown as HistorySchema.HistoryQueryParams
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const shopHistorys = await historyService.getShopHistory(req.user!.id, pageSkip, pageLimit)
                res.status(200).json(await Promise.all(shopHistorys.map(async shopHistory => historyService.shopHistoryDataToFullShopHistoryInfo(shopHistory))))
            }
        )

        router.post(
            '/records/shops',
            authService.requireAuth(),
            validateBody(HistorySchema.historyIdParams),
            async (req, res) => {
                const request = req.body as HistorySchema.HistoryIdParams
                const shopHistory = await historyService.createShopHistory(req.user!.id, request.id)
                res.status(200).json(await historyService.shopHistoryDataToFullShopHistoryInfo(shopHistory))
            }
        )

        router.get(
            '/records/items',
            authService.requireAuth(),
            validateQuery(HistorySchema.historyQueryParams),
            async (req, res) => {
                const { p, pn} = req.query as unknown as HistorySchema.HistoryQueryParams
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const itemHistorys = await historyService.getItemHistory(req.user!.id, pageSkip, pageLimit)
                res.status(200).json(await Promise.all(itemHistorys.map(async itemHistory => historyService.itemHistoryDataToFullItemHistoryInfo(itemHistory))))
            }
        )

        router.post(
            '/records/items',
            authService.requireAuth(),
            validateBody(HistorySchema.historyIdParams),
            async (req, res) => {
                const request = req.body as HistorySchema.HistoryIdParams
                const itemHistory = await historyService.createItemHistory(req.user!.id, request.id)
                res.status(200).json(await historyService.itemHistoryDataToFullItemHistoryInfo(itemHistory))
            }
        )

        router.get(
            '/favorites/shops',
            authService.requireAuth(),
            validateQuery(HistorySchema.historyQueryParams),
            async (req, res) => {
                const { p, pn} = req.query as unknown as HistorySchema.HistoryQueryParams
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const shopFavourites = await historyService.getShopFavourite(req.user!.id, pageSkip, pageLimit)
                res.status(200).json(await Promise.all(shopFavourites.map(async shopFavourite => historyService.shopFavouriteDataToFullShopFavouriteInfo(shopFavourite))))
            }
        )

        router.post(
            '/favorites/shops',
            authService.requireAuth(),
            validateBody(HistorySchema.historyIdParams),
            async (req, res) => {
                const request = req.body as HistorySchema.HistoryIdParams
                const shopFavourite = await historyService.createShopFavourite(req.user!.id, request.id)
                res.status(200).json(await historyService.shopFavouriteDataToFullShopFavouriteInfo(shopFavourite))
            }
        )

        router.get(
            '/favorites/items',
            authService.requireAuth(),
            validateQuery(HistorySchema.historyQueryParams),
            async (req, res) => {
                const { p, pn} = req.query as unknown as HistorySchema.HistoryQueryParams
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const itemFavourites = await historyService.getItemFavourite(req.user!.id, pageSkip, pageLimit)
                res.status(200).json(await Promise.all(itemFavourites.map(async itemFavourite => historyService.itemFavouriteDataToFullItemFavouriteInfo(itemFavourite))))
            }
        )

        router.post(
            '/favorites/items',
            authService.requireAuth(),
            validateBody(HistorySchema.historyIdParams),
            async (req, res) => {
                const request = req.body as HistorySchema.HistoryIdParams
                const itemFavourite = await historyService.createItemFavourite(req.user!.id, request.id)
                res.status(200).json(await historyService.itemFavouriteDataToFullItemFavouriteInfo(itemFavourite))
            }
        )

        router.delete(
            '/records/shops',
            authService.requireAuth(),
            validateBody(HistorySchema.historyIdParams),
            async (req, res) => {
                const request = req.body as HistorySchema.HistoryIdParams
                await historyService.deleteShopHistory(req.user!.id, request.id)
                res.status(204).send()
            }
        )

        router.delete(
            '/records/items',
            authService.requireAuth(),
            validateBody(HistorySchema.historyIdParams),
            async (req, res) => {
                const request = req.body as HistorySchema.HistoryIdParams
                await historyService.deleteItemHistory(req.user!.id, request.id)
                res.status(204).send()
            }
        )

        router.delete(
            '/favorites/shops',
            authService.requireAuth(),
            validateBody(HistorySchema.historyIdParams),
            async (req, res) => {
                const request = req.body as HistorySchema.HistoryIdParams
                await historyService.deleteShopFavourite(req.user!.id, request.id)
                res.status(204).send()
            }
        )

        router.delete(
            '/favorites/items',
            authService.requireAuth(),
            validateBody(HistorySchema.historyIdParams),
            async (req, res) => {
                const request = req.body as HistorySchema.HistoryIdParams
                await historyService.deleteItemFavourite(req.user!.id, request.id)
                res.status(204).send()
            }
        )
    }
}

export default factoryInjection(HistoryController)