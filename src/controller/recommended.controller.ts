import { Router } from "express";
import AuthService from "../service/auth.service";
import RecommendedService from "../service/recommended.service";
import { factoryInjection, factoryMethod, injected } from "../util/injection-decorators";
import { validateQuery } from "../middleware/validator.middleware";
import * as RecommendedSchema from "../schema/recommended.schema";

class RecommendedController {

    @factoryMethod
    static recommendedController (
        @injected('authService') authService: AuthService,
        @injected('recommendedService') recommendedService: RecommendedService,
    ) {
        const router = Router()

        router.get(
            '/recommended/shops',
            authService.requireAuth(),
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
                res.status(200).json(shopInfos);
            }
        )

        router.get(
            '/recommended/items',
            authService.requireAuth(),
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
                res.status(200).json(items);
            }
        )

        router.get(
            '/recommended/orders',
            authService.requireAuth(),
            validateQuery(RecommendedSchema.getRecommendedOrdersQuery),
            async (req, res) => {
                // OpenAPI风格：参数应为 ?d=...&t=...&lat=...&lon=...&m=...&p=...&pn=...
                // 页码p从0开始，pn为每页数量
                const { d, t, lat, lon, m, p, pn } = req.query as unknown as RecommendedSchema.GetRecommendedOrdersQuery;
                const page = Math.max(0, parseInt(p as any));
                const pageSize = Math.max(1, parseInt(pn as any));
                const pageSkip = page * pageSize;
                // 查询总数
                // 查询分页数据
                const orders = await recommendedService.getRecommendedOrders(
                    req.user!.id,
                    lat,
                    lon,
                    pageSkip,
                    pageSize,
                    d,
                    t,
                    m
                );
                res.status(200).json(orders);
            }
        )

        return router
    }
}

export default factoryInjection(RecommendedController)