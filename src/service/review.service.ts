import { Prisma, PrismaClient } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import { CreateReview, UpdateReview } from "../schema/review.schema";
import { ResponseError } from "../util/errors";
import UserService from "./user.service";

@classInjection
export default class ReviewService {
    @injected
    private prisma!: PrismaClient;

    @injected
    private userService!: UserService

    async reviewDataToReviewInfo(review: Prisma.ReviewGetPayload<{ include: { user: true } }>) {
        return {
            id: review.id,
            order: review.orderId,
            rating: review.rating,
            content: review.content,
            createdAt: review.createdAt,
            user: {
                id: review.user.id,
                name: review.user.name,
                avatar: await this.userService.getUserAvatarLinks(review.user.id),
            }
        };
        
    }

    private async updateItemsRating(orderEntity: Prisma.OrderGetPayload<{ include: { items: { include: { item: true } }, shop: true } }>, tx: Prisma.TransactionClient) {
        if (!orderEntity.shop)
            return
        for (const item of orderEntity.items) {
            if (!item.item) {
                continue
            }
            const itemAverageRating = (await tx.review.aggregate({
                where: { order: { items: { some: { itemId: item.item.id } } } },
                _avg: { rating: true },
            }))._avg.rating || 0
            await tx.item.update({
                where: { id: item.item.id },
                data: {
                    rating: itemAverageRating,
                }
            })
        }
        const shopAverageRating = (await tx.review.aggregate({
            where: { order: { shopId: orderEntity.shop.id } },
            _avg: { rating: true },
        }))._avg.rating || 0
        await tx.shop.update({
            where: { id: orderEntity.shop.id },
            data: {
                rating: shopAverageRating,
            }
        })
    }

    async createReview(userId: string, request: CreateReview) {
        const { order, rating, content } = request;
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({ where: { id: userId}})
            if (!user) {
                throw new ResponseError(404, "User not found")
            }
            const orderEntity = await tx.order.findUnique({
                where: {
                    id: order,
                    customerId: userId,
                },
                include: {
                    shop: true,
                    items: { include: { item: true } },
                    review: true,
                }
            })
            if (!orderEntity) {
                throw new ResponseError(404, "Order not found")
            }
            if (orderEntity.status !== 'FINISHED') {
                throw new ResponseError(403, "Order is not finished")
            }
            if (!orderEntity.shop) {
                throw new ResponseError(404, "Shop not found")
            }
            if (orderEntity.review) {
                throw new ResponseError(409, "Order already has a review")
            }
            const review = await tx.review.create({
                data: {
                    userId: userId,
                    orderId: orderEntity.id,
                    rating: rating,
                    content: content,
                },
                include: { user: true }
            })
            await this.updateItemsRating(orderEntity, tx)
            return review
        })
    }

    async getReviewByOrderId(userId: string, id: string) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({ where: { id: userId}})
            if (!currentUser) {
                throw new ResponseError(401, "User not found")
            }
            const order = await tx.order.findUnique({ 
                where: { 
                    id,
                },
                include: {
                    shop: true,
                    review: { include: { user: true } },
                }
            })
            if (!order || (currentUser.role !== "ADMIN" && order.customerId !== userId && order.shop?.ownerId !== userId)) {
                throw new ResponseError(404, "Order not found")
            }
            if (!order.review) {
                throw new ResponseError(404, "Review not found")
            }
            return order.review
        })
    }

    async getReviewsByShopId(id: string, pageSkip: number, pageLimit: number) {
        return await this.prisma.$transaction(async tx => {
            const shop = await tx.shop.findUnique({
                where: { id },
                include: {
                    orders: {
                        where: { review: { isNot: null} },
                        select: { review: { include: { user: true } } },
                        orderBy: { review: { createdAt: 'desc' } },
                        skip: pageSkip,
                        take: pageLimit,
                    }
                },
            })
            if (!shop) {
                throw new ResponseError(404, "Shop not found")
            }
            return shop.orders.map(order => order.review!)
        })
    }

    async updateReview(userId: string, id: string, updateReview: UpdateReview) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({ where: { id: userId}})
            if (!currentUser) {
                throw new ResponseError(401, "User not found")
            }
            const review = await tx.review.findUnique({ 
                where: { id: id },
                include: { order: { include: { items: { include: { item: true } }, shop: true } } }
            })
            if (!review) {
                throw new ResponseError(404, "Review not found")
            }
            if (review.userId !== userId && currentUser.role !== "ADMIN") {
                throw new ResponseError(403, "You are not authorized to update this review or admin")
            }
            const ret = await tx.review.update({
                where: { id: id },
                data: {
                    rating: updateReview.rating,
                    content: updateReview.content,
                }
            })
            await this.updateItemsRating(review.order, tx)
            return ret
        })
    }

    async deleteReview(userId: string, id: string) {
        await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({ where: { id: userId}})
            if (!currentUser) {
                throw new ResponseError(401, "User not found")
            }
            const review = await tx.review.findUnique({
                where: { id },
                include: { order: { include: { items: { include: { item: true } }, shop: true } } }
            })
            if (!review) {
                throw new ResponseError(404, "Review not found")
            }
            if (review.userId !== userId && currentUser.role !== "ADMIN") {
                throw new ResponseError(403, "Permission denied")
            }
            await tx.review.delete({
                where: { id },
            })
            this.updateItemsRating(review.order, tx)
        })
    }
}