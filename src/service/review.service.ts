import { Prisma, PrismaClient } from "@prisma/client";
import { classInjection, injected } from "../util/injection-decorators";
import { CreateReview, UpdateReview } from "../schema/review.schema";
import { ResponseError } from "../util/errors";
import { HTTP_STATUS } from "../constants/app.constants";
import UserService from "./user.service";
import OrderService from "./order.service";
import ShopService from "./shop.service";
import ItemService from "./item.service";

const REVIEW_ERROR_MESSAGES = {
    USER_NOT_FOUND: 'User not found',
    ORDER_NOT_FOUND: 'Order not found',
    ORDER_NOT_FINISHED: 'Order is not finished',
    SHOP_NOT_FOUND: 'Shop not found',
    ORDER_ALREADY_HAS_REVIEW: 'Order already has a review',
    REVIEW_NOT_FOUND: 'Review not found',
    UNAUTHORIZED_UPDATE: 'You are not authorized to update this review or admin',
    PERMISSION_DENIED: 'Permission denied',
} as const

@classInjection
export default class ReviewService {
    @injected
    private prisma!: PrismaClient

    @injected
    private userService!: UserService

    @injected
    private orderService!: OrderService

    @injected
    private shopService!: ShopService

    @injected
    private itemService!: ItemService

    async reviewDataToReviewInfo(review: { id: string; content: string; rating: number; createdAt: Date; updatedAt: Date; orderId: string; userId: string }) {
        // 通过服务调用获取用户信息
        const user = await this.userService.getUser(review.userId)
        
        return {
            id: review.id,
            order: review.orderId,
            rating: review.rating,
            content: review.content,
            createdAt: review.createdAt,
            user: user ? {
                id: user.id,
                name: user.name,
                avatar: await this.userService.getUserAvatarLinks(user.id),
            } : null
        };
    }

    private async updateItemsRating(orderId: string, shopId: string) {
        // 获取订单项
        const orderItems = await this.orderService.getOrderItemsByOrderId(orderId)

        // 更新每个商品的评分
        for (const orderItem of orderItems) {
            if (orderItem.itemId) {
                // 获取包含该商品的所有订单ID
                const ordersWithThisItem = await this.orderService.getOrderItemsByItemId(orderItem.itemId)
                const orderIds = ordersWithThisItem.map(item => item.orderId)
                
                // 计算该商品的平均评分
                const reviewsOnThisItem = await this.prisma.review.findMany({
                    where: {
                        orderId: { in: orderIds }
                    }
                })
                
                const itemAverageRating = reviewsOnThisItem.length > 0 
                    ? reviewsOnThisItem.reduce((sum, review) => sum + review.rating, 0) / reviewsOnThisItem.length
                    : 0
                
                // 通过ItemService更新商品评分
                await this.itemService.updateItemRating(orderItem.itemId, itemAverageRating)
            }
        }

        // 更新店铺评分
        const shopOrderIds = await this.orderService.getOrderIdsByShopId(shopId)
        
        const reviewsOnThisShop = await this.prisma.review.findMany({
            where: {
                orderId: { in: shopOrderIds }
            }
        })
        
        const shopAverageRating = reviewsOnThisShop.length > 0 
            ? reviewsOnThisShop.reduce((sum, review) => sum + review.rating, 0) / reviewsOnThisShop.length
            : 0
        
        // 通过ShopService更新店铺评分
        await this.shopService.updateShopRating(shopId, shopAverageRating)
    }

    async createReview(userId: string, request: CreateReview) {
        const { order, rating, content } = request;
        
        // 验证用户存在
        const user = await this.userService.getUser(userId)
        if (!user) {
            throw new ResponseError(HTTP_STATUS.NOT_FOUND, REVIEW_ERROR_MESSAGES.USER_NOT_FOUND)
        }
        
        // 获取订单信息（通过OrderService）
        const orderEntity = await this.orderService.getOrderForReview(order, userId)
        if (!orderEntity) {
            throw new ResponseError(404, "Order not found")
        }
        if (orderEntity.status !== 'FINISHED') {
            throw new ResponseError(403, "Order is not finished")
        }
        
        // 验证店铺存在
        if (!orderEntity.shopId) {
            throw new ResponseError(404, "Shop not found")
        }
        
        const shop = await this.shopService.getShop(orderEntity.shopId)
        if (!shop) {
            throw new ResponseError(404, "Shop not found")
        }
        
        return await this.prisma.$transaction(async tx => {
            // 检查是否已有评论
            const existingReview = await tx.review.findUnique({
                where: { orderId: order }
            })
            if (existingReview) {
                throw new ResponseError(409, "Order already has a review")
            }
            
            const review = await tx.review.create({
                data: {
                    userId: userId,
                    orderId: orderEntity.id,
                    rating: rating,
                    content: content,
                }
            })
            
            // 异步更新评分（在事务外执行，避免跨服务依赖）
            setImmediate(() => {
                this.updateItemsRating(orderEntity.id, orderEntity.shopId!)
                    .catch(error => console.error('Failed to update ratings:', error))
            })
            
            return await this.reviewDataToReviewInfo(review)
        })
    }

    async getReviewByOrderId(userId: string, id: string) {
        // 验证用户权限
        const currentUser = await this.userService.getUser(userId)
        if (!currentUser) {
            throw new ResponseError(401, "User not found")
        }
        
        // 获取订单信息（通过OrderService）
        const order = await this.orderService.getOrderForReview(id)
        if (!order) {
            throw new ResponseError(404, "Order not found")
        }
        
        // 检查权限：管理员、客户或店铺所有者
        let hasPermission = currentUser.role === "ADMIN" || order.customerId === userId
        
        if (!hasPermission && order.shopId) {
            const shop = await this.shopService.getShop(order.shopId)
            hasPermission = shop?.ownerId === userId
        }
        
        if (!hasPermission) {
            throw new ResponseError(404, "Order not found")
        }
        
        // 获取评论
        const review = await this.prisma.review.findUnique({
            where: { orderId: id }
        })
        
        if (!review) {
            throw new ResponseError(404, "Review not found")
        }
        
        return await this.reviewDataToReviewInfo(review)
    }

    async getReviewsByShopId(id: string, pageSkip: number, pageLimit: number) {
        // 验证店铺存在
        const shop = await this.shopService.getShop(id)
        if (!shop) {
            throw new ResponseError(404, "Shop not found")
        }
        
        // 获取店铺的所有订单ID（通过OrderService）
        const orderIds = await this.orderService.getOrderIdsByShopId(id)
        
        // 获取这些订单的评论
        const reviews = await this.prisma.review.findMany({
            where: { 
                orderId: { in: orderIds }
            },
            orderBy: { createdAt: 'desc' },
            skip: pageSkip,
            take: pageLimit
        })
        
        // 转换为完整信息
        return await Promise.all(reviews.map(review => 
            this.reviewDataToReviewInfo(review)
        ))
    }

    async updateReview(userId: string, id: string, updateReview: UpdateReview) {
        // 验证用户权限
        const currentUser = await this.userService.getUser(userId)
        if (!currentUser) {
            throw new ResponseError(401, "User not found")
        }
        
        // 获取评论信息
        const review = await this.prisma.review.findUnique({ 
            where: { id: id }
        })
        if (!review) {
            throw new ResponseError(404, "Review not found")
        }
        
        // 检查权限
        if (review.userId !== userId && currentUser.role !== "ADMIN") {
            throw new ResponseError(403, "You are not authorized to update this review or admin")
        }
        
        // 获取订单信息（通过OrderService）
        const order = await this.orderService.getOrderForReview(review.orderId)
        if (!order) {
            throw new ResponseError(404, "Order not found")
        }
        
        return await this.prisma.$transaction(async tx => {
            // 更新评论
            const updatedReview = await tx.review.update({
                where: { id: id },
                data: {
                    rating: updateReview.rating,
                    content: updateReview.content,
                }
            })
            
            // 异步更新评分（在事务外执行）
            if (order.shopId) {
                setImmediate(() => {
                    this.updateItemsRating(order.id, order.shopId!)
                        .catch(error => console.error('Failed to update ratings:', error))
                })
            }
            
            return await this.reviewDataToReviewInfo(updatedReview)
        })
    }

    async deleteReview(userId: string, id: string) {
        // 验证用户权限
        const currentUser = await this.userService.getUser(userId)
        if (!currentUser) {
            throw new ResponseError(401, "User not found")
        }
        
        // 获取评论信息
        const review = await this.prisma.review.findUnique({
            where: { id }
        })
        if (!review) {
            throw new ResponseError(404, "Review not found")
        }
        
        // 检查权限
        if (review.userId !== userId && currentUser.role !== "ADMIN") {
            throw new ResponseError(403, "Permission denied")
        }
        
        // 获取订单信息（通过OrderService）
        const order = await this.orderService.getOrderForReview(review.orderId)
        
        await this.prisma.$transaction(async tx => {
            // 删除评论
            await tx.review.delete({
                where: { id },
            })
        })
        
        // 异步更新评分（在事务外执行）
        if (order?.shopId) {
            setImmediate(() => {
                this.updateItemsRating(order.id, order.shopId!)
                    .catch(error => console.error('Failed to update ratings:', error))
            })
        }
    }
}