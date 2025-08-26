import { PrismaClient, UserRole } from '@prisma/client'
import { ResponseError } from '../util/errors'
import { ERROR_MESSAGES } from '../constants/error-messages.constants'
import { HTTP_STATUS } from '../constants/app.constants'

/**
 * Common business logic helpers for shop-related operations
 */
export class ShopPermissionHelper {
    
    /**
     * Check if user can manage shop (owner or admin)
     */
    static async checkShopManagePermission(
        prisma: PrismaClient,
        currentUserId: string,
        shopId: string
    ): Promise<{ shop: any, currentUser: any }> {
        const [shop, currentUser] = await Promise.all([
            prisma.shop.findUnique({ where: { id: shopId } }),
            prisma.user.findUnique({ where: { id: currentUserId } })
        ])

        if (!shop) {
            throw new ResponseError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.SHOP_NOT_FOUND)
        }

        if (!currentUser) {
            throw new ResponseError(HTTP_STATUS.UNAUTHORIZED, ERROR_MESSAGES.UNAUTHORIZED)
        }

        const canManage = currentUser.role === UserRole.ADMIN || currentUser.id === shop.ownerId
        if (!canManage) {
            throw new ResponseError(HTTP_STATUS.FORBIDDEN, ERROR_MESSAGES.PERMISSION_DENIED)
        }

        return { shop, currentUser }
    }

    /**
     * Check if user can view shop details (based on availability and ownership)
     */
    static async checkShopViewPermission(
        prisma: PrismaClient,
        currentUserId: string,
        shopId: string
    ): Promise<{ shop: any, currentUser: any, canViewPrivateInfo: boolean }> {
        const [shop, currentUser] = await Promise.all([
            prisma.shop.findUnique({ where: { id: shopId } }),
            prisma.user.findUnique({ where: { id: currentUserId } })
        ])

        if (!shop) {
            throw new ResponseError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.SHOP_NOT_FOUND)
        }

        if (!currentUser) {
            throw new ResponseError(HTTP_STATUS.UNAUTHORIZED, ERROR_MESSAGES.UNAUTHORIZED)
        }

        const canViewPrivateInfo = currentUser.role === UserRole.ADMIN || currentUser.id === shop.ownerId

        return { shop, currentUser, canViewPrivateInfo }
    }
}

/**
 * Common business logic helpers for item-related operations
 */
export class ItemPermissionHelper {
    
    /**
     * Check if user can manage items in a shop
     */
    static async checkItemManagePermission(
        prisma: PrismaClient,
        currentUserId: string,
        shopId: string
    ) {
        return ShopPermissionHelper.checkShopManagePermission(prisma, currentUserId, shopId)
    }

    /**
     * Check if user can view item (based on availability and shop ownership)
     */
    static async checkItemViewPermission(
        prisma: PrismaClient,
        currentUserId: string,
        itemId: string
    ): Promise<{ item: any, currentUser: any, canViewUnavailable: boolean }> {
        const [item, currentUser] = await Promise.all([
            prisma.item.findUnique({ 
                where: { id: itemId },
                include: { shop: true }
            }),
            prisma.user.findUnique({ where: { id: currentUserId } })
        ])

        if (!item) {
            throw new ResponseError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.ITEM_NOT_FOUND)
        }

        if (!currentUser) {
            throw new ResponseError(HTTP_STATUS.UNAUTHORIZED, ERROR_MESSAGES.UNAUTHORIZED)
        }

        const canViewUnavailable = currentUser.role === UserRole.ADMIN || currentUser.id === item.shop.ownerId

        // If item is unavailable and user doesn't have special permission, deny access
        if (!item.available && !canViewUnavailable) {
            throw new ResponseError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.ITEM_NOT_FOUND)
        }

        return { item, currentUser, canViewUnavailable }
    }
}

/**
 * Common business logic helpers for order-related operations  
 */
export class OrderPermissionHelper {
    
    /**
     * Check if user can access order information
     */
    static async checkOrderAccessPermission(
        prisma: PrismaClient,
        currentUserId: string,
        orderId: string
    ): Promise<{ order: any, currentUser: any, accessLevel: 'full' | 'omitted' }> {
        const [order, currentUser] = await Promise.all([
            prisma.order.findUnique({ 
                where: { id: orderId },
                include: { shop: true, customer: true, rider: true }
            }),
            prisma.user.findUnique({ where: { id: currentUserId } })
        ])

        if (!order) {
            throw new ResponseError(HTTP_STATUS.NOT_FOUND, ERROR_MESSAGES.ORDER_NOT_FOUND)
        }

        if (!currentUser) {
            throw new ResponseError(HTTP_STATUS.UNAUTHORIZED, ERROR_MESSAGES.UNAUTHORIZED)
        }

        // Determine access level
        const isAdmin = currentUser.role === UserRole.ADMIN
        const isCustomer = currentUser.id === order.customerId
        const isShopOwner = order.shop && currentUser.id === order.shop.ownerId
        const isRider = order.riderId && currentUser.id === order.riderId

        if (!isAdmin && !isCustomer && !isShopOwner && !isRider) {
            throw new ResponseError(HTTP_STATUS.FORBIDDEN, ERROR_MESSAGES.PERMISSION_DENIED)
        }

        // Omit sensitive info for non-admin users who aren't directly involved
        const accessLevel = (isAdmin || isCustomer || isShopOwner || isRider) ? 'full' : 'omitted'

        return { order, currentUser, accessLevel }
    }
}
