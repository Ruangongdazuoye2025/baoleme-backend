import bcrypt from 'bcrypt'
import { PrismaClient, User } from '@prisma/client'
import { ResponseError } from '../util/errors'
import { classInjection, injected } from '../util/injection-decorators'
import TokenService from './token.service'
import MailService from './mail.service'
import { AUTH_CONSTANTS, DEFAULTS, HTTP_STATUS } from '../constants/app.constants'
import * as uuid from 'uuid'

@classInjection
export default class AuthService {

    @injected
    private prisma!: PrismaClient

    @injected
    private tokenService!: TokenService

    @injected
    private mailService!: MailService

    /**
     * Check if current user has permission to access/modify a resource
     */
    private async checkUserPermission(
        currentUserId: string, 
        targetUserId: string, 
        allowedRoles: any[] = ['ADMIN'],
        allowSelf = true
    ): Promise<void> {
        const currentUser = await this.prisma.user.findUnique({ 
            where: { id: currentUserId } 
        })
        
        if (!currentUser) {
            throw new ResponseError(401, 'Unauthorized')
        }

        const hasRolePermission = allowedRoles.includes(currentUser.role)
        const isSelf = allowSelf && currentUser.id === targetUserId
        
        if (!hasRolePermission && !isSelf) {
            throw new ResponseError(403, 'Permission denied')
        }
    }

    private async getUserById(id: string, encryptedPassword?: string): Promise<User | null> {
        const user = await this.prisma.user.findUnique({ where: { id } })
        if (user && encryptedPassword && encryptedPassword !== user?.password) {
            return null
        }
        return user
    }

    private async getUserByEmail(email: string, password?: string): Promise<User | null> {
        const user = await this.prisma.user.findUnique({ where: { email } })
        if (user && password && !await bcrypt.compare(password, user?.password)) {
            return null
        }
        return user
    }

    async register(email: string, password: string) {
        return await this.prisma.$transaction(async tx => {
            const existingUser = await tx.user.findUnique({ where: { email } })
            if (existingUser) {
                throw new ResponseError(403, 'Email already exists')
            }
            
            const hashedPassword = await bcrypt.hash(password, AUTH_CONSTANTS.SALT_ROUNDS)
            const user = await tx.user.create({
                data: { email, password: hashedPassword }
            })
            
            const userName = DEFAULTS.USER_NAME_PREFIX + btoa(String.fromCharCode(...uuid.parse(user.id))).slice(0, DEFAULTS.USER_NAME_ID_LENGTH)
            await tx.user.update({
                where: { id: user.id },
                data: { name: userName }
            })
            
            const token = this.tokenService.generateVerifyToken(user.id)
            await this.mailService.sendVerifyRegisterEmail(email, token)
        })
    }

    async login(email: string, password: string) {
        const user = await this.getUserByEmail(email, password)
        if (!user || !user.isVerified) {
            throw new ResponseError(403, 'Cannot login')
        }
        const token = this.tokenService.generateAccessToken(user.id, user.password)
        return { token, user }
    }

    async updateEmail(id: string, newEmail: string) {
        const token = this.tokenService.generateUpdateEmailToken(id, newEmail)
        await this.mailService.sendVerifyEmailEmail(newEmail, token)
    }

    async forgotPassword(email: string) {
        const user = await this.getUserByEmail(email)
        if (!user || !user.isVerified) {
            throw new ResponseError(403, 'User does not exist')
        }
        const token = this.tokenService.generateResetPasswordToken(user.id)
        await this.mailService.sendResetPasswordEmail(user.email, token)
    }

    async updatePassword(id: string, oldPassword: string, newPassword: string) {
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({ where: { id } })
            if (!user) {
                throw new ResponseError(403, 'Permission denied')
            }
            
            const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password)
            if (!isOldPasswordValid) {
                throw new ResponseError(403, 'Old password is wrong')
            }
            
            const hashedPassword = await bcrypt.hash(newPassword, AUTH_CONSTANTS.SALT_ROUNDS)
            await tx.user.update({
                where: { id },
                data: { password: hashedPassword }
            })
            
            return this.tokenService.generateAccessToken(user.id, hashedPassword)
        })
    }

    async verifyEmail(token: string) {
        const decoded = await this.tokenService.decodeUpdateEmailToken(token)
        if (!decoded) {
            throw new ResponseError(403, 'Invalid token')
        }
        const id = decoded.sub!
        const email = decoded.email
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({ where: { id } })
            if (!user) {
                throw new ResponseError(403, 'Invalid token')
            }
            return await tx.user.update({
                where: { id },
                data: { email }
            })
        })
    }

    async verifyRegister(token: string) {
        const decoded = await this.tokenService.decodeVerifyToken(token)
        if (!decoded) {
            throw new ResponseError(403, 'Invalid token')
        }
        const id = decoded.sub!
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({ where: { id } })
            if (!user) {
                throw new ResponseError(403, 'Invalid token')
            }
            return await tx.user.update({
                where: { id },
                data: { isVerified: true }
            })
        })
    }

    async resetPassword(token: string, newPassword: string) {
        const decoded = await this.tokenService.decodeResetPasswordToken(token)
        if (!decoded) {
            throw new ResponseError(403, 'Invalid token')
        }
        const id = decoded.sub!
        await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({ where: { id } })
            if (!user) {
                throw new ResponseError(403, 'Permission denied')
            }
            const hashedPassword = await bcrypt.hash(newPassword, AUTH_CONSTANTS.SALT_ROUNDS)
            await tx.user.update({
                where: { id },
                data: { password: hashedPassword }
            })
        })
    }
}
