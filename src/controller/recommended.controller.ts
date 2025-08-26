import { Router } from "express";
import AuthMiddleware from "../middleware/auth.middleware";
import RecommendedService from "../service/recommended.service";
import { factoryInjection, factoryMethod, injected } from "../util/injection-decorators";
import { validateQuery } from "../middleware/validator.middleware";
import * as RecommendedSchema from "../schema/recommended.schema";
import { HTTP_STATUS } from "../constants/app.constants";

class RecommendedController {

    @factoryMethod
    static recommendedController (
        @injected('authMiddleware') authMiddleware: AuthMiddleware,
        @injected('recommendedService') recommendedService: RecommendedService,
    ) {
        const router = Router()

        router.get(
            '/recommended/shops',
            authMiddleware.requireAuth(),
            validateQuery(RecommendedSchema.getRecommendedShopsQuery),
            async (req, res) => {
                const { p, pn, q, c, d, r, t, s, rc, a } =req.query as unknown as RecommendedSchema.GetRecommendedShopsQuery;
                const pageSkip = parseInt(p) * parseInt(pn)
                const pageLimit = parseInt(pn)
                const filterKeywords = q.split(' ').filter(s => s.length > 0)
                const categories = c ? [c].flat() : undefined;
                const maxDistance = d ? parseInt(d) : undefined;
                const minRating = r ? parseInt(r) : undefined;
                const maxTime = t ? parseInt(t) : undefined;
                const sorting = s;
                const hotItemCount = parseInt(rc);
                const addressId = a ? a : undefined;
                const shopInfos = await recommendedService.getRecommendedShops(
                    req.user!.id,
                    pageSkip,
                    pageLimit,
                    filterKeywords,
                    sorting,
                    hotItemCount,
                    categories,
                    maxDistance,
                    minRating,
                    maxTime,
                    addressId
                );
                res.status(HTTP_STATUS.OK).json(shopInfos);
            }
        )

        router.get(
            '/recommended/items',
            authMiddleware.requireAuth(),
            validateQuery(RecommendedSchema.getRecommendedItemsQuery),
            async (req, res) => {
                const { p, pn, q, c, d, r, t, s, a, min_p, max_p } = req.query as unknown as RecommendedSchema.GetRecommendedItemsQuery;
                const pageSkip = parseInt(p) * parseInt(pn);
                const pageLimit = parseInt(pn);
                const filterKeywords = q.split(' ').filter(s => s.length > 0);
                const categories = c ? [c].flat() : undefined;
                const maxDistance = d ? parseInt(d) : undefined;
                const minRating = r ? parseInt(r) : undefined;
                const maxTime = t ? parseInt(t) : undefined;
                const sorting = s;
                const addressId = a ? a : undefined;
                const minPrice = min_p ? parseFloat(min_p) : undefined;
                const maxPrice = max_p ? parseFloat(max_p) : undefined;
                const items = await recommendedService.getRecommendedItems(
                    req.user!.id,
                    pageSkip,
                    pageLimit,
                    filterKeywords,
                    sorting,
                    categories,
                    maxDistance,
                    minRating,
                    maxTime,
                    addressId,
                    minPrice,
                    maxPrice
                );
                res.status(HTTP_STATUS.OK).json(items);
            }
        )

        router.get(
            '/recommended/orders',
            authMiddleware.requireAuth(),
            validateQuery(RecommendedSchema.getRecommendedOrdersQuery),
            async (req, res) => {
                // OpenAPI style: parameters should be d=...&t=...&lat=...&lon=...&m=...&p=...&pn=...
                // Page number starts from p, pn is the number per page
                const { d, t, lat, lon, m, p, pn } = req.query as unknown as RecommendedSchema.GetRecommendedOrdersQuery;
                const page = Math.max(0, parseInt(p as any));
                const pageSize = Math.max(1, parseInt(pn as any));
                const pageSkip = page * pageSize;
                // Query total count
                // Query paginated data
                const orders = await recommendedService.getRecommendedOrders(
                    req.user!.id,
                    parseFloat(lat),
                    parseFloat(lon),
                    pageSkip,
                    pageSize,
                    d !== undefined ? parseFloat(d) : undefined,
                    t !== undefined ? parseInt(t) : undefined,
                    m !== undefined ? parseFloat(m) : undefined
                );
                res.status(HTTP_STATUS.OK).json(orders);
            }
        )

        return router
    }
}

export default factoryInjection(RecommendedController)
