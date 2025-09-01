import { Context, ServiceSchema, Errors } from "moleculer";
import { PrismaClient, UserRole } from "@prisma/client";
import Joi from "joi";
import { AuthMeta } from "../mixins/api-auth.mixin";

// --- Joi Schemas and TypeScript Interfaces ---

const createReviewSchema = Joi.object({
    order: Joi.string().uuid().required(),
    rating: Joi.number().integer().min(0).max(50).required(),
    content: Joi.string().required()
});

interface CreateReviewRequest {
    order: string;
    rating: number;
    content: string;
}

const getReviewByOrderIdSchema = Joi.object({
    id: Joi.string().uuid().required()
});

interface GetReviewByOrderIdRequest {
    id: string;
}

const getReviewsByShopIdSchema = Joi.object({
    id: Joi.string().uuid().required(),
    p: Joi.number().integer().min(0).default(0).optional(),
    pn: Joi.number().integer().min(1).max(100).default(10).optional()
});

interface GetReviewsByShopIdRequest {
    id: string;
    p: number;
    pn: number;
}

const updateReviewSchema = Joi.object({
    id: Joi.string().uuid().required(),
    rating: Joi.number().integer().min(0).max(50).required(),
    content: Joi.string().required()
});

interface UpdateReviewRequest {
    id: string;
    rating: number;
    content: string;
}

const deleteReviewSchema = Joi.object({
    id: Joi.string().uuid().required()
});

interface DeleteReviewRequest {
    id: string;
}

// --- Review Service Definition ---

const ReviewService: ServiceSchema = {
    name: "review",

    actions: {
        /**
         * Create a new review for an order.
         */
        create: {
            params: createReviewSchema as any,
            async handler(ctx: Context<CreateReviewRequest, AuthMeta>) {
                const { order, rating, content } = ctx.params;
                const { currentUserId } = ctx.meta;

                // Get order information
                const orderEntity: any = await ctx.call("order.getOrderById", { id: order });
                if (!orderEntity) {
                    throw new Errors.MoleculerError("Order not found", 404, "ORDER_NOT_FOUND");
                }
                
                // Check if order belongs to current user
                if (orderEntity.customer !== currentUserId) {
                    throw new Errors.MoleculerError("Order not found", 404, "ORDER_NOT_FOUND");
                }

                if (orderEntity.status !== 'finished') {
                    throw new Errors.MoleculerError("Order is not finished", 403, "ORDER_NOT_FINISHED");
                }

                // Validate shop exists
                if (!orderEntity.shop) {
                    throw new Errors.MoleculerError("Shop not found", 404, "SHOP_NOT_FOUND");
                }

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    // Check if review already exists
                    const existingReview = await tx.review.findUnique({
                        where: { orderId: order }
                    });
                    if (existingReview) {
                        throw new Errors.MoleculerError("Order already has a review", 409, "ORDER_ALREADY_HAS_REVIEW");
                    }

                    const review = await tx.review.create({
                        data: {
                            userId: currentUserId,
                            orderId: order,
                            rating: rating,
                            content: content,
                        }
                    });

                    // Async update ratings (outside transaction to avoid cross-service dependencies)
                    setImmediate(() => {
                        this.updateItemsAndShopRating(orderEntity.id, orderEntity.shop)
                            .catch((error: any) => console.error('Failed to update ratings:', error));
                    });

                    return await this.reviewDataToReviewInfo(review, ctx);
                });
            }
        },

        /**
         * Get review by order ID.
         */
        getByOrderId: {
            params: getReviewByOrderIdSchema as any,
            async handler(ctx: Context<GetReviewByOrderIdRequest, AuthMeta>) {
                const { id } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;

                // Get order information
                const order: any = await ctx.call("order.getOrderById", { id });
                if (!order) {
                    throw new Errors.MoleculerError("Order not found", 404, "ORDER_NOT_FOUND");
                }

                // Check permissions: admin, customer, or shop owner
                let hasPermission = currentUserRole === UserRole.ADMIN || order.customer === currentUserId;

                if (!hasPermission && order.shop) {
                    const shop: any = await ctx.call("shop.get", { id: order.shop });
                    hasPermission = shop?.owner === currentUserId;
                }

                if (!hasPermission) {
                    throw new Errors.MoleculerError("Order not found", 404, "ORDER_NOT_FOUND");
                }

                // Get review
                const review = await (this.prisma as PrismaClient).review.findUnique({
                    where: { orderId: id }
                });

                if (!review) {
                    throw new Errors.MoleculerError("Review not found", 404, "REVIEW_NOT_FOUND");
                }

                return await this.reviewDataToReviewInfo(review, ctx);
            }
        },

        /**
         * Get reviews by shop ID with pagination.
         */
        getByShopId: {
            params: getReviewsByShopIdSchema as any,
            async handler(ctx: Context<GetReviewsByShopIdRequest, AuthMeta>) {
                const { id, p, pn } = ctx.params;
                const pageSkip = p * pn;
                const pageLimit = pn;

                // Get order IDs for this shop
                const orderIds: string[] = await ctx.call("order.getOrderIdsByShopId", { shopId: id });

                // Get reviews for these orders
                const reviews = await (this.prisma as PrismaClient).review.findMany({
                    where: { 
                        orderId: { in: orderIds }
                    },
                    orderBy: { createdAt: 'desc' },
                    skip: pageSkip,
                    take: pageLimit
                });

                // Convert to full information
                return await Promise.all(reviews.map(review => 
                    this.reviewDataToReviewInfo(review, ctx)
                ));
            }
        },

        /**
         * Update a review.
         */
        update: {
            params: updateReviewSchema as any,
            async handler(ctx: Context<UpdateReviewRequest, AuthMeta>) {
                const { id, rating, content } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;

                // Get review information
                const review = await (this.prisma as PrismaClient).review.findUnique({ 
                    where: { id }
                });
                if (!review) {
                    throw new Errors.MoleculerError("Review not found", 404, "REVIEW_NOT_FOUND");
                }

                // Check permissions
                if (review.userId !== currentUserId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError("You are not authorized to update this review", 403, "UNAUTHORIZED_UPDATE");
                }

                // Get order information
                const order: any = await ctx.call("order.getOrderById", { id: review.orderId });
                if (!order) {
                    throw new Errors.MoleculerError("Order not found", 404, "ORDER_NOT_FOUND");
                }

                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    // Update review
                    const updatedReview = await tx.review.update({
                        where: { id },
                        data: {
                            rating,
                            content,
                        }
                    });

                    // Async update ratings (outside transaction)
                    if (order.shop) {
                        setImmediate(() => {
                            this.updateItemsAndShopRating(order.id, order.shop)
                                .catch((error: any) => console.error('Failed to update ratings:', error));
                        });
                    }

                    return await this.reviewDataToReviewInfo(updatedReview, ctx);
                });
            }
        },

        /**
         * Delete a review.
         */
        delete: {
            params: deleteReviewSchema as any,
            async handler(ctx: Context<DeleteReviewRequest, AuthMeta>) {
                const { id } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;

                // Get review information
                const review = await (this.prisma as PrismaClient).review.findUnique({
                    where: { id }
                });
                if (!review) {
                    throw new Errors.MoleculerError("Review not found", 404, "REVIEW_NOT_FOUND");
                }

                // Check permissions
                if (review.userId !== currentUserId && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError("Permission denied", 403, "PERMISSION_DENIED");
                }

                // Get order information
                const order: any = await ctx.call("order.getOrderById", { id: review.orderId });

                await (this.prisma as PrismaClient).$transaction(async tx => {
                    // Delete review
                    await tx.review.delete({
                        where: { id },
                    });
                });

                // Async update ratings (outside transaction)
                if (order?.shop) {
                    setImmediate(() => {
                        this.updateItemsAndShopRating(order.id, order.shop)
                            .catch((error: any) => console.error('Failed to update ratings:', error));
                    });
                }
            }
        }
    },

    methods: {
        /**
         * Convert review data to review info format.
         */
        async reviewDataToReviewInfo(review: { id: string; content: string; rating: number; createdAt: Date; updatedAt: Date; orderId: string; userId: string }, ctx: Context) {
            // Get user information through user service
            const user: any = await ctx.call("user.get", { id: review.userId });
            
            return {
                id: review.id,
                order: review.orderId,
                rating: review.rating,
                content: review.content,
                createdAt: review.createdAt,
                user: user ? {
                    id: user.id,
                    name: user.name,
                    avatar: user.avatar,
                } : null
            };
        },

        /**
         * Update items and shop rating based on reviews.
         */
        async updateItemsAndShopRating(orderId: string, shopId: string) {
            try {
                // Get order items
                const orderItems: any[] = await this.broker.call("order.getOrderItemsByOrderId", { id: orderId });

                // Update each item's rating
                for (const orderItem of orderItems) {
                    if (orderItem.itemId) {
                        // Get all order items for this item
                        const ordersWithThisItem: any[] = await this.broker.call("order.getOrderItemsByItemId", { itemId: orderItem.itemId });
                        const orderIds = ordersWithThisItem.map(item => item.orderId);
                        
                        // Calculate average rating for this item
                        const reviewsOnThisItem = await (this.prisma as PrismaClient).review.findMany({
                            where: {
                                orderId: { in: orderIds }
                            }
                        });
                        
                        const itemAverageRating = reviewsOnThisItem.length > 0 
                            ? reviewsOnThisItem.reduce((sum, review) => sum + review.rating, 0) / reviewsOnThisItem.length
                            : 0;
                        
                        // Update item rating through ItemService
                        await this.broker.call("item.updateItemRating", { 
                            itemId: orderItem.itemId, 
                            rating: itemAverageRating 
                        });
                    }
                }

                // Update shop rating
                const shopOrderIds: string[] = await this.broker.call("order.getOrderIdsByShopId", { shopId });
                
                const reviewsOnThisShop = await (this.prisma as PrismaClient).review.findMany({
                    where: {
                        orderId: { in: shopOrderIds }
                    }
                });
                
                const shopAverageRating = reviewsOnThisShop.length > 0 
                    ? reviewsOnThisShop.reduce((sum, review) => sum + review.rating, 0) / reviewsOnThisShop.length
                    : 0;
                
                // Update shop rating through ShopService
                await this.broker.call("shop.updateShopRating", { 
                    shopId, 
                    rating: shopAverageRating 
                });
            } catch (error) {
                console.error('Error updating ratings:', error);
                throw error;
            }
        }
    },

    /**
     * Service created lifecycle event handler.
     */
    created() {
        this.prisma = new PrismaClient();
    },

    /**
     * Service stopped lifecycle event handler.
     */
    async stopped() {
        await (this.prisma as PrismaClient).$disconnect();
    }
};

export default ReviewService;
