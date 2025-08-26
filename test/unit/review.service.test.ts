import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { mockDeep } from 'jest-mock-extended'
import { PrismaClient, Review, User, Order, Shop } from '@prisma/client'
import * as awilix from 'awilix'
import ReviewService from '../../src/service/review.service'
import UserService from '../../src/service/user.service'
import { ResponseError } from '../../src/util/errors'

const mockPrisma = mockDeep<PrismaClient>()
const mockUserService = mockDeep<UserService>()

describe('review service', () => {
    const container = awilix.createContainer({
        injectionMode: awilix.InjectionMode.PROXY,
        strict: true,
    })
    
    let reviewService: ReviewService

    beforeEach(() => {
        jest.clearAllMocks()
        container.register({
            prisma: awilix.asValue(mockPrisma),
            userService: awilix.asValue(mockUserService),
            reviewService: awilix.asClass(ReviewService),
        })
        reviewService = container.resolve<ReviewService>('reviewService')
    })

    test('should create a review', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.order.findUnique.mockResolvedValue({ id: 'o1', customerId: 'u1', status: 'FINISHED', shop: { id: 'shop1' }, items: [], review: null } as any)
            tx.review.create.mockResolvedValue({ id: 'r1', userId: 'u1', orderId: 'o1', rating: 5, content: 'good', user: { id: 'u1' } } as any)
            tx.review.aggregate.mockResolvedValue({ _avg: { rating: 5 }, _count: {}, _sum: {}, _min: {}, _max: {} })
            tx.item.update.mockResolvedValue({ id: 'item1', rating: 5, createdAt: new Date(), name: '', shopId: '', description: '', sale: 0, price: 0, available: true, stockout: false, priceWithoutPromotion: 0 })
            tx.shop.update.mockResolvedValue({ id: 'shop1', rating: 5, createdAt: new Date(), updatedAt: new Date(), name: '', ownerId: '', description: '', addressLatitude: 0, addressLongitude: 0, addressProvince: '', addressCity: '', addressDistrict: '', addressAddress: '', addressName: '', addressTel: '', verified: false, opened: false, openTimeStart: 0, openTimeEnd: 0, deliveryThreshold: 0, deliveryPrice: 0, maximumDistance: 0, sale: 0, averagePrice: 0 })
            return cb(tx)
        })
        const result = await reviewService.createReview('u1', { order: 'o1', rating: 5, content: 'good' })
        expect(result.id).toBe('r1')
    })

    test('should throw if user not found', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(reviewService.createReview('u1', { order: 'o1', rating: 5, content: 'good' })).rejects.toThrow(ResponseError)
    })

    test('should throw if order not found', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.order.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(reviewService.createReview('u1', { order: 'o1', rating: 5, content: 'good' })).rejects.toThrow(ResponseError)
    })

    test('should throw if order not finished', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.order.findUnique.mockResolvedValue({ id: 'o1', customerId: 'u1', status: 'PREPARING', shop: {}, review: null } as any)
            return cb(tx)
        })
        await expect(reviewService.createReview('u1', { order: 'o1', rating: 5, content: 'good' })).rejects.toThrow(ResponseError)
    })

    test('should throw if order already has review', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.order.findUnique.mockResolvedValue({ id: 'o1', customerId: 'u1', status: 'FINISHED', shop: {}, review: {} } as any)
            return cb(tx)
        })
        await expect(reviewService.createReview('u1', { order: 'o1', rating: 5, content: 'good' })).rejects.toThrow(ResponseError)
    })

    test('should get review by order id', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            const user = { id: 'u1', role: 'USER' } as any
            const review = { id: 'r1', userId: 'u1', orderId: 'o1', user } as any
            tx.user.findUnique.mockResolvedValue(user)
            tx.order.findUnique.mockResolvedValue({ id: 'o1', customerId: 'u1', shop: { ownerId: 'u2' }, review } as any)
            return cb(tx)
        })
        const user = { id: 'u1', role: 'USER' } as any
        const review = { id: 'r1', userId: 'u1', orderId: 'o1', user } as any
        const result = await reviewService.getReviewByOrderId('u1', 'o1')
        // Since service implementation directly returns tx.order.findUnique(...).review, mock returns review
        expect(result).toEqual(review)
    })

    test('should throw if review not found for order', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            const user = { id: 'u1', role: 'USER' } as any
            tx.user.findUnique.mockResolvedValue(user)
            tx.order.findUnique.mockResolvedValue({ id: 'o1', customerId: 'u1', shop: { ownerId: 'u2' }, review: null } as any)
            return cb(tx)
        })
        await expect(reviewService.getReviewByOrderId('u1', 'o1')).rejects.toThrow(ResponseError)
    })

    test('should update review as owner', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'USER' } as any)
            tx.review.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1', order: { items: [], shop: { id: 'shop1' } } } as any)
            tx.review.update.mockResolvedValue({ id: 'r1', userId: 'u1', rating: 4, content: 'updated' } as any)
            tx.review.aggregate.mockResolvedValue({ _avg: { rating: 5 }, _count: {}, _sum: {}, _min: {}, _max: {} })
            tx.item.update.mockResolvedValue({ id: 'item1', rating: 5, createdAt: new Date(), name: '', shopId: '', description: '', sale: 0, price: 0, available: true, stockout: false, priceWithoutPromotion: 0 })
            tx.shop.update.mockResolvedValue({ id: 'shop1', rating: 5, createdAt: new Date(), updatedAt: new Date(), name: '', ownerId: '', description: '', addressLatitude: 0, addressLongitude: 0, addressProvince: '', addressCity: '', addressDistrict: '', addressAddress: '', addressName: '', addressTel: '', verified: false, opened: false, openTimeStart: 0, openTimeEnd: 0, deliveryThreshold: 0, deliveryPrice: 0, maximumDistance: 0, sale: 0, averagePrice: 0 })
            return cb(tx)
        })
        const result = await reviewService.updateReview('u1', 'r1', { rating: 4, content: 'updated' })
        expect(result.rating).toBe(4)
    })

    test('should throw if not authorized to update review', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u2', role: 'USER' } as any)
            tx.review.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1' } as any)
            return cb(tx)
        })
        await expect(reviewService.updateReview('u2', 'r1', { rating: 4, content: 'updated' })).rejects.toThrow(ResponseError)
    })

    test('should delete review as admin', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'admin', role: 'ADMIN' } as any)
            tx.review.findUnique.mockResolvedValue({ 
                id: 'r1', 
                userId: 'u1',
                order: {
                    items: [],
                    shop: { id: 'shop1' }
                }
            } as any)
            tx.review.delete.mockResolvedValue({ id: 'r1', userId: 'u1' } as any)
            tx.review.aggregate.mockResolvedValue({ _avg: { rating: 5 }, _count: {}, _sum: {}, _min: {}, _max: {} })
            tx.item.update.mockResolvedValue({ id: 'item1', rating: 5, createdAt: new Date(), name: '', shopId: '', description: '', sale: 0, price: 0, available: true, stockout: false, priceWithoutPromotion: 0 })
            tx.shop.update.mockResolvedValue({ id: 'shop1', rating: 5, createdAt: new Date(), updatedAt: new Date(), name: '', ownerId: '', description: '', addressLatitude: 0, addressLongitude: 0, addressProvince: '', addressCity: '', addressDistrict: '', addressAddress: '', addressName: '', addressTel: '', verified: false, opened: false, openTimeStart: 0, openTimeEnd: 0, deliveryThreshold: 0, deliveryPrice: 0, maximumDistance: 0, sale: 0, averagePrice: 0 })
            return cb(tx)
        })
        const result = await reviewService.deleteReview('admin', 'r1')
        expect(result).toBeUndefined()
    })

    test('should throw if review not found for delete', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'admin', role: 'ADMIN' } as any)
            tx.review.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(reviewService.deleteReview('admin', 'r1')).rejects.toThrow(ResponseError)
    })
})