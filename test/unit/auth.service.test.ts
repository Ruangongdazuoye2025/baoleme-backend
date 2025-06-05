import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { mockDeep } from 'jest-mock-extended'
import { PrismaClient } from '@prisma/client'
import * as awilix from 'awilix'
import TokenService from '../../src/service/token.service'
import MailService from '../../src/service/mail.service'
import AuthService from '../../src/service/auth.service'
import { ITXClientDenyList } from '@prisma/client/runtime/library'
import bcrypt from 'bcrypt'

const mockPrisma = mockDeep<PrismaClient>()
const mockTokenService = mockDeep<TokenService>()
const mockMailService = mockDeep<MailService>()
export const container = awilix.createContainer({
    injectionMode: awilix.InjectionMode.PROXY,
    strict: true,
})
container.register({
    prisma: awilix.asValue(mockPrisma),
    tokenService: awilix.asValue(mockTokenService),
    mailService: awilix.asValue(mockMailService),
    authService: awilix.asClass(AuthService),
})

type TransactionClient = Omit<PrismaClient, ITXClientDenyList>

describe('auth service', () => {
    let authService = container.resolve<AuthService>('authService')

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('should register a user', async () => {
        const email = 'a@example.com'
        const password = '123456'
        const id = 'user-id'
        const token = 'verify-token'
        authService.register(email, password)
        expect(mockPrisma.$transaction).toHaveBeenCalled()
        const callback = mockPrisma.$transaction.mock.calls[0][0]
        const mockTx = mockDeep<TransactionClient>()
        mockTx.user.create.mockResolvedValue({ id } as any)
        mockTokenService.generateVerifyToken.mockReturnValue(token)
        await callback(mockTx)
        const arg = mockTx.user.create.mock.calls[0][0]
        expect(arg.data.email).toBe(email)
        expect(await bcrypt.compare(password, arg.data.password)).toBe(true)
        expect(mockTokenService.generateVerifyToken).toHaveBeenCalledWith(id)
        expect(mockMailService.sendVerifyRegisterEmail).toHaveBeenCalledWith(email, token)
    })

    test('should throw error if user already exists', async () => {
        const email = 'a@example.com'
        const password = '123456'
        authService.register(email, password)
        expect(mockPrisma.$transaction).toHaveBeenCalled()
        const callback = mockPrisma.$transaction.mock.calls[0][0]
        const mockTx = mockDeep<TransactionClient>()
        mockTx.user.findUnique.mockResolvedValue({ email } as any)
        await expect(callback(mockTx)).rejects.toHaveProperty('status', 403)
    })

    test('should login a verified user', async () => {
        const email = 'b@example.com'
        const password = '654321'
        const hashedPassword = await bcrypt.hash(password, 10)
        const user = { id: 'user2', email, password: hashedPassword, isVerified: true }
        mockPrisma.user.findUnique.mockResolvedValue(user as any)
        mockTokenService.generateAccessToken.mockReturnValue('jwt-token')
        const result = await authService.login(email, password)
        expect(result.token).toBe('jwt-token')
        expect(result.user).toEqual(user)
        expect(mockTokenService.generateAccessToken).toHaveBeenCalledWith(user.id, user.password)
    })

    test('should not login unverified user', async () => {
        const email = 'b@example.com'
        const password = '654321'
        const hashedPassword = await bcrypt.hash(password, 10)
        const user = { id: 'user2', email, password: hashedPassword, isVerified: false }
        mockPrisma.user.findUnique.mockResolvedValue(user as any)
        await expect(authService.login(email, password)).rejects.toThrow('Cannot login')
    })

    test('should update email and send verification', async () => {
        const id = 'user3'
        const newEmail = 'new@example.com'
        mockTokenService.generateUpdateEmailToken.mockReturnValue('update-token')
        await authService.updateEmail(id, newEmail)
        expect(mockTokenService.generateUpdateEmailToken).toHaveBeenCalledWith(id, newEmail)
        expect(mockMailService.sendVerifyEmailEmail).toHaveBeenCalledWith(newEmail, 'update-token')
    })

    test('should send forgot password email for verified user', async () => {
        const email = 'c@example.com'
        const user = { id: 'user4', email, isVerified: true, password: 'pw' }
        mockPrisma.user.findUnique.mockResolvedValue(user as any)
        mockTokenService.generateResetPasswordToken.mockReturnValue('reset-token')
        await authService.forgotPassword(email)
        expect(mockTokenService.generateResetPasswordToken).toHaveBeenCalledWith(user.id)
        expect(mockMailService.sendResetPasswordEmail).toHaveBeenCalledWith(email, 'reset-token')
    })

    test('should throw error if forgot password user not found or not verified', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null)
        await expect(authService.forgotPassword('notfound@example.com')).rejects.toThrow('User does not exist')
        mockPrisma.user.findUnique.mockResolvedValue({ id: 'id', email: 'e', isVerified: false } as any)
        await expect(authService.forgotPassword('e')).rejects.toThrow('User does not exist')
    })

    test('should update password with correct old password', async () => {
        const id = 'user5'
        const oldPassword = 'oldpw'
        const newPassword = 'newpw'
        const hashedOld = await bcrypt.hash(oldPassword, 10)
        const user = { id, password: hashedOld }
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const mockTx = mockDeep<TransactionClient>()
            mockTx.user.findUnique.mockResolvedValue(user as any)
            mockTx.user.update.mockResolvedValue({ ...user, password: 'hashedNew' } as any)
            return cb(mockTx)
        })
        mockTokenService.generateAccessToken.mockReturnValue('access-token')
        const token = await authService.updatePassword(id, oldPassword, newPassword)
        expect(token).toBe('access-token')
        expect(mockTokenService.generateAccessToken).toHaveBeenCalled()
    })

    test('should throw error if update password user not found', async () => {
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const mockTx = mockDeep<TransactionClient>()
            mockTx.user.findUnique.mockResolvedValue(null)
            return cb(mockTx)
        })
        await expect(authService.updatePassword('id', 'old', 'new')).rejects.toThrow('Permission denied')
    })

    test('should throw error if old password is wrong', async () => {
        const id = 'user6'
        const oldPassword = 'oldpw'
        const newPassword = 'newpw'
        const hashedOld = await bcrypt.hash('different', 10)
        const user = { id, password: hashedOld }
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const mockTx = mockDeep<TransactionClient>()
            mockTx.user.findUnique.mockResolvedValue(user as any)
            return cb(mockTx)
        })
        await expect(authService.updatePassword(id, oldPassword, newPassword)).rejects.toThrow('Old password is wrong')
    })

    test('should verify email with valid token', async () => {
        const token = 'verify-email-token'
        const id = 'user7'
        const email = 'new@email.com'
        mockTokenService.decodeUpdateEmailToken.mockResolvedValue({ sub: id, email })
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const mockTx = mockDeep<TransactionClient>()
            mockTx.user.findUnique.mockResolvedValue({ id } as any)
            mockTx.user.update.mockResolvedValue({ id, email } as any)
            return cb(mockTx)
        })
        const result = await authService.verifyEmail(token)
        expect(result.email).toBe(email)
    })

    test('should throw error if verify email token invalid', async () => {
        mockTokenService.decodeUpdateEmailToken.mockResolvedValue(null)
        await expect(authService.verifyEmail('bad-token')).rejects.toThrow('Invalid token')
    })

    test('should verify register with valid token', async () => {
        const token = 'verify-register-token'
        const id = 'user8'
        mockTokenService.decodeVerifyToken.mockResolvedValue({ sub: id })
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const mockTx = mockDeep<TransactionClient>()
            mockTx.user.findUnique.mockResolvedValue({ id } as any)
            mockTx.user.update.mockResolvedValue({ id, isVerified: true } as any)
            return cb(mockTx)
        })
        const result = await authService.verifyRegister(token)
        expect(result.isVerified).toBe(true)
    })

    test('should throw error if verify register token invalid', async () => {
        mockTokenService.decodeVerifyToken.mockResolvedValue(null)
        await expect(authService.verifyRegister('bad-token')).rejects.toThrow('Invalid token')
    })

    test('should reset password with valid token', async () => {
        const token = 'reset-token'
        const id = 'user9'
        mockTokenService.decodeResetPasswordToken.mockResolvedValue({ sub: id })
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const mockTx = mockDeep<TransactionClient>()
            mockTx.user.findUnique.mockResolvedValue({ id } as any)
            mockTx.user.update.mockResolvedValue({ id } as any)
            return cb(mockTx)
        })
        await expect(authService.resetPassword(token, 'newpw')).resolves.not.toThrow()
    })

    test('should throw error if reset password token invalid', async () => {
        mockTokenService.decodeResetPasswordToken.mockResolvedValue(null)
        await expect(authService.resetPassword('bad-token', 'pw')).rejects.toThrow('Invalid token')
    })

    test('should throw error if reset password user not found', async () => {
        const token = 'reset-token'
        mockTokenService.decodeResetPasswordToken.mockResolvedValue({ sub: 'id' })
        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
            const mockTx = mockDeep<TransactionClient>()
            mockTx.user.findUnique.mockResolvedValue(null)
            return cb(mockTx)
        })
        await expect(authService.resetPassword(token, 'pw')).rejects.toThrow('Permission denied')
    })
})