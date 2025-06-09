import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { mockDeep } from 'jest-mock-extended'
import { PrismaClient, Address } from '@prisma/client'
import * as awilix from 'awilix'
import AddressService from '../../src/service/address.service'
import { ResponseError } from '../../src/util/errors'

describe('address service', () => {
    const mockPrisma = mockDeep<PrismaClient>()
    const container = awilix.createContainer({
        injectionMode: awilix.InjectionMode.PROXY,
        strict: true,
    })
    container.register({
        prisma: awilix.asValue(mockPrisma),
        addressService: awilix.asClass(AddressService),
    })
    let addressService = container.resolve<AddressService>('addressService')

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('should add address', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.address.findMany.mockResolvedValue([])
            tx.address.create.mockResolvedValue({
                id: 'a1', userId: 'u1', longitude: 1, latitude: 2, province: '', city: '', district: '', detail: '', recipientName: '', phoneNumber: '', isDefault: true, displayOrder: 0
            } as any)
            return cb(tx)
        })
        const result = await addressService.addAddress('u1', { coordinate: [1,2], name: '', tel: '', province: '', city: '', district: '', address: '', isDefault: true })
        expect(result.id).toBe('a1')
    })

    test('should throw if address count exceeds limit', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.address.findMany.mockResolvedValue(new Array(16).fill({}))
            return cb(tx)
        })
        await expect(addressService.addAddress('u1', { coordinate: [1,2], name: '', tel: '', province: '', city: '', district: '', address: '', isDefault: false })).rejects.toThrow()
    })

    test('should get addresses', async () => {
        mockPrisma.address.findMany.mockResolvedValue([{ id: 'a1', userId: 'u1', longitude: 1, latitude: 2, province: '', city: '', district: '', detail: '', recipientName: '', phoneNumber: '', isDefault: true, displayOrder: 0 } as Address])
        const result = await addressService.getAddresses('u1')
        expect(result[0].id).toBe('a1')
    })

    test('should throw if getAddressById not found', async () => {
        mockPrisma.address.findUnique.mockResolvedValue(null)
        await expect(addressService.getAddressById('u1', 'notfound')).rejects.toThrow()
    })

    test('should throw if getAddressById not owner', async () => {
        mockPrisma.address.findUnique.mockResolvedValue({ id: 'a1', userId: 'u2' } as Address)
        await expect(addressService.getAddressById('u1', 'a1')).rejects.toThrow()
    })

    test('should update address', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.address.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1', isDefault: false } as any)
            tx.address.update.mockResolvedValue({ id: 'a1', userId: 'u1', isDefault: true } as any)
            return cb(tx)
        })
        const result = await addressService.updateAddress('u1', 'a1', { name: '', tel: '', province: '', city: '', district: '', address: '', coordinate: [1,2], isDefault: true })
        expect(result.id).toBe('a1')
    })

    test('should throw if update address not found', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.address.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(addressService.updateAddress('u1', 'notfound', { name: '', tel: '', province: '', city: '', district: '', address: '', coordinate: [1,2], isDefault: true })).rejects.toThrow()
    })

    test('should delete address', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.address.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1', isDefault: false } as any)
            tx.address.delete.mockResolvedValue({ id: 'a1' } as any)
            tx.address.findMany.mockResolvedValue([])
            return cb(tx)
        })
        await expect(addressService.deleteAddress('u1', 'a1')).resolves.not.toThrow()
    })

    test('should set default address', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.address.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1', isDefault: false } as any)
            tx.address.updateMany.mockResolvedValue({ count: 1 })
            tx.address.update.mockResolvedValue({ id: 'a1', userId: 'u1', isDefault: true } as any)
            return cb(tx)
        })
        const result = await addressService.setDefaultAddress('u1', 'a1')
        expect(result.id).toBe('a1')
    })

    test('should update address order', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.address.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1', displayOrder: 0 } as any)
            tx.address.findFirst.mockResolvedValue({ id: 'a2', userId: 'u1', displayOrder: 1 } as any)
            tx.address.update.mockResolvedValue({ id: 'a1', userId: 'u1', displayOrder: 1 } as any)
            tx.address.updateMany.mockResolvedValue({ count: 1 })
            tx.address.aggregate.mockResolvedValue({ _max: { displayOrder: 1 }, _count: {}, _avg: {}, _sum: {}, _min: {} })
            tx.address.findMany.mockResolvedValue([{ id: 'a1', userId: 'u1', displayOrder: 1 } as any])
            return cb(tx)
        })
        const result = await addressService.updateAddressOrder('u1', 'a1', { before: 'a2' })
        expect(result[0].id).toBe('a1')
    })

    test('should delete address and reorder', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.address.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1', isDefault: false } as any)
            tx.address.delete.mockResolvedValue({ id: 'a1' } as any)
            tx.address.findMany.mockResolvedValue([{ id: 'a2', userId: 'u1', displayOrder: 0 } as any])
            tx.address.findFirst.mockResolvedValue({ id: 'a2', userId: 'u1', displayOrder: 0 } as any)
            tx.address.update.mockResolvedValue({ id: 'a2', userId: 'u1', isDefault: true } as any)
            return cb(tx)
        })
        await expect(addressService.deleteAddress('u1', 'a1')).resolves.not.toThrow()
    })

    test('should update address order to end', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.address.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1', displayOrder: 0 } as any)
            tx.address.aggregate.mockResolvedValue({ _max: { displayOrder: 1 }, _count: {}, _avg: {}, _sum: {}, _min: {} })
            tx.address.update.mockResolvedValue({ id: 'a1', userId: 'u1', displayOrder: 1 } as any)
            tx.address.findMany.mockResolvedValue([{ id: 'a1', userId: 'u1', displayOrder: 1 } as any])
            return cb(tx)
        })
        const result = await addressService.updateAddressOrder('u1', 'a1', { before: null })
        expect(result[0].id).toBe('a1')
    })

    test('should throw if updateAddressOrder with not found address', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.address.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(addressService.updateAddressOrder('u1', 'notfound', { before: null })).rejects.toThrow()
    })

    test('should throw if deleteAddress with not found address', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.address.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(addressService.deleteAddress('u1', 'notfound')).rejects.toThrow()
    })

    test('should throw if setDefaultAddress with not found address', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.address.findUnique.mockResolvedValue(null)
            return cb(tx)
        })
        await expect(addressService.setDefaultAddress('u1', 'notfound')).rejects.toThrow()
    })

})
