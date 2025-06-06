import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { mockDeep } from 'jest-mock-extended'
import { PrismaClient, User } from '@prisma/client'
import * as awilix from 'awilix'
import HistoryService from '../../src/service/history.service'
import ShopService from '../../src/service/shop.service'
import ItemService from '../../src/service/item.service'
import { ResponseError } from '../../src/util/errors'

describe('history service', () => {
    const mockPrisma = mockDeep<PrismaClient>()
    const mockShopService = mockDeep<ShopService>()
    const mockItemService = mockDeep<ItemService>()
    const container = awilix.createContainer({
        injectionMode: awilix.InjectionMode.PROXY,
        strict: true,
    })
    container.register({
        prisma: awilix.asValue(mockPrisma),
        shopService: awilix.asValue(mockShopService),
        itemService: awilix.asValue(mockItemService),
        historyService: awilix.asClass(HistoryService),
    })
    let historyService = container.resolve<HistoryService>('historyService')

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('should throw if user not found in getShopHistory', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(historyService.getShopHistory('u1', 0, 10)).rejects.toThrow(ResponseError)
    })

    test('should get shop history', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.shopHistory.findMany.mockResolvedValue([{ shop: { id: 's1' }, createdAt: new Date() } as any])
            return cb(tx)
        })
        const result = await historyService.getShopHistory('u1', 0, 10)
        expect(result[0].shop).toBeDefined()
    })

    test('should get item history', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.itemHistory.findMany.mockResolvedValue([{ item: { id: 'i1' }, createdAt: new Date() } as any])
            return cb(tx)
        })
        const result = await historyService.getItemHistory('u1', 0, 10)
        expect(result[0].item).toBeDefined()
    })

    test('should get shop favourite', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.shopFavourite.findMany.mockResolvedValue([{ shop: { id: 's1' }, createdAt: new Date() } as any])
            return cb(tx)
        })
        const result = await historyService.getShopFavourite('u1', 0, 10)
        expect(result[0].shop).toBeDefined()
    })

    test('should get item favourite', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1' } as any)
            tx.itemFavourite.findMany.mockResolvedValue([{ item: { id: 'i1' }, createdAt: new Date() } as any])
            return cb(tx)
        })
        const result = await historyService.getItemFavourite('u1', 0, 10)
        expect(result[0].item).toBeDefined()
    })

})
