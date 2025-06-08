import { Router } from "express";
import AuthService from "../service/auth.service";
import ReviewService from "../service/review.service";
import { factoryInjection, factoryMethod, injected } from "../util/injection-decorators";
import * as ReviewSchema from "../schema/review.schema";
import { validateBody, validateParams, validateQuery } from "../middleware/validator.middleware";

class ReviewController {
    @factoryMethod
    static reviewController(
        @injected('authService') authService: AuthService,
        @injected('reviewService') reviewService: ReviewService
    ) {
        const router = Router();

        router.post(
            '/comments',
            authService.requireAuth(),
            validateBody(ReviewSchema.createReview),
            async (req, res) => {
                const request = req.body as ReviewSchema.CreateReview;
                const review = await reviewService.createReview(req.user!.id, request);
                res.status(201).json(await reviewService.reviewDataToReviewInfo(review));
            }
        )

        router.get(
            '/comments/by-order/:id',
            authService.requireAuth(),
            validateParams(ReviewSchema.orderIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as ReviewSchema.OrderIdParams;
                const review = await reviewService.getReviewByOrderId(req.user!.id, id);
                res.status(200).json(await reviewService.reviewDataToReviewInfo(review));
            }

        )
        
        router.get(
            '/shop/:id/comments',
            authService.requireAuth(),
            validateParams(ReviewSchema.shopIdParams),
            validateQuery(ReviewSchema.getReviewQuery),
            async (req, res) => {
                const { id } = req.params as unknown as ReviewSchema.ShopIdParams;
                const { p, pn } = req.query as unknown as ReviewSchema.GetReviewQuery;
                const pageSkip = parseInt(p) * parseInt(pn);
                const pageLimit = parseInt(pn);
                const reviews = await reviewService.getReviewsByShopId(id, pageSkip, pageLimit);
                res.status(200).json(await Promise.all(reviews.map(review => reviewService.reviewDataToReviewInfo(review))));
            }
        )

        router.patch(
            '/comments/:id',
            authService.requireAuth(),
            validateParams(ReviewSchema.reviewIdParams),
            validateBody(ReviewSchema.updateReview),
            async (req, res) => {
                const { id } = req.params as unknown as ReviewSchema.ReviewIdParams;
                const updateReview = req.body as ReviewSchema.UpdateReview;
                const review = await reviewService.updateReview(req.user!.id, id, updateReview);
                res.status(200).json({
                    rating: review.rating,
                    content: review.content,
                });
            }
        )

        router.delete(
            '/comments/:id',
            authService.requireAuth(),
            validateParams(ReviewSchema.reviewIdParams),
            async (req, res) => {
                const { id } = req.params as unknown as ReviewSchema.ReviewIdParams;
                await reviewService.deleteReview(req.user!.id, id);
                res.status(204).send();
            }
        )

        return router;
    }
}

export default factoryInjection(ReviewController);