import { PrismaClient } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import { CreateReview, UpdateReview } from "../schema/review.schema";
import { ResponseError } from "../util/errors";

@classInjection
export default class ReviewService {
    @injected
    private prisma!: PrismaClient;

    async createReview(userId: string, request: CreateReview) {
        const { order, rating, content } = request;
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({ where: { id: userId}})
            if (!user) {
                throw new ResponseError(404, "User not found")
            }
            const orderEntity = await tx.order.findUnique({ where: { id: order}})
            if (!orderEntity) {
                throw new ResponseError(404, "Order not found")
            }
            const shop = await tx.shop.findUnique({ where: { id: orderEntity.shopId! }})
            if (!shop) {
                throw new ResponseError(404, "Shop not found")
            }
            return await tx.review.create({
                data: {
                    userId: userId,
                    orderId: orderEntity.id,
                    shopId: shop.id,
                    rating: rating,
                    content: content,
                }
            })
        })
    }

    async getReviewByOrderId(userId: string, id: string) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({ where: { id: userId}})
            if (!currentUser) {
                throw new ResponseError(401, "User not found")
            }
            const review = await tx.review.findUnique({ where: { orderId: id}})
            if (!review || review.userId !== userId && currentUser.role !== "ADMIN") {
                throw new ResponseError(404, "Review not found or Permission denied")
            }
            const shop = await tx.shop.findUnique({ where: { id: review.shopId! }})
            if (shop?.ownerId !== userId && currentUser.role !== "ADMIN") {
                throw new ResponseError(403, "Permission denied")
            }
            return review
        })
    }

    async getReviewsByShopId(id: string, pageSkip: number, pageLimit: number) {
        return await this.prisma.$transaction(async tx => {
            const shop = await tx.shop.findUnique({ where: { id: id}})
            if (!shop) {
                throw new ResponseError(404, "Shop not found")
            }
            const review = await tx.review.findMany({
                where: { shopId: id },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: "desc" },
            })
            return review
        })
    }

    async updateReview(userId: string, id: string, review: UpdateReview) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({ where: { id: userId}})
            if (!currentUser) {
                throw new ResponseError(401, "User not found")
            }
            const review = await tx.review.findUnique({ where: { id: id}})
            if (!review) {
                throw new ResponseError(404, "Review not found")
            }
            if (review.userId !== userId && currentUser.role !== "ADMIN") {
                throw new ResponseError(403, "You are not authorized to update this review or admin")
            }
            return await tx.review.update({
                where: { id: id },
                data: {
                    rating: review.rating,
                    content: review.content,
                }
            })
        })
    }

    async deleteReview(userId: string, id: string) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({ where: { id: userId}})
            if (!currentUser) {
                throw new ResponseError(401, "User not found")
            }
            const review = await tx.review.findUnique({ where: { id: id}})
            if (!review) {
                throw new ResponseError(404, "Review not found")
            }
            if (review.userId !== userId && currentUser.role !== "ADMIN") {
                throw new ResponseError(403, "Permission denied")
            }
            return await tx.review.delete({
                where: { id: id },
            })
        })
    }
}