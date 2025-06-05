import { Prisma, PrismaClient, OrderStatus } from '@prisma/client'
import { classInjection, injected } from '../util/injection-decorators'
import { ResponseError } from '../util/errors'
import haversine from 'haversine-distance'
import OSSService from './oss.service'

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

    async orderDataToOrderInfo(order: Prisma.OrderGetPayload<{ include: { items: true } }>) {
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
            items: await Promise.all(order.items.map(async item => ({
                id: item.itemId,
                name: item.name,
                cover: await this.getOrderItemCoverLinks(item.id),
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

    orderDataToOmittedOrderInfo(order: Prisma.OrderGetPayload<{ include: { items: true } }>) {
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
            this.ossService.getObjectUrl(`order-items/${id}/cover.webp`),
            this.ossService.getObjectUrl(`order-items/${id}/cover-thumbnail.webp`)])
        return { origin, thumbnail }
    }

    async getOrders(currentUserId: string, pageSkip: number, pageLimit: number, status?: Status) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({
                where: { id: currentUserId },
            })
            if (!currentUser || currentUser.role !== 'ADMIN') {
                throw new ResponseError(403, 'Permission denied')
            }
            return await tx.order.findMany({
                skip: pageSkip,
                take: pageLimit,
                where: { status: toOrderStatus(status) },
                orderBy: { createdAt: 'desc' },
                include: { items: true },
            })
        })
    }

    async getOrdersAsCustomer(currentUserId: string, pageSkip: number, pageLimit: number, status: Status | undefined) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({
                where: { id: currentUserId },
            })
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }
            return await tx.order.findMany({
                where: { customerId: currentUserId, status: toOrderStatus(status) },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' },
                include: { items: true },
            })
        })
    }

    async getOrdersAsShop(currentUserId: string, shopId: string, pageSkip: number, pageLimit: number, status: Status | undefined) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({
                where: { id: currentUserId },
            })
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }
            const shop = await tx.shop.findUnique({ where: { id: shopId } })
            if (!shop || shop.ownerId !== currentUserId) {
                throw new ResponseError(403, 'Permission denied')
            }
            return await tx.order.findMany({
                where: { 
                    shopId,
                    status: toOrderStatus(status)
                },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' },
                include: { items: true },
            })
        })
    }

    async getOrdersAsRider(currentUserId: string, pageSkip: number, pageLimit: number, status: Status | undefined) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({
                where: { id: currentUserId },
            })
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }
            return await tx.order.findMany({
                where: { riderId: currentUserId, status: toOrderStatus(status) },
                skip: pageSkip,
                take: pageLimit,
                orderBy: { createdAt: 'desc' },
                include: { items: true },
            })
        })
    }

    async createOrder(currentUserId: string, shopId: string, addressId: string, note: string) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({
                where: { id: currentUserId },
            })
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }

            const shop = await tx.shop.findUnique({ where: {
                id: shopId,
                verified: true,
            }})
            if (!shop) {
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

            const cartItems = await tx.cartItem.findMany({
                where: {
                    customerId: currentUserId,
                    item: { shopId }
                },
                include: { item: true },
            })
            if (cartItems.length === 0) {
                throw new ResponseError(400, 'Cart is empty')
            }
            if (cartItems.some(item => !item.item.available || item.item.stockout)) {
                throw new ResponseError(403, 'Some items are not available or out of stock')
            }
            const orderItems = cartItems.map(item => ({
                itemId: item.itemId,
                name: item.item.name,
                quantity: item.quantity,
                price: item.item.price * item.quantity,
            }))
            const total = orderItems.reduce((sum, item) => sum + item.price, 0)
            if (total < shop.deliveryThreshold) {
                throw new ResponseError(403, 'Order total is below the minimum value')
            }

            const address = await tx.address.findUnique({
                where: { id: addressId, userId: currentUserId },
            })
            if (!address) {
                throw new ResponseError(404, 'Address not found')
            }
            const distance = 0.001 * haversine(
                { latitude: shop.addressLatitude, longitude: shop.addressLongitude },
                { latitude: address.latitude, longitude: address.longitude }
            )
            if (distance > shop.maximumDistance) {
                throw new ResponseError(403, 'Delivery distance exceeded')
            }

            await tx.cartItem.deleteMany({
                where: { customerId: currentUserId, item: { shopId } },
            })
            
            return await tx.order.create({
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
                    shopName: shop.addressName,
                    shopTel: shop.addressTel,
                    customerLatitude: address.latitude,
                    customerLongitude: address.longitude,
                    customerProvince: address.province,
                    customerCity: address.city,
                    customerDistrict: address.district,
                    customerAddress: address.detail,
                    customerName: address.recipientName,
                    customerTel: address.phoneNumber,
                },
                include: { items: true },
            })
        })
    }

    async getOrder(currentUserId: string, id: string) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({
                where: { id: currentUserId },
            })
            if (!currentUser) {
                throw new ResponseError(401, 'Unauthorized')
            }
            const order = await tx.order.findUnique({
                where: { id },
                include: { items: true, shop: true },
            })
            if (!order) {
                throw new ResponseError(404, 'Order not found')
            }
            let doOmit = false
            if (order.customerId !== currentUserId && order.shop?.ownerId !== currentUserId && order.riderId !== currentUserId && currentUser.role !== 'ADMIN') {
                if (order.status !== 'PREPARED') {
                    throw new ResponseError(403, 'Permission denied')
                } else {
                    doOmit = true
                }
            }
            return { order, doOmit }
        })
    }

    async updateOrderRider(currentUserId: string, id: string) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({
                where: { id: currentUserId },
            })
            if (!currentUser) {
                throw new ResponseError(403, 'Permission denied')
            }
            const order = await tx.order.findUnique({
                where: { id },
                include: { items: true },
            })
            if (!order) {
                throw new ResponseError(404, 'Order not found')
            }
            if (order.status !== 'PREPARED') {
                throw new ResponseError(403, 'Order status is not PREPARED')
            }
            return await tx.order.update({
                where: { id },
                data: {
                    riderId: currentUserId,
                    status: 'DELIVERING',
                    deliveredAt: new Date(),
                },
                include: { items: true },
            })
        })
    }

    async updateOrderStatus(currentUserId: string, id: string, status: Status) {
        return await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({
                where: { id: currentUserId },
            })
            if (!currentUser) {
                throw new ResponseError(403, 'Permission denied')
            }
            const order = await tx.order.findUnique({
                where: { id },
                include: { items: true, shop: { select: { ownerId: true } } },
            })
            if (!order) {
                throw new ResponseError(404, 'Order not found')
            }
            const stateTransition: [boolean, 'canceledAt' | 'paidAt' | 'preparedAt' | 'finishedAt'][] = [
                [currentUser.id === order.customerId && order.status === 'UNPAID' && status === 'canceled', 'canceledAt'],
                [currentUser.id === order.customerId && order.status === 'UNPAID' && status === 'preparing', 'paidAt'],
                [currentUser.id === order.shop?.ownerId && order.status === 'PREPARING' && status === 'prepared', 'preparedAt'],
                [currentUser.id === order.riderId && order.status === 'DELIVERING' && status === 'finished', 'finishedAt'],
            ]
            const permittedStatusProp = stateTransition.find(([permitted]) => permitted)?.[1]
            if (permittedStatusProp) {
                return await tx.order.update({
                    where: { id },
                    data: {
                        status: toOrderStatus(status),
                        [permittedStatusProp]: new Date(),
                    },
                    include: { items: true },
                })
            } else if (currentUser.role === 'ADMIN') {
                return await tx.order.update({
                    where: { id },
                    data: {
                        status: toOrderStatus(status),
                    },
                    include: { items: true },
                })
            } else {
                throw new ResponseError(403, 'Permission denied')
            }
        })
    }

    async deleteOrder(currentUserId: string, id: string) {
        await this.prisma.$transaction(async tx => {
            const currentUser = await tx.user.findUnique({
                where: { id: currentUserId },
            })
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

}