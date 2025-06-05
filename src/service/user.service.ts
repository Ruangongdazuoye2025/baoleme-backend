import { PrismaClient, User, UserRole } from '@prisma/client'
import { ResponseError } from '../util/errors'
import sharp from 'sharp'
import OSSService from './oss.service'
import { classInjection, injected } from '../util/injection-decorators'
import { UpdateUserProfile } from '../schema/user.schema'

@classInjection
export default class UserService {

    @injected
    private prisma!: PrismaClient

    @injected
    private ossService!: OSSService

    async getUser(id: string) {
        return await this.prisma.user.findUnique({ where: { id } })
    }

    async updateUserProfile(currentUserId: string, id: string, name?: string, description?: string, role?: UpdateUserProfile['role'], emailVisible?: boolean, createdAtVisible?: boolean): Promise<User> {
        let roleKey: UserRole | undefined
        if (role === 'customer') {
            roleKey = UserRole.USER
        } else if (role === 'rider') {
            roleKey = UserRole.RIDER
        } else if (role === 'merchant') {
            roleKey = UserRole.MERCHANT
        } else if (role === 'admin') {
            roleKey = UserRole.ADMIN
        } else {
            roleKey = undefined
        }
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({ where: { id } })
            if (!user) {
                throw new ResponseError(404, 'User not found')
            }
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
            if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.id !== id)) {
                throw new ResponseError(403, 'Permission denied')
            }
            if (currentUser.role !== UserRole.ADMIN && role === 'admin') {
                throw new ResponseError(403, 'Permission denied')
            }
            return await tx.user.update({
                where: { id },
                data: { name, description, role: roleKey, emailVisible, createdAtVisible },
            })
        })
    }

    readonly ossContentType = 'image/webp'

    private async checkModifyAvatarPermission(currentUserId: string, id: string) {
        return await this.prisma.$transaction(async tx => {
            const user = await tx.user.findUnique({ where: { id } })
            if (!user) {
                throw new ResponseError(404, 'User not found')
            }
            const currentUser = await tx.user.findUnique({ where: { id: currentUserId } })
            if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.id !== id)) {
                throw new ResponseError(403, 'Permission denied')
            }
        })
    }

    async getUserAvatarLinks(id: string): Promise<{ origin: string, thumbnail: string }> {
        const [origin, thumbnail] = await Promise.all([
            this.ossService.getObjectUrl(`users/${id}/avatar.webp`),
            this.ossService.getObjectUrl(`users/${id}/avatar-thumbnail.webp`)])
        return { origin, thumbnail }
    }

    async uploadUserAvatar(currentUserId: string, id: string, buffer: Buffer): Promise<{ origin: string, thumbnail: string }> {
        await this.checkModifyAvatarPermission(currentUserId, id)
        const [origin, thumbnail] = await Promise.all([
            this.ossService.putObject(`users/${id}/avatar.webp`, sharp(buffer).toFormat('webp'), this.ossContentType),
            this.ossService.putObject(`users/${id}/avatar-thumbnail.webp`, sharp(buffer).resize(128, 128).toFormat('webp'), this.ossContentType)
        ])
        return { origin, thumbnail }
    }

    async deleteUserAvatar(currentUserId: string, id: string) {
        await this.checkModifyAvatarPermission(currentUserId, id)
        await Promise.all([
            this.ossService.removeObject(`users/${id}/avatar.webp`),
            this.ossService.removeObject(`users/${id}/avatar-thumbnail.webp`)
        ])
    }

    getUserRole(user: User): UpdateUserProfile['role'] & string {
        if (user.role === UserRole.USER) {
            return 'customer'
        } else if (user.role === UserRole.RIDER) {
            return 'rider'
        } else if (user.role === UserRole.MERCHANT) {
            return 'merchant'
        } else if (user.role === UserRole.ADMIN) {
            return 'admin'
        }
        throw new Error('Unreachable')
    }

    isEmailVisibleTo(currentUser: User, user: User) {
        return currentUser.role === UserRole.ADMIN || currentUser.id === user.id || user.emailVisible
    }

    isCreatedAtVisibleTo(currentUser: User, user: User) {
        return currentUser.role === UserRole.ADMIN || currentUser.id === user.id || user.createdAtVisible
    }
   
}
