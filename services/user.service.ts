import { Context, ServiceSchema, Errors } from "moleculer";
import { PrismaClient, User, UserRole } from "@prisma/client";
import Joi from "joi";
import sharp from 'sharp'
import { FILE_CONSTANTS, DEFAULTS } from "../common/auth.constants";
import * as uuid from 'uuid'
import { AuthMeta } from "../mixins/api-auth.mixin";
import { Readable } from "stream";

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
    role: Joi.string().valid('customer', 'rider', 'merchant').optional(),
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

interface AvatarLinks {
    origin: string;
    thumbnail: string;
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
            async handler(ctx: Context<UserProfileParams, AuthMeta>) {
                const { id } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;

                const [user, avatar] = await Promise.all([
                    (this.prisma as PrismaClient).user.findUnique({ where: { id } }),
                    this.getAvatarLinks(id, ctx)
                ]);

                if (!user) {
                    throw new Errors.MoleculerError("User not found", 404, "USER_NOT_FOUND");
                }

                const isOwner = currentUserId === user.id;
                const isAdmin = currentUserRole === UserRole.ADMIN;
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
            async handler(ctx: Context<UserProfileParams & UpdateUserProfileRequest, AuthMeta>) {
                const { id, ...data } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;

                const userToUpdate = await (this.prisma as PrismaClient).user.findUnique({ where: { id } });
                if (!userToUpdate) {
                    throw new Errors.MoleculerError("User not found", 404, "USER_NOT_FOUND");
                }

                if (currentUserId !== id && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 403)
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

                if (roleKey === UserRole.ADMIN && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError('Permission denied', 403)
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
            async handler(ctx: Context<any, AuthMeta & { $params: UserProfileParams }>) {
                const stream = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;
                const { id } = ctx.meta.$params;
                const { fieldname, mimetype } = ctx.meta as any;

                if (fieldname !== 'avatar' || !mimetype.startsWith('image/')) {
                    throw new Errors.MoleculerError("Invalid request", 400);
                }
                if (currentUserId !== id && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError("Forbidden", 403, "FORBIDDEN");
                }
                const chunks: Buffer[] = [];
                for await (const chunk of stream as Readable) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
                const [origin, thumbnail] = await Promise.all([
                    ctx.call("oss.putObject", sharp(buffer).toFormat('webp'), { meta: { objectName: `users/${id}/avatar.webp`, contentType: 'image/webp' } }),
                    ctx.call("oss.putObject", sharp(buffer).resize(128, 128).toFormat('webp'), { meta: { objectName: `users/${id}/avatar-thumbnail.webp`, contentType: 'image/webp' } })
                ])
                return { origin, thumbnail }
            }
        },

        /**
         * Delete user's avatar.
         */
        deleteAvatar: {
            params: userProfileParamsSchema as any,
            async handler(ctx: Context<UserProfileParams, AuthMeta>) {
                const { id } = ctx.params;
                const { currentUserId, currentUserRole } = ctx.meta;

                if (currentUserId !== id && currentUserRole !== UserRole.ADMIN) {
                    throw new Errors.MoleculerError("Forbidden", 403, "FORBIDDEN");
                }

                await Promise.all([
                    ctx.call("oss.removeObject", undefined, { meta: { objectName: `users/${id}/avatar.webp` } }),
                    ctx.call("oss.removeObject", undefined, { meta: { objectName: `users/${id}/avatar-thumbnail.webp` } })
                ])
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
        },

        async getAvatarLinks(id: string, ctx: Context): Promise<AvatarLinks> {
            const [origin, thumbnail] = await Promise.all([
                ctx.call("oss.getObjectUrl", undefined, { meta: { objectName: `users/${id}/avatar.webp` }}),
                ctx.call("oss.getObjectUrl", undefined, { meta: { objectName: `users/${id}/avatar-thumbnail.webp` }})
            ]) as [string, string];
            return { origin, thumbnail };
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