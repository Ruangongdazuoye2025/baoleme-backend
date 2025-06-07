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
                console.log(c)
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

        return router
    }
}

export default factoryInjection(RecommendedController)