import { Context, ServiceSchema, Errors } from "moleculer";
import TokenMixin from "../mixins/token.mixin";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import * as DEFAULTS from "../common/auth.constants";
import * as uuid from 'uuid'
import Joi from "joi";

const emailPasswordRequestSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(DEFAULTS.PASSWORD_MIN_LENGTH).required()
});

interface EmailPasswordRequest {
    email: string;
    password: string;
}

const updateEmailRequestSchema = Joi.object({
    newEmail: Joi.string().email().required()
});

interface UpdateEmailRequest {
    newEmail: string;
}

const emailRequestSchema = Joi.object({
    email: Joi.string().email().required()
});

interface EmailRequest {
    email: string;
}

const updatePasswordRequestSchema = Joi.object({
    oldPassword: Joi.string().min(DEFAULTS.PASSWORD_MIN_LENGTH).required(),
    newPassword: Joi.string().min(DEFAULTS.PASSWORD_MIN_LENGTH).required()
});

interface UpdatePasswordRequest {
    oldPassword: string;
    newPassword: string;
}

const tokenRequestSchema = Joi.object({
    token: Joi.string().required()
});

interface TokenRequest {
    token: string;
}

const tokenPasswordRequestSchema = Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(DEFAULTS.PASSWORD_MIN_LENGTH).required()
});

interface TokenPasswordRequest {
    token: string;
    newPassword: string;
}

const AuthService: ServiceSchema = {
    name: "auth",
    mixins: [TokenMixin],

    actions: {
        register: {
            params: emailPasswordRequestSchema as any,
            async handler(ctx: Context<EmailPasswordRequest>) {
                const { email, password } = ctx.params
                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    const existingUser = await tx.user.findUnique({ where: { email } })
                    if (existingUser) {
                        throw new Errors.MoleculerError('Email already exists', 403)
                    }
                    
                    const hashedPassword = await bcrypt.hash(password, DEFAULTS.SALT_ROUNDS)
                    const user = await tx.user.create({
                        data: { email, password: hashedPassword }
                    })

                    const userName = DEFAULTS.USER_NAME_PREFIX + btoa(String.fromCharCode(...uuid.parse(user.id))).slice(0, DEFAULTS.USER_NAME_ID_LENGTH)
                    await tx.user.update({
                        where: { id: user.id },
                        data: { name: userName }
                    })
                    
                    const token = this.generateVerifyToken(user.id)
                    await ctx.call("mail.sendVerifyRegisterEmail", { email, token }, { parentCtx: ctx })
                })
            }
        },
        login: {
            params: emailPasswordRequestSchema as any,
            async handler(ctx: Context<EmailPasswordRequest>) {
                const { email, password } = ctx.params
                const user = await (this.prisma as PrismaClient).user.findUnique({
                    where: { email, isVerified: true },
                })
                if (!user || !await bcrypt.compare(password, user.password)) {
                    throw new Errors.MoleculerError('Cannot login', 403)
                }
                const token = this.generateAccessToken(user.id, user.password)
                return { token, id: user.id }
            }
        },
        updateEmail: {
            params: updateEmailRequestSchema as any,
            async handler(ctx: Context<UpdateEmailRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta
                const { newEmail } = ctx.params
                const token = this.generateUpdateEmailToken(currentUserId, newEmail)
                await ctx.call("mail.sendVerifyEmailEmail", { email: newEmail, token }, { parentCtx: ctx })
            }
        },
        forgotPassword: {
            params: emailRequestSchema as any,
            async handler(ctx: Context<EmailRequest>) {
                const { email } = ctx.params
                const user = await (this.prisma as PrismaClient).user.findUnique({
                    where: { email, isVerified: true }
                })
                if (!user) {
                    throw new Errors.MoleculerError('User does not exist', 403)
                }
                const token = this.generateResetPasswordToken(user.id)
                await ctx.call("mail.sendResetPasswordEmail", { email, token }, { parentCtx: ctx })
            }
        },
        updatePassword: {
            params: updatePasswordRequestSchema as any,
            async handler(ctx: Context<UpdatePasswordRequest, { currentUserId: string }>) {
                const { currentUserId } = ctx.meta
                const { oldPassword, newPassword } = ctx.params
                    return await (this.prisma as PrismaClient).$transaction(async tx => {
                        const user = await tx.user.findUnique({ where: { id: currentUserId, isVerified: true } })
                    if (!user || !await bcrypt.compare(oldPassword, user.password)) {
                        throw new Errors.MoleculerError('Old password is incorrect', 403)
                    }
                    const hashedPassword = await bcrypt.hash(newPassword, DEFAULTS.SALT_ROUNDS)
                    await tx.user.update({ where: { id: currentUserId }, data: { password: hashedPassword } })
                    return { token: this.generateAccessToken(user.id, hashedPassword) }
                })
                
            }
        },
        verifyEmail: {
            params: tokenRequestSchema as any,
            async handler(ctx: Context<TokenRequest>) {
                const { token } = ctx.params
                const decoded = await this.decodeUpdateEmailToken(token)
                if (!decoded) {
                    throw new Errors.MoleculerError('Invalid token', 403)
                }
                const id = decoded.sub
                const email = decoded.email
                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    const user = await tx.user.findUnique({ where: { id, isVerified: true } })
                    if (!user) {
                        throw new Errors.MoleculerError('Invalid token', 403)
                    }
                    return await tx.user.update({
                        where: { id },
                        data: { email }
                    })
                })
            }
        },
        verifyRegister: {
            params: tokenRequestSchema as any,
            async handler(ctx: Context<TokenRequest>) {
                const { token } = ctx.params
                const decoded = await this.decodeVerifyToken(token)
                if (!decoded) {
                    throw new Errors.MoleculerError('Invalid token', 403)
                }
                const id = decoded.sub
                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    const user = await tx.user.findUnique({ where: { id, isVerified: false } })
                    if (!user) {
                        throw new Errors.MoleculerError('Invalid token', 403)
                    }
                    return await tx.user.update({
                        where: { id },
                        data: { isVerified: true }
                    })
                })
            }
        },
        resetPassword: {
            params: tokenPasswordRequestSchema as any,
            async handler(ctx: Context<TokenPasswordRequest>) {
                const { token, newPassword } = ctx.params
                const decoded = await this.decodeResetPasswordToken(token)
                if (!decoded) {
                    throw new Errors.MoleculerError('Invalid token', 403)
                }
                const id = decoded.sub
                return await (this.prisma as PrismaClient).$transaction(async tx => {
                    const user = await tx.user.findUnique({ where: { id, isVerified: true } })
                    if (!user) {
                        throw new Errors.MoleculerError('Invalid token', 403)
                    }
                    const hashedPassword = await bcrypt.hash(newPassword, DEFAULTS.SALT_ROUNDS)
                    await tx.user.update({ where: { id }, data: { password: hashedPassword } })
                })
            }
        },
        authenticateWithToken: {
            params: tokenRequestSchema as any,
            async handler(ctx: Context<TokenRequest>) {
                const { token } = ctx.params
                const decoded = await this.decodeAccessToken(token)
                if (!decoded) {
                    return ""
                }
                const id = decoded.sub
                const password = decoded.pwd
                const user = await (this.prisma as PrismaClient).user.findUnique({ where: { id, isVerified: true } })
                if (user && password && password !== user?.password) {
                    return ""
                }
                return id
            }
        }
    },

    created() {
        this.prisma = new PrismaClient()
    }
};

export default AuthService;