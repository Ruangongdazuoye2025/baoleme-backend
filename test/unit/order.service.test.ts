import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { mockDeep } from 'jest-mock-extended'
import { PrismaClient, Order } from '@prisma/client'
import * as awilix from 'awilix'
import OrderService from '../../src/service/order.service'
import OSSService from '../../src/service/oss.service'
import { ResponseError } from '../../src/util/errors'

describe('order service', () => {
    const mockPrisma = mockDeep<PrismaClient>()
    const mockOSSService = mockDeep<OSSService>()
    const container = awilix.createContainer({
        injectionMode: awilix.InjectionMode.PROXY,
        strict: true,
    })
    container.register({
        prisma: awilix.asValue(mockPrisma),
        ossService: awilix.asValue(mockOSSService),
        orderService: awilix.asClass(OrderService),
    })
    let orderService = container.resolve<OrderService>('orderService')

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('should throw if order not found in orderDataToOrderInfo', async () => {
        await expect(orderService.orderDataToOrderInfo(null as any)).rejects.toBeDefined()
    })

    test('should convert order data to order info', async () => {
        const order = {
            id: 'o1', status: 'FINISHED', createdAt: new Date(), paidAt: null, preparedAt: null, deliveredAt: null, finishedAt: null, canceledAt: null,
            customerId: 'u1', shopId: 's1', riderId: null, items: [], deliveryFee: 5, total: 100, note: '', deliveryLatitude: 1, deliveryLongitude: 2,
            shopLongitude: 1, shopLatitude: 2, shopProvince: '', shopCity: '', shopDistrict: '', shopAddress: '', shopName: '', shopTel: '',
            customerLongitude: 1, customerLatitude: 2, customerProvince: '', customerCity: '', customerDistrict: '', customerAddress: '', customerName: '', customerTel: ''
        } as any
        const ossService = container.resolve<OSSService>('ossService')
        jest.spyOn(ossService, 'getObjectUrl').mockResolvedValue('url')
        const result = await orderService.orderDataToOrderInfo(order)
        expect(result.id).toBe('o1')
        expect(result.status).toBe('finished')
    })

    test('should throw if orderDataToOrderInfo with undefined', async () => {
        await expect(orderService.orderDataToOrderInfo(undefined as any)).rejects.toBeDefined()
    })

    test('should handle getObjectUrl error gracefully', async () => {
        const order = {
            id: 'o2', status: 'FINISHED', createdAt: new Date(), paidAt: null, preparedAt: null, deliveredAt: null, finishedAt: null, canceledAt: null,
            customerId: 'u1', shopId: 's1', riderId: null, items: [], deliveryFee: 5, total: 100, note: '', deliveryLatitude: 1, deliveryLongitude: 2,
            shopLongitude: 1, shopLatitude: 2, shopProvince: '', shopCity: '', shopDistrict: '', shopAddress: '', shopName: '', shopTel: '',
            customerLongitude: 1, customerLatitude: 2, customerProvince: '', customerCity: '', customerDistrict: '', customerAddress: '', customerName: '', customerTel: ''
        } as any
        const ossService = container.resolve<OSSService>('ossService')
        jest.spyOn(ossService, 'getObjectUrl').mockRejectedValue(new Error('oss error'))
    })

})
