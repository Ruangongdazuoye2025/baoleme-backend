import { Router } from "express";
import { factoryInjection, factoryMethod, injected } from "../util/injection-decorators";
import AuthService from "../service/auth.service";
import * as UserSchema from "../schema/user.schema";
import * as ShopSchema from "../schema/shop.schema";
import { acceptMaximumSize, acceptMimeTypes, validateBody, validateImage, validateParams, validateQuery } from "../middleware/validator.middleware";
import UserService from "../service/user.service";
import ShopService from "../service/shop.service";
import upload from "../middleware/upload.middleware";

class ShopController {

    @factoryMethod
    static shopController(
        @injected('authService') authService: AuthService,
        @injected('shopService') shopService: ShopService,
    ) {
        const router = Router()

        router.get(
            '/shops',
            authService.requireAuth(),
            validateQuery(ShopSchema.getShopsQuery),
            async (req, res) => {
                const { p, pn, q, min_ca, max_ca } = req.query as unknown as ShopSchema.GetShopsQuery
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const filterKeywords = q.split(' ').filter(s => s.length > 0)
                const minCreatedAt = min_ca ? new Date(min_ca) : undefined
                const maxCreatedAt = max_ca ? new Date(max_ca) : undefined
                const shops = await shopService.getFilteredGlobalShops(req.user!.id, pageSkip, pageLimit, filterKeywords, minCreatedAt, maxCreatedAt)
                res.status(200).json(await Promise.all(shops.map(async shop => shopService.shopDataToFullShopInfo(shop))))
            }
        )

        router.get(
            '/user/:id/shops',
            authService.requireAuth(),
            validateParams(UserSchema.userProfileParams),
            async (req, res) => {
                const { id } = req.params
                const shops = await shopService.getShopsByOwnerId(id)
                res.status(200).json(await Promise.all(shops.map(async shop => shopService.shopDataToFullShopInfo(shop))))
            }
        )

        router.post(
            '/shops',
            authService.requireAuth(),
            validateBody(ShopSchema.createShop),
            async (req, res) => {
                const request = req.body as ShopSchema.CreateShop
                const shop = await shopService.createShop(req.user!.id, request)
                res.status(201).json(await shopService.shopDataToFullShopInfo(shop))
            }
        )

        router.get(
            '/shops/:id',
            authService.requireAuth(),
            validateParams(ShopSchema.shopIdParams),
            async (req, res) => {
                const { id } = req.params
                const shop = await shopService.getShop(id)
                res.status(200).json(await shopService.shopDataToFullShopInfo(shop))
            }
        )

        router.delete(
            '/shops/:id',
            authService.requireAuth(),
            validateParams(ShopSchema.shopIdParams),
            async (req, res) => {
                const { id } = req.params
                await shopService.deleteShop(req.user!.id, id)
                res.status(204).send()
            }
        )

        router.patch(
            '/shops/:id/profile',
            authService.requireAuth(),
            validateParams(ShopSchema.shopIdParams),
            validateBody(ShopSchema.updateShopProfile),
            async (req, res) => {
                const { id } = req.params
                let request = req.body as ShopSchema.UpdateShopProfile
                const updatedShop = await shopService.updateShopProfile(req.user!.id, id, request)
                res.status(200).json(shopService.shopDataToShopProfile(updatedShop))
            }
        )

        router.patch(
            '/shops/:id/image',
            upload.fields([
                {
                    name: 'cover',
                    maxCount: 1
                },
                {
                    name: 'detailImage',
                    maxCount: 1
                },
                {
                    name: 'license',
                    maxCount: 1
                }
            ]),
            authService.requireAuth(),
            validateParams(ShopSchema.shopIdParams),
            acceptMimeTypes(/^image\//),
            acceptMaximumSize(4 * 1024 * 1024),
            validateImage(),
            async (req, res) => {
                const { id } = req.params
                const { cover, detailImage, license } = req.files as {
                    cover?: Express.Multer.File[]
                    detailImage?: Express.Multer.File[]
                    license?: Express.Multer.File[]
                }
                await shopService.updateShopImage(req.user!.id, id, cover?.[0].buffer, detailImage?.[0].buffer, license?.[0].buffer)
                res.status(200).json(await shopService.getShopImageLinks(id))
            }
        )

        router.patch(
            '/shops/:id/owner',
            authService.requireAuth(),
            validateParams(ShopSchema.shopIdParams),
            validateBody(ShopSchema.updateShopOwner),
            async (req, res) => {
                const { id } = req.params
                const { owner } = req.body as ShopSchema.UpdateShopOwner
                await shopService.updateShopOwner(req.user!.id, id, owner)
                res.status(204).send()
            }
        )

        return router
    }

}

export default factoryInjection(ShopController)