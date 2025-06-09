import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { mockDeep } from 'jest-mock-extended'
import { PrismaClient, Item, ItemCategory, Shop, User } from '@prisma/client'
import * as awilix from 'awilix'
import ItemService from '../../src/service/item.service'
import OSSService from '../../src/service/oss.service'
import { ResponseError } from '../../src/util/errors'

describe('item service', () => {
    const mockPrisma = mockDeep<PrismaClient>()
    const mockOSSService = mockDeep<OSSService>()
    const container = awilix.createContainer({
        injectionMode: awilix.InjectionMode.PROXY,
        strict: true,
    })
    container.register({
        prisma: awilix.asValue(mockPrisma),
        ossService: awilix.asValue(mockOSSService),
        itemService: awilix.asClass(ItemService),
    })
    let itemService = container.resolve<ItemService>('itemService')

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('should throw if shop not found in getItemCategories', async () => {
        mockPrisma.shop.findUnique.mockResolvedValue(null)
        await expect(itemService.getItemCategories('notfound')).rejects.toThrow('Shop not found')
    })

    test('should add item category', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN' } as any)
            tx.shop.findUnique.mockResolvedValue({ id: 's1', ownerId: 'u1' } as any)
            tx.itemCategory.aggregate.mockResolvedValue({ _max: { order: 0 }, _count: {}, _avg: {}, _sum: {}, _min: {} })
            tx.itemCategory.create.mockResolvedValue({ id: 'c1', name: 'cat', shopId: 's1', order: 1 } as any)
            return cb(tx)
        })
        const result = await itemService.addItemCategory('u1', 's1', 'cat')
        expect(result.id).toBe('c1')
    })

    test('should throw if shop not found in addItemCategory', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN' } as any)
            tx.shop.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(itemService.addItemCategory('u1', 'notfound', 'cat')).rejects.toThrow('Shop not found')
    })

    test('should update item profile', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.item.findUnique.mockResolvedValue({ id: 'i1', shop: { ownerId: 'u1' }, shopId: 's1' } as any)
            tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN' } as any)
            tx.item.update.mockResolvedValue({ id: 'i1', name: 'new' } as any)
            return cb(tx)
        })
        const result = await itemService.updateItemProfile('u1', 'i1', { name: 'new' } as any)
        expect(result.id).toBe('i1')
    })

    test('should throw if updateItemProfile with non-existent category', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.item.findUnique.mockResolvedValue({ id: 'i1', shop: { ownerId: 'u1' }, shopId: 's1' } as any)
            tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN' } as any)
            tx.itemCategory.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(itemService.updateItemProfile('u1', 'i1', { name: 'new', categories: ['notfound'] } as any)).rejects.toThrow('Item category not found')
    })

    test('should delete item', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.item.findUnique.mockResolvedValue({ id: 'i1', shop: { ownerId: 'u1' }, shopId: 's1' } as any)
            tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN' } as any)
            tx.item.delete.mockResolvedValue({ id: 'i1' } as any)
            return cb(tx)
        })
        // ossService.removeObject 直接 mock 掉
        jest.spyOn(mockOSSService, 'removeObject').mockResolvedValue(undefined)
        await expect(itemService.deleteItem('u1', 'i1')).resolves.not.toThrow()
    })

    test('should update item category', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN' } as any)
            tx.shop.findUnique.mockResolvedValue({ id: 's1', ownerId: 'u1' } as any)
            tx.itemCategory.findUnique.mockResolvedValue({ id: 'c1', shopId: 's1' } as any)
            tx.itemCategory.update.mockResolvedValue({ id: 'c1', name: 'new' } as any)
            return cb(tx)
        })
        const result = await itemService.updateItemCategory('u1', 's1', 'c1', 'new')
        expect(result.id).toBe('c1')
    })

    test('should delete item category', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN' } as any)
            tx.shop.findUnique.mockResolvedValue({ id: 's1', ownerId: 'u1' } as any)
            tx.itemCategory.findUnique.mockResolvedValue({ id: 'c1', shopId: 's1' } as any)
            tx.itemCategory.delete.mockResolvedValue({ id: 'c1' } as any)
            return cb(tx)
        })
        await expect(itemService.deleteItemCategory('u1', 's1', 'c1')).resolves.not.toThrow()
    })

    test('should update item category pos', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN' } as any)
            tx.shop.findUnique.mockResolvedValue({ id: 's1', ownerId: 'u1' } as any)
            tx.itemCategory.findUnique.mockResolvedValue({ id: 'c1', shopId: 's1', order: 0 } as any)
            tx.itemCategory.aggregate.mockResolvedValue({ _max: { order: 1 }, _count: {}, _avg: {}, _sum: {}, _min: {} })
            tx.itemCategory.update.mockResolvedValue({ id: 'c1', order: 1 } as any)
            tx.itemCategory.findMany.mockResolvedValue([{ id: 'c1', order: 1 } as any])
            return cb(tx)
        })
        await expect(itemService.updateItemCategoryPos('u1', 's1', 'c1', null)).resolves.not.toThrow()
    })

    test('should update item image', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.item.findUnique.mockResolvedValue({ id: 'i1', shop: { ownerId: 'u1' }, shopId: 's1' } as any)
            tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN' } as any)
            return cb(tx)
        })
        jest.spyOn(mockOSSService, 'putObject').mockResolvedValue('url')
        await expect(itemService.updateItemImage('u1', 'i1', Buffer.from('img'))).resolves.not.toThrow()
    })

    test('should throw if getItem with unauthorized user', async () => {
        mockPrisma.item.findUnique.mockResolvedValue({ id: 'i1', shop: { ownerId: 'u2' } } as any)
        mockPrisma.user.findUnique.mockResolvedValue(null)
        await expect(itemService.getItem('u1', 'i1')).rejects.toThrow('Unauthorized')
    })

    test('should throw if getItem with unavailable item', async () => {
        mockPrisma.item.findUnique.mockResolvedValue({ id: 'i1', shop: { ownerId: 'u2' }, available: false } as any)
        mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'USER' } as any)
        await expect(itemService.getItem('u1', 'i1')).rejects.toThrow('Item not found')
    })

    test('should not throw if getItem with admin and unavailable item', async () => {
        mockPrisma.item.findUnique.mockResolvedValue({ id: 'i1', shop: { ownerId: 'u2' }, available: false } as any)
        mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin', role: 'ADMIN' } as any)
        await expect(itemService.getItem('admin', 'i1')).resolves.toBeDefined()
    })

    test('should not throw if updateItemImage with undefined cover', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.item.findUnique.mockResolvedValue({ id: 'i1', shop: { ownerId: 'u1' }, shopId: 's1' } as any)
            tx.user.findUnique.mockResolvedValue({ id: 'u1', role: 'ADMIN' } as any)
            return cb(tx)
        })
        await expect(itemService.updateItemImage('u1', 'i1', undefined)).resolves.not.toThrow()
    })

})
