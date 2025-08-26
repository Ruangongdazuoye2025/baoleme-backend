import { PrismaClient, UserRole } from '@prisma/client'
import { ResponseError } from '../util/errors'

/**
 * Base service utilities providing common database operations and utility methods
 */
export class BaseServiceUtils {
    
    /**
     * Check if current user has permission to access/modify a resource
     */
    static async checkUserPermission(
        prisma: PrismaClient,
        currentUserId: string, 
        targetUserId: string, 
        allowedRoles: UserRole[] = [UserRole.ADMIN],
        allowSelf = true
    ): Promise<void> {
        const currentUser = await prisma.user.findUnique({ 
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

    /**
     * Find entity by ID or throw 404 error
     */
    static async findByIdOrThrow<T>(
        findOperation: () => Promise<T | null>,
        errorMessage = 'Resource not found'
    ): Promise<T> {
        const entity = await findOperation()
        if (!entity) {
            throw new ResponseError(404, errorMessage)
        }
        return entity
    }

    /**
     * Check if user exists and is verified
     */
    static async validateUserExists(prisma: PrismaClient, userId: string): Promise<void> {
        const user = await prisma.user.findUnique({ 
            where: { id: userId } 
        })
        
        if (!user) {
            throw new ResponseError(404, 'User not found')
        }
        
        if (!user.isVerified) {
            throw new ResponseError(403, 'User not verified')
        }
    }
}
