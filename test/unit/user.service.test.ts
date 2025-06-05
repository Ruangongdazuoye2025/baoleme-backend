import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { mockDeep } from 'jest-mock-extended'
import { PrismaClient, UserRole, User } from '@prisma/client'
import * as awilix from 'awilix'
import OSSService from '../../src/service/oss.service'
import UserService from '../../src/service/user.service'

const mockPrisma = mockDeep<PrismaClient>()
const mockOSSService = mockDeep<OSSService>()
const container = awilix.createContainer({
    injectionMode: awilix.InjectionMode.PROXY,
    strict: true,
})
container.register({
    prisma: awilix.asValue(mockPrisma),
    ossService: awilix.asValue(mockOSSService),
    userService: awilix.asClass(UserService),
})

describe('user service', () => {
    let userService = container.resolve<UserService>('userService')

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('should get user by id', async () => {
        const user = { id: 'u1' } as User
        mockPrisma.user.findUnique.mockResolvedValue(user)
        const result = await userService.getUser('u1')
        expect(result).toBe(user)
        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } })
    })

    test('should update user profile as admin', async () => {
        const user = { id: 'u2', role: UserRole.USER } as User
        const admin = { id: 'admin', role: UserRole.ADMIN } as User
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique
                .mockResolvedValueOnce(user) // user to update
                .mockResolvedValueOnce(admin) // current user
            tx.user.update.mockResolvedValue({ ...user, name: 'newname' })
            return cb(tx)
        })
        const result = await userService.updateUserProfile('admin', 'u2', 'newname')
        expect(result.name).toBe('newname')
    })

    test('should throw 404 if user not found in updateUserProfile', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique.mockResolvedValueOnce(null)
            return cb(tx)
        })
        await expect(userService.updateUserProfile('admin', 'notfound')).rejects.toHaveProperty('status', 404)
    })

    test('should throw 403 if not admin and not self in updateUserProfile', async () => {
        const user = { id: 'u3', role: UserRole.USER } as User
        const other = { id: 'other', role: UserRole.USER } as User
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique
                .mockResolvedValueOnce(user)
                .mockResolvedValueOnce(other)
            return cb(tx)
        })
        await expect(userService.updateUserProfile('other', 'u3')).rejects.toHaveProperty('status', 403)
    })

    test('should throw 403 if non-admin tries to set admin role', async () => {
        const user = { id: 'u4', role: UserRole.USER } as User
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const tx = mockDeep<PrismaClient>()
            tx.user.findUnique
                .mockResolvedValueOnce(user)
                .mockResolvedValueOnce(user)
            return cb(tx)
        })
        await expect(userService.updateUserProfile('u4', 'u4', undefined, undefined, 'admin')).rejects.toHaveProperty('status', 403)
    })

    test('should get user avatar links', async () => {
        mockOSSService.getObjectUrl
            .mockResolvedValueOnce('origin-url')
            .mockResolvedValueOnce('thumb-url')
        const result = await userService.getUserAvatarLinks('uid')
        expect(result).toEqual({ origin: 'origin-url', thumbnail: 'thumb-url' })
        expect(mockOSSService.getObjectUrl).toHaveBeenCalledWith('users/uid/avatar.webp')
        expect(mockOSSService.getObjectUrl).toHaveBeenCalledWith('users/uid/avatar-thumbnail.webp')
    })

    test('should upload user avatar', async () => {
        const buffer = Buffer.from('img')
        jest.spyOn(userService as any, 'checkModifyAvatarPermission').mockResolvedValue(undefined)
        mockOSSService.putObject
            .mockResolvedValueOnce('origin-url')
            .mockResolvedValueOnce('thumb-url')
        const result = await userService.uploadUserAvatar('uid', 'uid', buffer)
        expect(result).toEqual({ origin: 'origin-url', thumbnail: 'thumb-url' })
        expect(mockOSSService.putObject).toHaveBeenCalledTimes(2)
    })

    test('should delete user avatar', async () => {
        jest.spyOn(userService as any, 'checkModifyAvatarPermission').mockResolvedValue(undefined)
        mockOSSService.removeObject.mockResolvedValue(undefined)
        await userService.deleteUserAvatar('uid', 'uid')
        expect(mockOSSService.removeObject).toHaveBeenCalledWith('users/uid/avatar.webp')
        expect(mockOSSService.removeObject).toHaveBeenCalledWith('users/uid/avatar-thumbnail.webp')
    })

    test('should get user role string', () => {
        expect(userService.getUserRole({ role: UserRole.USER } as User)).toBe('customer')
        expect(userService.getUserRole({ role: UserRole.RIDER } as User)).toBe('rider')
        expect(userService.getUserRole({ role: UserRole.MERCHANT } as User)).toBe('merchant')
        expect(userService.getUserRole({ role: UserRole.ADMIN } as User)).toBe('admin')
    })

    test('should throw error for unknown user role in getUserRole', () => {
        expect(() => userService.getUserRole({ role: 'UNKNOWN' as any } as User)).toThrow('Unreachable')
    })

    test('should check email visibility', () => {
        const admin = { id: 'a', role: UserRole.ADMIN } as User
        const user = { id: 'u', role: UserRole.USER, emailVisible: false } as User
        expect(userService.isEmailVisibleTo(admin, user)).toBe(true)
        expect(userService.isEmailVisibleTo(user, user)).toBe(true)
        expect(userService.isEmailVisibleTo({ ...user, id: 'other' }, user)).toBe(false)
        expect(userService.isEmailVisibleTo({ ...user, id: 'other' }, { ...user, emailVisible: true })).toBe(true)
    })

    test('should check createdAt visibility', () => {
        const admin = { id: 'a', role: UserRole.ADMIN } as User
        const user = { id: 'u', role: UserRole.USER, createdAtVisible: false } as User
        expect(userService.isCreatedAtVisibleTo(admin, user)).toBe(true)
        expect(userService.isCreatedAtVisibleTo(user, user)).toBe(true)
        expect(userService.isCreatedAtVisibleTo({ ...user, id: 'other' }, user)).toBe(false)
        expect(userService.isCreatedAtVisibleTo({ ...user, id: 'other' }, { ...user, createdAtVisible: true })).toBe(true)
    })

})