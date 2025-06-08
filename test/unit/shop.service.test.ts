import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { mockDeep } from 'jest-mock-extended'
import { PrismaClient, Shop, User } from '@prisma/client'
import * as awilix from 'awilix'
import ShopService from '../../src/service/shop.service'
import OSSService from '../../src/service/oss.service'
import { ResponseError } from '../../src/util/errors'

describe('shop service', () => {
    const mockPrisma = mockDeep<PrismaClient>()
    const mockOSSService = mockDeep<OSSService>()
    const container = awilix.createContainer({
        injectionMode: awilix.InjectionMode.PROXY,
        strict: true,
    })
    container.register({
        prisma: awilix.asValue(mockPrisma),
        ossService: awilix.asValue(mockOSSService),
        shopService: awilix.asClass(ShopService),
    })
    let shopService = container.resolve<ShopService>('shopService')

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('should get shops by owner id', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.shop.findMany.mockResolvedValue([{ id: 's1', ownerId: 'u1' } as any])
            return cb(tx)
        })
        const result = await shopService.getShopsByOwnerId('u1')
        expect(result[0].id).toBe('s1')
    })

    test('should throw if owner not found', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(shopService.getShopsByOwnerId('notfound')).rejects.toThrow(ResponseError)
    })

    test('should get shop image links', async () => {
        const ossService = container.resolve<OSSService>('ossService')
        jest.spyOn(ossService, 'getObjectUrl').mockResolvedValue('url')
        const result = await shopService.getShopImageLinks('sid')
        expect(result.cover.origin).toBe('url')
        expect(result.detailImage.origin).toBe('url')
        expect(result.license.origin).toBe('url')
    })

    test('should throw 403 if not admin for filtered global shops', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u', role: 'USER' } as any)
            return cb(tx)
        })
        await expect(shopService.getFilteredGlobalShops('u', 0, 10, ['a'])).rejects.toThrow(ResponseError)
    })

})
