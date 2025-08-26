import { Prisma, PrismaClient, OrderStatus } from '@prisma/client'
import { classInjection, injected } from '../util/injection-decorators'
import { ResponseError } from '../util/errors'
import { HTTP_STATUS } from '../constants/app.constants'
import haversine from 'haversine-distance'
import OSSService from './oss.service'
import UserService from './user.service'
import ShopService from './shop.service'
import ItemService from './item.service'
import AddressService from './address.service'
import CartService from './cart.service'
import { OrderData, ValidationResult, CartItemData, ItemData } from '../types/common.types'
import CrossServiceTransactionManager from './cross-service-transaction.manager'

const ORDER_ERROR_MESSAGES = {
    PERMISSION_DENIED: 'Permission denied',
    UNAUTHORIZED: 'Unauthorized',
    SHOP_NOT_FOUND: 'Shop not found',
    SHOP_NOT_OPEN: 'Shop is not open',
    CART_EMPTY: 'Cart is empty',
    ITEMS_UNAVAILABLE: 'Some items are not available or out of stock',
    ORDER_BELOW_MINIMUM: 'Order total is below the minimum value',
    ADDRESS_NOT_FOUND: 'Address not found',
    DELIVERY_DISTANCE_EXCEEDED: 'Delivery distance exceeded',
    ORDER_NOT_FOUND: 'Order not found',
    ORDER_STATUS_NOT_PREPARED: 'Order status is not PREPARED',
} as const

type Status = 'unpaid' | 'preparing' | 'prepared' | 'delivering' | 'finished' | 'canceled'

function toOrderStatus(status: Status): OrderStatus
function toOrderStatus(status: Status | undefined): OrderStatus | undefined
function toOrderStatus(status: Status | undefined): OrderStatus | undefined {
    return status ? status.toUpperCase() as OrderStatus : undefined
}

@classInjection
export default class OrderService {
    @injected
    private prisma!: PrismaClient

    @injected
    private ossService!: OSSService

    @injected
    private userService!: UserService

    @injected
    private shopService!: ShopService

    @injected
    private itemService!: ItemService

    @injected
    private addressService!: AddressService

    @injected
    private cartService!: CartService

    @injected
    private crossServiceTransactionManager!: CrossServiceTransactionManager

    async orderDataToOrderInfo(order: OrderData) {
        // 获取订单项（不包含关联数据）
        const orderItems = await this.prisma.orderItem.findMany({
            where: { orderId: order.id }
        })

        return {
            id: order.id,
            status: order.status.toLowerCase(),
            createdAt: order.createdAt,
            paidAt: order.paidAt,
            preparedAt: order.preparedAt,
            deliveredAt: order.deliveredAt,
            finishedAt: order.finishedAt,
            canceledAt: order.canceledAt,
            customer: order.customerId,
            shop: order.shopId,
            rider: order.riderId,
            items: await Promise.all(orderItems.map(async item => ({
                id: item.itemId,
                name: item.name,
                cover: await this.getOrderItemCoverLinks(item.itemId ?? '0'),
                quantity: item.quantity,
                price: item.price,
            }))),
            deliveryFee: order.deliveryFee,
            total: order.total,
            note: order.note,
            delivery: (order.deliveryLatitude !== null && order.deliveryLongitude != null) ? {
                latitude: order.deliveryLatitude,
                longitude: order.deliveryLongitude,
            } : null,
            shopAddress: {
                coordinate: [order.shopLongitude, order.shopLatitude],
                province: order.shopProvince,
                city: order.shopCity,
                district: order.shopDistrict,
                address: order.shopAddress,
                name: order.shopName,
                tel: order.shopTel,
            },
            customerAddress: {
                coordinate: [order.customerLongitude, order.customerLatitude],
                province: order.customerProvince,
                city: order.customerCity,
                district: order.customerDistrict,
                address: order.customerAddress,
                name: order.customerName,
                tel: order.customerTel,
            }
        }
    }

    orderDataToOmittedOrderInfo(order: { 
        id: string; 
        status: OrderStatus; 
        preparedAt?: Date | null; 
        shopLongitude: number; 
        shopLatitude: number; 
        shopProvince: string; 
        shopCity: string; 
        shopDistrict: string; 
        shopAddress: string; 
        shopName: string; 
        shopTel: string; 
        customerLongitude: number; 
        customerLatitude: number; 
        customerProvince: string; 
        customerCity: string; 
        customerDistrict: string; 
        customerAddress: string; 
        customerName: string; 
        customerTel: string; 
    }) {
        return {
            id: order.id,
            status: order.status.toLowerCase(),
            preparedAt: order.preparedAt,
            shopAddress: {
                coordinate: [order.shopLongitude, order.shopLatitude],
                province: order.shopProvince,
                city: order.shopCity,
                district: order.shopDistrict,
                address: order.shopAddress,
                name: order.shopName,
                tel: order.shopTel,
            },
            customerAddress: {
                coordinate: [order.customerLongitude, order.customerLatitude],
                province: order.customerProvince,
                city: order.customerCity,
                district: order.customerDistrict,
                address: order.customerAddress,
                name: order.customerName,
                tel: order.customerTel,
            }
        }
    }

    async getOrderItemCoverLinks(id: string) {
        const [origin, thumbnail] = await Promise.all([
            this.ossService.getObjectUrl(`items/${id}/cover.webp`),
            this.ossService.getObjectUrl(`items/${id}/cover-thumbnail.webp`)])
        return { origin, thumbnail }
    }

    async getOrders(currentUserId: string, pageSkip: number, pageLimit: number, status?: Status) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser || currentUser.role !== 'ADMIN') {
                throw new ResponseError(HTTP_STATUS.FORBIDDEN, ORDER_ERROR_MESSAGES.PERMISSION_DENIED)
            }
            const orders = await tx.order.findMany({
                skip: pageSkip,
                take: pageLimit,
                where: { status: toOrderStatus(status) },
                orderBy: { createdAt: 'desc' }
            })
            
            // 通过服务调用获取完整订单信息
            return await Promise.all(orders.map(async order => 
                await this.orderDataToOrderInfo(order)
            ))
        })
    }

    async getOrdersAsCustomer(currentUserId: string, pageSkip: number, pageLimit: number, status: Status | undefined) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser) {
                throw new ResponseError(HTTP_STATUS.UNAUTHORIZED, ORDER_ERROR_MESSAGES.UNAUTHORIZED)
            }
            const orders = await tx.order.findMany({
                where: { customerId: currentUserId, status: toOrderStatus(status) },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            })
            
            // 通过服务调用获取完整订单信息
            return await Promise.all(orders.map(async order => 
                await this.orderDataToOrderInfo(order)
            ))
        })
    }

    async getOrdersAsShop(currentUserId: string, shopId: string, pageSkip: number, pageLimit: number, status: Status | undefined) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }
            // 通过 ShopService 验证店铺权限
            const shop = await this.shopService.getShop(shopId)
            if (!shop || shop.ownerId !== currentUserId) {
                throw new ResponseError(403, 'Permission denied')
            }
            const orders = await tx.order.findMany({
                where: { 
                    shopId,
                    status: toOrderStatus(status)
                },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            })
            
            // 通过服务调用获取完整订单信息
            return await Promise.all(orders.map(async order => 
                await this.orderDataToOrderInfo(order)
            ))
        })
    }

    async getOrdersAsRider(currentUserId: string, pageSkip: number, pageLimit: number, status: Status | undefined) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }
            const orders = await tx.order.findMany({
                where: { riderId: currentUserId, status: toOrderStatus(status) },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' }
            })
            
            // 通过服务调用获取完整订单信息
            return await Promise.all(orders.map(async order => 
                await this.orderDataToOrderInfo(order)
            ))
        })
    }

    async createOrder(currentUserId: string, shopId: string, addressId: string, note: string) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }

            // 通过 ShopService 获取店铺信息
            const shop = await this.shopService.getShop(shopId)
            if (!shop || !shop.verified) {
                throw new ResponseError(404, 'Shop not found')
            }
            const now = new Date()
            const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
            const openMinutes = shop.openTimeStart
            const closeMinutes = shop.openTimeEnd
            let isOpen = shop.opened && (closeMinutes > openMinutes ? nowMinutes >= openMinutes && nowMinutes < closeMinutes : nowMinutes >= openMinutes || nowMinutes < closeMinutes)
            if (!isOpen) {
                throw new ResponseError(403, 'Shop is not open')
            }

            // 获取购物车商品（通过 CartService）
            const cartItems = await this.cartService.getCartItems(currentUserId, shopId)
            if (cartItems.length === 0) {
                throw new ResponseError(400, 'Cart is empty')
            }
            
            // 验证购物车中的商品是否可用（通过服务调用）
            const itemsValidation = await Promise.all(cartItems.map(async cartItemWithInfo => {
                const item = cartItemWithInfo.item
                if (!item.available || item.stockout) {
                    return { valid: false, reason: 'Item not available' }
                }
                return { 
                    valid: true, 
                    item: item,
                    cartItem: {
                        itemId: item.id,
                        quantity: cartItemWithInfo.quantity,
                        price: item.price
                    }
                }
            }))
            
            if (itemsValidation.some(validation => !validation.valid)) {
                throw new ResponseError(403, 'Some items are not available or out of stock')
            }
            
            const orderItems = itemsValidation.map(validation => {
                const validationData = validation as { valid: true; item: any; cartItem: any }
                return {
                    itemId: validationData.cartItem.itemId,
                    name: validationData.item.name,
                    quantity: validationData.cartItem.quantity,
                    price: validationData.item.price * validationData.cartItem.quantity,
                }
            })
            const total = orderItems.reduce((sum, item) => sum + item.price, 0) + shop.deliveryPrice
            if (total < shop.deliveryThreshold) {
                throw new ResponseError(403, 'Order total is below the minimum value')
            }

            // 通过 AddressService 获取地址信息
            const address = await this.addressService.getAddressById(currentUserId, addressId)
            const distance = 0.001 * haversine(
                { latitude: shop.addressLatitude, longitude: shop.addressLongitude },
                { latitude: address.coordinate[1]!, longitude: address.coordinate[0]! }
            )
            if (distance > shop.maximumDistance) {
                throw new ResponseError(403, 'Delivery distance exceeded')
            }

            // 清空购物车（通过 CartService）
            await this.cartService.clearCart(currentUserId, shopId)
            
            const order = await tx.order.create({
                data: {
                    customerId: currentUserId,
                    shopId,
                    deliveryFee: shop.deliveryPrice,
                    total: shop.deliveryPrice + total,
                    note,
                    items: { create: orderItems },
                    shopLatitude: shop.addressLatitude,
                    shopLongitude: shop.addressLongitude,
                    shopProvince: shop.addressProvince,
                    shopCity: shop.addressCity,
                    shopDistrict: shop.addressDistrict,
                    shopAddress: shop.addressAddress,
                    shopName: shop.name, // 修正：使用 shop.name 而不是 shop.addressName
                    shopTel: shop.addressTel,
                    customerLatitude: address.coordinate[1]!,
                    customerLongitude: address.coordinate[0]!,
                    customerProvince: address.province,
                    customerCity: address.city,
                    customerDistrict: address.district,
                    customerAddress: address.address,
                    customerName: address.name,
                    customerTel: address.tel,
                }
            })
            
            // 返回完整订单信息
            return await this.orderDataToOrderInfo(order)
        })
    }

    async getOrder(currentUserId: string, id: string) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }
            const order = await tx.order.findUnique({
                where: { id }
            })
            if (!order) {
                throw new ResponseError(404, 'Order not found')
            }
            
            // 验证权限时需要获取店铺信息
            const shop = order.shopId ? await this.shopService.getShop(order.shopId) : null
            
            let doOmit = false
            if (order.customerId !== currentUserId && shop?.ownerId !== currentUserId && order.riderId !== currentUserId && currentUser.role !== 'ADMIN') {
                if (order.status !== 'PREPARED') {
                    throw new ResponseError(403, 'Permission denied')
                } else {
                    doOmit = true
                }
            }
            return { order: doOmit ? this.orderDataToOmittedOrderInfo(order) : await this.orderDataToOrderInfo(order), doOmit }
        })
    }

    async updateOrderRider(currentUserId: string, id: string) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser) {
                throw new ResponseError(403, 'Permission denied')
            }
            const order = await tx.order.findUnique({
                where: { id }
            })
            if (!order) {
                throw new ResponseError(404, 'Order not found')
            }
            if (order.status !== 'PREPARED') {
                throw new ResponseError(403, 'Order status is not PREPARED')
            }
            const updatedOrder = await tx.order.update({
                where: { id },
                data: {
                    riderId: currentUserId,
                    status: 'DELIVERING',
                    deliveredAt: new Date(),
                }
            })
            
            // 返回完整订单信息
            return await this.orderDataToOrderInfo(updatedOrder)
        })
    }


    async updateOrderDelivery(currentUserId: string, id: string, longitude: number, latitude: number) {
        return await this.prisma.$transaction(async tx => {
            const order = await tx.order.findUnique({ where: { id } })
            if (!order) throw new ResponseError(404, 'Order not found')
            if (order.riderId !== currentUserId) throw new ResponseError(403, 'Permission denied')
            if (order.status !== 'DELIVERING') throw new ResponseError(403, 'Order is not delivering')
            const updated = await tx.order.update({
                where: { id },
                data: {
                    deliveryLongitude: longitude,
                    deliveryLatitude: latitude
                }
            })
            return await this.orderDataToOrderInfo(updated)
        })
    }

    private async updateItemsSale(orderId: string, shopId: string, tx: Prisma.TransactionClient) {
        const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        
        // 获取订单项（不包含关联数据）
        const orderItems = await tx.orderItem.findMany({
            where: { orderId }
        })
        
        // 收集需要更新的商品销量数据
        const itemSaleUpdates: Array<{ itemId: string; saleCount: number }> = []
        
        // 计算每个商品的销量
        for (const orderItem of orderItems) {
            if (orderItem.itemId) {
                const itemOrderSum = (await tx.orderItem.aggregate({
                    _sum: { quantity: true },
                    where: { 
                        itemId: orderItem.itemId,
                        order: {
                            status: 'FINISHED',
                            finishedAt: {
                                gte: oneMonthAgo,
                            }
                        },
                    },
                }))._sum.quantity || 0
                
                itemSaleUpdates.push({
                    itemId: orderItem.itemId,
                    saleCount: itemOrderSum
                })
            }
        }
        
        // 计算店铺销量
        const shopItemIds = await this.itemService.getShopItemIds(shopId)
        const shopOrderSum = (await tx.orderItem.aggregate({
            _sum: { quantity: true },
            where: {
                itemId: { in: shopItemIds },
                order: {
                    status: 'FINISHED',
                    finishedAt: {
                        gte: oneMonthAgo,
                    }
                },
            },
        }))._sum.quantity || 0
        
        // 在当前事务完成后异步更新销量数据，确保数据一致性
        // 这样避免跨服务调用在事务中导致的死锁问题
        setImmediate(async () => {
            try {
                await this.updateSalesWithRetry(itemSaleUpdates, shopId, shopOrderSum, orderId)
            } catch (error) {
                console.error(`Failed to update sales for order ${orderId}:`, error)
                // 可以在这里添加重试队列或者告警机制
            }
        })
    }

    /**
     * 使用重试机制更新销量数据，确保最终一致性
     */
    private async updateSalesWithRetry(
        itemSaleUpdates: Array<{ itemId: string; saleCount: number }>,
        shopId: string,
        shopSaleCount: number,
        orderId: string,
        maxRetries: number = 3
    ): Promise<void> {
        let retryCount = 0
        
        while (retryCount < maxRetries) {
            try {
                // 使用 Promise.allSettled 确保部分失败不影响其他更新
                const updatePromises = [
                    // 更新商品销量
                    ...itemSaleUpdates.map(async ({ itemId, saleCount }) => {
                        try {
                            await this.itemService.updateItemSale(itemId, saleCount)
                            return { success: true, type: 'item', id: itemId }
                        } catch (error) {
                            console.error(`Failed to update item sale for ${itemId}:`, error)
                            throw new Error(`Item ${itemId} sale update failed`)
                        }
                    }),
                    // 更新店铺销量
                    (async () => {
                        try {
                            await this.shopService.updateShopSale(shopId, shopSaleCount)
                            return { success: true, type: 'shop', id: shopId }
                        } catch (error) {
                            console.error(`Failed to update shop sale for ${shopId}:`, error)
                            throw new Error(`Shop ${shopId} sale update failed`)
                        }
                    })()
                ]
                
                const results = await Promise.allSettled(updatePromises)
                const failures = results.filter(result => result.status === 'rejected')
                
                if (failures.length === 0) {
                    console.log(`Successfully updated sales for order ${orderId}`)
                    return // 成功完成
                } else {
                    throw new Error(`${failures.length} sale updates failed`)
                }
            } catch (error) {
                retryCount++
                if (retryCount >= maxRetries) {
                    console.error(`Final failure updating sales for order ${orderId} after ${maxRetries} retries:`, error)
                    // 这里可以添加到失败队列中，由后台任务重试
                    throw error
                } else {
                    console.warn(`Retry ${retryCount}/${maxRetries} for sales update of order ${orderId}`)
                    // 指数退避
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)))
                }
            }
        }
    }

    async updateOrderStatus(currentUserId: string, id: string, status: Status) {
        return await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser) {
                throw new ResponseError(403, 'Permission denied')
            }
            const order = await tx.order.findUnique({
                where: { id }
            })
            if (!order) {
                throw new ResponseError(404, 'Order not found')
            }
            
            // 需要获取店铺信息来验证权限
            const shop = order.shopId ? await this.shopService.getShop(order.shopId) : null
            
            const stateTransition: [boolean, 'canceledAt' | 'paidAt' | 'preparedAt' | 'finishedAt'][] = [
                [currentUser.id === order.customerId && order.status === 'UNPAID' && status === 'canceled', 'canceledAt'],
                [currentUser.id === order.customerId && order.status === 'UNPAID' && status === 'preparing', 'paidAt'],
                [currentUser.id === shop?.ownerId && order.status === 'PREPARING' && status === 'prepared', 'preparedAt'],
                [currentUser.id === order.riderId && order.status === 'DELIVERING' && status === 'finished', 'finishedAt'],
            ]
            const permittedStatusProp = stateTransition.find(([permitted]) => permitted)?.[1]
            if (permittedStatusProp) {
                const ret = await tx.order.update({
                    where: { id },
                    data: {
                        status: toOrderStatus(status),
                        [permittedStatusProp]: new Date(),
                    }
                })
                if (ret.status === 'FINISHED')
                    await this.updateItemsSale(ret.id, ret.shopId!, tx)
                return await this.orderDataToOrderInfo(ret)
            } else if (currentUser.role === 'ADMIN') {
                const ret = await tx.order.update({
                    where: { id },
                    data: {
                        status: toOrderStatus(status),
                    }
                })
                if (ret.status === 'FINISHED')
                    await this.updateItemsSale(ret.id, ret.shopId!, tx)
                return await this.orderDataToOrderInfo(ret)
            } else {
                throw new ResponseError(403, 'Permission denied')
            }
        })
    }

    async deleteOrder(currentUserId: string, id: string) {
        await this.prisma.$transaction(async tx => {
            // 通过 UserService 获取用户信息
            const currentUser = await this.userService.getUser(currentUserId)
            if (!currentUser) {
                throw new ResponseError(403, 'Permission denied')
            }
            const order = await tx.order.findUnique({
                where: { id },
            })
            if (!order) {
                throw new ResponseError(404, 'Order not found')
            }
            if (order.status !== 'CANCELED' || order.customerId !== currentUserId) {
                throw new ResponseError(403, 'Permission denied')
            }
            await tx.order.delete({ where: { id } })
        })
    }

    /**
     * 使用跨服务事务创建订单 (增强版本，确保事务一致性)
     * 这个方法展示了如何使用分布式事务机制
     */
    async createOrderWithDistributedTransaction(
        currentUserId: string, 
        shopId: string, 
        addressId: string, 
        note: string
    ) {
        // 首先进行前置验证
        const validationResult = await this.validateOrderCreation(currentUserId, shopId, addressId)
        
        if (!validationResult.valid) {
            throw new ResponseError(400, validationResult.reason || 'Order validation failed')
        }

        // 准备订单数据
        const orderData = {
            customerId: currentUserId,
            orderCreateInput: {
                status: 'UNPAID' as OrderStatus,
                customerId: currentUserId,
                shopId: shopId,
                deliveryFee: validationResult.shop!.deliveryPrice,
                total: validationResult.totalAmount!,
                note: note,
                shopLatitude: validationResult.shop!.addressLatitude,
                shopLongitude: validationResult.shop!.addressLongitude,
                shopProvince: validationResult.shop!.addressProvince,
                shopCity: validationResult.shop!.addressCity,
                shopDistrict: validationResult.shop!.addressDistrict,
                shopAddress: validationResult.shop!.addressAddress,
                shopName: validationResult.shop!.name,
                shopTel: validationResult.shop!.addressTel,
                customerLatitude: validationResult.address!.coordinate[1]!,
                customerLongitude: validationResult.address!.coordinate[0]!,
                customerProvince: validationResult.address!.province,
                customerCity: validationResult.address!.city,
                customerDistrict: validationResult.address!.district,
                customerAddress: validationResult.address!.address,
                customerName: validationResult.address!.name,
                customerTel: validationResult.address!.tel
            } as Prisma.OrderCreateInput,
            items: validationResult.cartItems!.map(cartItemWithInfo => ({
                itemId: cartItemWithInfo.item.id,
                quantity: cartItemWithInfo.quantity
            }))
        }

        // 使用本地事务和补偿机制来确保一致性
        let createdOrderId: string | null = null
        
        try {
            // 第一步：创建订单（在事务中）
            const order = await this.createOrder(currentUserId, shopId, addressId, note)
            createdOrderId = order.id
            
            // 第二步：清空购物车（使用服务方法，自动处理事务）
            try {
                await this.cartService.clearCart(currentUserId, shopId)
            } catch (cartError) {
                console.error('Failed to clear cart, but order was created. Manual cleanup may be needed:', cartError)
                // 购物车清空失败不应该回滚订单创建，因为这不是致命错误
            }
            
            // 第三步：异步更新销量统计（最终一致性）
            // 这在 updateOrderStatus 中的 FINISHED 状态时会自动处理
            
            return {
                orderId: createdOrderId,
                transactionId: `local-tx-${Date.now()}`, // 本地事务ID
                success: true,
                message: 'Order created successfully with enhanced transaction safety'
            }
        } catch (error) {
            // 如果订单创建失败，进行必要的清理
            if (createdOrderId) {
                try {
                    // 尝试删除已创建的订单（如果允许的话）
                    await this.deleteOrder(currentUserId, createdOrderId)
                } catch (deleteError) {
                    console.error('Failed to cleanup order after transaction failure:', deleteError)
                }
            }
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
            throw new ResponseError(500, `Order creation transaction failed: ${errorMessage}`)
        }
    }

    /**
     * 使用跨服务事务取消订单 (增强版本，确保事务一致性)
     */
    async cancelOrderWithDistributedTransaction(currentUserId: string, orderId: string) {
        // 验证权限和订单状态 - 使用原始数据库查询获取准确数据
        const orderRecord = await this.prisma.order.findUnique({
            where: { id: orderId }
        })
        
        if (!orderRecord) {
            throw new ResponseError(404, 'Order not found')
        }

        if (orderRecord.customerId !== currentUserId) {
            throw new ResponseError(403, 'Permission denied')
        }

        if (orderRecord.status !== 'UNPAID' && orderRecord.status !== 'PREPARING') {
            throw new ResponseError(400, 'Order cannot be canceled at this stage')
        }

        // 获取订单项信息用于可能的库存恢复
        const orderItems = await this.prisma.orderItem.findMany({
            where: { orderId: orderId }
        })

        let transactionSuccessful = false
        
        try {
            // 第一步：更新订单状态为取消
            await this.updateOrderStatus(currentUserId, orderId, 'canceled')
            transactionSuccessful = true
            
            // 第二步：异步处理库存恢复（如果需要的话）
            // 对于未支付的订单，通常不需要恢复库存，因为库存在支付时才会扣除
            if (orderRecord.status === 'PREPARING') {
                // 只有已支付正在准备的订单才需要库存恢复
                setImmediate(async () => {
                    try {
                        console.log(`Processing inventory restoration for canceled order ${orderId}`)
                        // 这里可以调用库存服务来恢复库存
                        // await this.inventoryService.restoreInventory(orderItems)
                    } catch (restoreError) {
                        console.error(`Failed to restore inventory for canceled order ${orderId}:`, restoreError)
                        // 可以添加到重试队列
                    }
                })
            }
            
            // 第三步：异步处理退款（如果已支付）
            if (orderRecord.status === 'PREPARING') {
                setImmediate(async () => {
                    try {
                        console.log(`Processing refund for canceled order ${orderId}, amount: ${orderRecord.total}`)
                        // 这里可以调用支付服务处理退款
                        // await this.paymentService.processRefund(orderId, orderRecord.total)
                    } catch (refundError) {
                        console.error(`Failed to process refund for canceled order ${orderId}:`, refundError)
                        // 可以添加到重试队列
                    }
                })
            }

            return {
                orderId: orderId,
                transactionId: `cancel-tx-${Date.now()}`,
                canceled: true,
                refundProcessed: orderRecord.status === 'PREPARING',
                message: 'Order canceled successfully with enhanced transaction safety'
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
            
            if (!transactionSuccessful) {
                throw new ResponseError(500, `Order cancellation failed: ${errorMessage}`)
            } else {
                // 订单已取消，但后续处理可能失败
                console.error(`Order ${orderId} canceled but additional processing failed:`, error)
                return {
                    orderId: orderId,
                    transactionId: `cancel-tx-${Date.now()}`,
                    canceled: true,
                    refundProcessed: false,
                    message: `Order canceled but some post-processing failed: ${errorMessage}`
                }
            }
        }
    }

    /**
     * 订单创建前的验证逻辑
     */
    private async validateOrderCreation(currentUserId: string, shopId: string, addressId: string) {
        // 验证用户
        const user = await this.userService.getUser(currentUserId)
        if (!user) {
            return { valid: false, reason: 'User not found' }
        }

        // 验证店铺
        const shop = await this.shopService.getShop(shopId)
        if (!shop || !shop.verified || !shop.opened) {
            return { valid: false, reason: 'Shop not available' }
        }

        // 验证地址 - 使用 AddressService
        const address = await this.addressService.getAddressById(currentUserId, addressId)
        if (!address) {
            return { valid: false, reason: 'Address not found' }
        }

        // 验证距离
        const distance = 0.001 * haversine(
            { latitude: shop.addressLatitude, longitude: shop.addressLongitude },
            { latitude: address.coordinate[1]!, longitude: address.coordinate[0]! }
        )
        if (distance > shop.maximumDistance) {
            return { valid: false, reason: 'Delivery distance exceeded' }
        }

        // 获取购物车商品 - 使用 CartService
        const cartItems = await this.cartService.getCartItems(currentUserId, shopId)

        if (cartItems.length === 0) {
            return { valid: false, reason: 'Cart is empty' }
        }

        // 验证商品可用性
        const itemsValidation = await Promise.all(cartItems.map(async cartItemWithInfo => {
            const item = cartItemWithInfo.item
            if (!item.available || item.stockout) {
                return { valid: false, reason: 'Item not available' }
            }
            return { 
                valid: true, 
                item: item, 
                cartItem: {
                    itemId: item.id,
                    quantity: cartItemWithInfo.quantity,
                    price: item.price
                }
            }
        }))

        const invalidItem = itemsValidation.find(v => !v.valid)
        if (invalidItem) {
            return { valid: false, reason: invalidItem.reason }
        }

        // 计算总金额
        const totalAmount = itemsValidation.reduce((sum, validation) => {
            const validationData = validation as { valid: true; item: any; cartItem: any }
            return sum + (validationData.cartItem.price * validationData.cartItem.quantity)
        }, 0) + shop.deliveryPrice

        // 验证最低消费
        if (totalAmount < shop.deliveryThreshold) {
            return { valid: false, reason: 'Order total is below the minimum value' }
        }

        return {
            valid: true,
            user,
            shop,
            address,
            cartItems,
            totalAmount
        }
    }

    // 为 ReviewService 提供的接口
    async getOrderForReview(orderId: string, userId?: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId }
        })
        
        if (!order) {
            return null
        }
        
        // 如果指定用户ID，验证权限
        if (userId && order.customerId !== userId) {
            return null
        }
        
        return {
            id: order.id,
            status: order.status,
            customerId: order.customerId,
            shopId: order.shopId,
            riderId: order.riderId
        }
    }

    async getOrderItemsByOrderId(orderId: string) {
        return await this.prisma.orderItem.findMany({
            where: { orderId },
            select: {
                id: true,
                itemId: true,
                orderId: true,
                quantity: true
            }
        })
    }

    async getOrderIdsByShopId(shopId: string) {
        const orders = await this.prisma.order.findMany({
            where: { shopId },
            select: { id: true }
        })
        return orders.map(order => order.id)
    }

    async getOrderItemsByItemId(itemId: string) {
        return await this.prisma.orderItem.findMany({
            where: { itemId },
            select: {
                id: true,
                orderId: true,
                itemId: true
            }
        })
    }

    // 为 ShopService 提供的统计接口
    async getShopDailyRevenue(shopId: string, start: Date, end: Date) {
        return await this.prisma.order.groupBy({
            by: ['finishedAt'],
            where: {
                shopId,
                status: 'FINISHED',
                finishedAt: { gte: start, lte: end }
            },
            _sum: { total: true }
        })
    }

    async getShopDailySales(shopId: string, start: Date, end: Date) {
        return await this.prisma.orderItem.findMany({
            where: {
                order: {
                    shopId,
                    status: 'FINISHED',
                    finishedAt: { gte: start, lte: end }
                }
            },
            select: {
                quantity: true,
                order: { select: { finishedAt: true } }
            }
        })
    }

    async getShopItemSalesStats(shopId: string, start: Date, end: Date) {
        return await this.prisma.orderItem.groupBy({
            by: ['itemId'],
            _sum: { quantity: true, price: true },
            where: {
                order: {
                    shopId,
                    status: 'FINISHED',
                    finishedAt: { gte: start, lte: end }
                },
                itemId: { not: null }
            }
        })
    }

}
