import { Context, ServiceSchema, Errors } from "moleculer";
import { PrismaClient, User, UserRole } from "@prisma/client";
import Joi from "joi";
import { FILE_CONSTANTS, DEFAULTS } from "../common/auth.constants";
import * as uuid from 'uuid'

// --- Joi Schemas and TypeScript Interfaces ---

const userProfileParamsSchema = Joi.object({
    id: Joi.string().uuid().required()
});

interface UserProfileParams {
    id: string;
}

const updateUserProfileSchema = Joi.object({
    id: Joi.string().uuid().required(),
    name: Joi.string().optional(),
    description: Joi.string().allow('').optional(),
    role: Joi.string().valid('customer', 'rider').optional(),
    emailVisible: Joi.boolean().optional(),
    createdAtVisible: Joi.boolean().optional()
});

interface UpdateUserProfileRequest {
    id?: string;
    name?: string;
    description?: string;
    role?: 'customer' | 'rider' | 'merchant' | 'admin';
    emailVisible?: boolean;
    createdAtVisible?: boolean;
}

const uploadAvatarRequestSchema = Joi.object({
    buffer: Joi.binary().required()
});

interface UploadAvatarRequest {
    buffer: Buffer;
}

// --- Service Definition ---

const UserService: ServiceSchema = {
    name: "user",

    settings: {
        
    },

    actions: {
        /**
         * Get user profile information.
         */
        get: {
            params: userProfileParamsSchema as any,
            async handler(ctx: Context<UserProfileParams, { currentUserId: string }>) {
                const { id } = ctx.params;
                const { currentUserId } = ctx.meta;

                const [user, currentUser, avatar] = await Promise.all([
                    (this.prisma as PrismaClient).user.findUnique({ where: { id } }),
                    (this.prisma as PrismaClient).user.findUnique({ where: { id: currentUserId } }),
                    ctx.call("oss.getObjectUrl", { userId: id }) as Promise<{ origin: string, thumbnail: string }>
                ]);

                if (!user) {
                    throw new Errors.MoleculerError("User not found", 404, "USER_NOT_FOUND");
                }

                const isOwner = currentUser?.id === user.id;
                const isAdmin = currentUser?.role === UserRole.ADMIN;
                const canViewEmail = user.emailVisible || isOwner || isAdmin;
                const canViewCreatedAt = user.createdAtVisible || isOwner || isAdmin;

                return {
                    id: user.id,
                    email: canViewEmail ? user.email : undefined,
                    createdAt: canViewCreatedAt ? user.createdAt : undefined,
                    name: user.name || '',
                    description: user.description || '',
                    role: this.getUserRole(user),
                    emailVisible: user.emailVisible,
                    createdAtVisible: user.createdAtVisible,
                    avatar,
                };
            }
        },

        /**
         * Update user profile.
         */
        updateProfile: {
            params: updateUserProfileSchema as any,
            async handler(ctx: Context<UserProfileParams & UpdateUserProfileRequest, { currentUserId: string }>) {
                const { id, ...data } = ctx.params;
                const { currentUserId } = ctx.meta;

                const userToUpdate = await (this.prisma as PrismaClient).user.findUnique({ where: { id } });
                if (!userToUpdate) {
                    throw new Errors.MoleculerError("User not found", 404, "USER_NOT_FOUND");
                }

                if (currentUserId !== id) {
                    throw new Errors.MoleculerError("Forbidden", 403, "FORBIDDEN");
                }
                
                let roleKey: UserRole | undefined;
                if (data.role) {
                    switch (data.role) {
                        case 'customer':
                            roleKey = UserRole.USER;
                            break;
                        case 'rider':
                            roleKey = UserRole.RIDER;
                            break;
                        case 'merchant':
                            roleKey = UserRole.MERCHANT;
                            break;
                        case 'admin':
                            roleKey = UserRole.ADMIN;
                            break;
                        default:
                            roleKey = undefined;
                    }
                }

                if (typeof data.name === 'string' && data.name.length === 0) {
                    data.name = DEFAULTS.USER_NAME_PREFIX + btoa(String.fromCharCode(...uuid.parse(id))).slice(0, DEFAULTS.USER_NAME_ID_LENGTH)
                }

                const updatedUser = await (this.prisma as PrismaClient).user.update({
                    where: { id },
                    data: {
                        name: data.name,
                        description: data.description,
                        role: roleKey,
                        emailVisible: data.emailVisible,
                        createdAtVisible: data.createdAtVisible
                    }
                });

                return {
                    name: updatedUser.name || '',
                    description: updatedUser.description || '',
                    role: this.getUserRole(updatedUser),
                    emailVisible: updatedUser.emailVisible,
                    createdAtVisible: updatedUser.createdAtVisible,
                };
            }
        },

        /**
         * Upload a new avatar for the user.
         */
        uploadAvatar: {
            params: {
                id: userProfileParamsSchema.extract('id'),
                ...uploadAvatarRequestSchema.describe().keys
            } as any,
            async handler(ctx: Context<UserProfileParams & UploadAvatarRequest, { currentUserId: string }>) {
                const { id, buffer } = ctx.params;
                const { currentUserId } = ctx.meta;

                if (currentUserId !== id) {
                    throw new Errors.MoleculerError("Forbidden", 403, "FORBIDDEN");
                }

                return await ctx.call("oss.uploadAvatar", { userId: id, buffer });
            }
        },

        /**
         * Delete user's avatar.
         */
        deleteAvatar: {
            params: userProfileParamsSchema as any,
            async handler(ctx: Context<UserProfileParams, { currentUserId: string }>) {
                const { id } = ctx.params;
                const { currentUserId } = ctx.meta;

                if (currentUserId !== id) {
                    throw new Errors.MoleculerError("Forbidden", 403, "FORBIDDEN");
                }

                await ctx.call("oss.removeObject", { userId: id });
                // No content to return, Moleculer handles 204 response if handler returns undefined.
            }
        }
    },

    methods: {
        /**
         * Converts UserRole enum to a client-facing string.
         */
        getUserRole(user: User): string {
            switch (user.role) {
                case UserRole.USER: return 'customer';
                case UserRole.RIDER: return 'rider';
                case UserRole.MERCHANT: return 'merchant';
                case UserRole.ADMIN: return 'admin';
                default: return 'customer';
            }
        }
    },

    /**
     * Service created lifecycle event handler.
     * Initializes PrismaClient.
     */
    created() {
        this.prisma = new PrismaClient();
    },

    /**
     * Service stopped lifecycle event handler.
     * Disconnects PrismaClient.
     */
    async stopped() {
        await (this.prisma as PrismaClient).$disconnect();
    }
};

export default UserService;