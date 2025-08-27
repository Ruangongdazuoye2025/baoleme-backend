"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const moleculer_1 = require("moleculer");
const token_mixin_1 = __importDefault(require("../mixins/token.mixin"));
const moleculer_db_1 = __importDefault(require("moleculer-db"));
const moleculer_db_adapter_prisma_1 = __importDefault(require("moleculer-db-adapter-prisma"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const DEFAULTS = __importStar(require("../common/auth.constants"));
const uuid = __importStar(require("uuid"));
const AuthService = {
    name: "auth",
    mixins: [token_mixin_1.default, moleculer_db_1.default],
    adapter: new moleculer_db_adapter_prisma_1.default(),
    model: "user",
    actions: {
        register: {
            params: {
                email: "string",
                password: "string"
            },
            async handler(ctx) {
                const { email, password } = ctx.params;
                return await this.adapter.db.$transaction(async (tx) => {
                    const existingUser = await tx.user.findUnique({ where: { email } });
                    if (existingUser) {
                        throw new moleculer_1.Errors.MoleculerError('Email already exists', 403);
                    }
                    const hashedPassword = await bcrypt_1.default.hash(password, DEFAULTS.SALT_ROUNDS);
                    const user = await tx.user.create({
                        data: { email, password: hashedPassword }
                    });
                    const userName = DEFAULTS.USER_NAME_PREFIX + btoa(String.fromCharCode(...uuid.parse(user.id))).slice(0, DEFAULTS.USER_NAME_ID_LENGTH);
                    await tx.user.update({
                        where: { id: user.id },
                        data: { name: userName }
                    });
                    const token = this.generateVerifyToken(user.id);
                    await ctx.call("mail.sendVerifyRegisterEmail", { email, token }, { parentCtx: ctx });
                });
            }
        },
        login: {
            params: {
                email: "string",
                password: "string"
            },
            async handler(ctx) {
                const { email, password } = ctx.params;
                const user = await this.adapter.findOne({
                    email,
                    isVerified: true,
                });
                if (!user || !await bcrypt_1.default.compare(password, user.password)) {
                    throw new moleculer_1.Errors.MoleculerError('Cannot login', 403);
                }
                const token = this.generateAccessToken(user.id, user.password);
                return { token, user };
            }
        },
        updateEmail: {
            params: {
                email: "string"
            },
            async handler(ctx) {
                const { currentUserId } = ctx.meta;
                const { email } = ctx.params;
                const token = this.generateUpdateEmailToken(currentUserId, email);
                await ctx.call("mail.sendVerifyEmailEmail", { email, token }, { parentCtx: ctx });
            }
        },
        forgotPassword: {
            params: {
                email: "string"
            },
            async handler(ctx) {
                const { email } = ctx.params;
                const user = await this.adapter.findOne({ email, isVerified: true });
                if (!user) {
                    throw new moleculer_1.Errors.MoleculerError('User does not exist', 403);
                }
                const token = this.generateResetPasswordToken(user.id);
                await ctx.call("mail.sendResetPasswordEmail", { email, token }, { parentCtx: ctx });
            }
        },
        updatePassword: {
            params: {
                oldPassword: "string",
                newPassword: "string",
            },
            async handler(ctx) {
                const { currentUserId } = ctx.meta;
                const { oldPassword, newPassword } = ctx.params;
                return await this.adapter.db.$transaction(async (tx) => {
                    const user = await tx.user.findUnique({ where: { id: currentUserId, isVerified: true } });
                    if (!user || !await bcrypt_1.default.compare(oldPassword, user.password)) {
                        throw new moleculer_1.Errors.MoleculerError('Old password is incorrect', 403);
                    }
                    const hashedPassword = await bcrypt_1.default.hash(newPassword, DEFAULTS.SALT_ROUNDS);
                    await tx.user.update({ where: { id: currentUserId }, data: { password: hashedPassword } });
                    return this.generateAccessToken(user.id, hashedPassword);
                });
            }
        },
        verifyEmail: {
            params: {
                token: "string"
            },
            async handler(ctx) {
                const { token } = ctx.params;
                const decoded = await this.decodeUpdateEmailToken(token);
                if (!decoded) {
                    throw new moleculer_1.Errors.MoleculerError('Invalid token', 403);
                }
                const id = decoded.sub;
                const email = decoded.email;
                return await this.adapter.db.$transaction(async (tx) => {
                    const user = await tx.user.findUnique({ where: { id, isVerified: true } });
                    if (!user) {
                        throw new moleculer_1.Errors.MoleculerError('Invalid token', 403);
                    }
                    return await tx.user.update({
                        where: { id },
                        data: { email }
                    });
                });
            }
        },
        verifyRegister: {
            params: {
                token: "string"
            },
            async handler(ctx) {
                const { token } = ctx.params;
                const decoded = await this.decodeVerifyToken(token);
                if (!decoded) {
                    throw new moleculer_1.Errors.MoleculerError('Invalid token', 403);
                }
                const id = decoded.sub;
                return await this.adapter.db.$transaction(async (tx) => {
                    const user = await tx.user.findUnique({ where: { id, isVerified: false } });
                    if (!user) {
                        throw new moleculer_1.Errors.MoleculerError('Invalid token', 403);
                    }
                    return await tx.user.update({
                        where: { id },
                        data: { isVerified: true }
                    });
                });
            }
        },
        resetPassword: {
            params: {
                token: "string",
                newPassword: "string"
            },
            async handler(ctx) {
                const { token, newPassword } = ctx.params;
                const decoded = await this.decodeResetPasswordToken(token);
                if (!decoded) {
                    throw new moleculer_1.Errors.MoleculerError('Invalid token', 403);
                }
                const id = decoded.sub;
                return await this.adapter.db.$transaction(async (tx) => {
                    const user = await tx.user.findUnique({ where: { id, isVerified: true } });
                    if (!user) {
                        throw new moleculer_1.Errors.MoleculerError('Invalid token', 403);
                    }
                    const hashedPassword = await bcrypt_1.default.hash(newPassword, DEFAULTS.SALT_ROUNDS);
                    await tx.user.update({ where: { id }, data: { password: hashedPassword } });
                });
            }
        }
    },
    /**
     * Service started lifecycle event handler
     */
    async started() {
        this.logger.info("Auth Service started");
    }
};
exports.default = AuthService;
//# sourceMappingURL=auth.service.js.map