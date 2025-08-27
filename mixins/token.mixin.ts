import { Context, ServiceSchema } from "moleculer";
import jwt, { JwtPayload } from 'jsonwebtoken';

/**
 * Token mixin for JWT token operations
 * 
 * @name token-mixin
 * @module Mixin
 */
const TokenMixin: ServiceSchema = {
    name: "token",

    settings: {
        /** @type {String} JWT secret key from environment variable */
        jwtSecret: process.env.JWT_SECRET || "default-secret"
    },

    methods: {
        /**
         * Generate access token
         * 
         * @param {string} userId - User ID
         * @param {string} password - User password
         * 
         * @returns {string} - Returns generated access token
         */
        generateAccessToken(userId: string, password: string): string {
            return jwt.sign(
                { sub: userId, pwd: password }, 
                this.settings.jwtSecret, 
                { expiresIn: '100d' }
            );
        },

        /**
         * Generate verification token
         * 
         * @param {string} userId - User ID
         * 
         * @returns {string} - Returns generated verification token
         */
        generateVerifyToken(userId: string): string {
            return jwt.sign(
                { sub: userId, verify: true }, 
                this.settings.jwtSecret, 
                { expiresIn: '1h' }
            );
        },

        /**
         * Decode verification token
         * 
         * @param {string} token - JWT token to decode
         * 
         * @returns {Promise<JwtPayload|null>} - Returns decoded payload or null if invalid
         */
        decodeVerifyToken(token: string): Promise<JwtPayload | null> {
            return new Promise((resolve) => {
                jwt.verify(token, this.settings.jwtSecret as string, (err, decoded) => {
                    if (err || !decoded || typeof(decoded) === 'string' || !decoded.verify) {
                        resolve(null);
                    } else {
                        resolve(decoded as JwtPayload);
                    }
                });
            });
        },

        /**
         * Generate update email token
         * 
         * @param {string} userId - User ID
         * @param {string} newEmail - New email address
         * 
         * @returns {string} - Returns generated update email token
         */
        generateUpdateEmailToken(userId: string, newEmail: string): string {
            return jwt.sign(
                { sub: userId, email: newEmail }, 
                this.settings.jwtSecret, 
                { expiresIn: '1h' }
            );
        },

        /**
         * Decode update email token
         * 
         * @param {string} token - JWT token to decode
         * 
         * @returns {Promise<(JwtPayload & { email: string })|null>} - Returns decoded payload with email or null if invalid
         */
        decodeUpdateEmailToken(token: string): Promise<(JwtPayload & { email: string }) | null> {
            return new Promise((resolve) => {
                jwt.verify(token, this.settings.jwtSecret as string, (err, decoded) => {
                    if (err || !decoded || typeof(decoded) === 'string' || typeof(decoded.email) !== 'string') {
                        resolve(null);
                    } else {
                        resolve({ ...decoded, email: decoded.email } as JwtPayload & { email: string });
                    }
                });
            });
        },

        /**
         * Generate reset password token
         * 
         * @param {string} userId - User ID
         * 
         * @returns {string} - Returns generated reset password token
         */
        generateResetPasswordToken(userId: string): string {
            return jwt.sign(
                { sub: userId, resetPassword: true }, 
                this.settings.jwtSecret, 
                { expiresIn: '1h' }
            );
        },

        /**
         * Decode reset password token
         * 
         * @param {string} token - JWT token to decode
         * 
         * @returns {Promise<JwtPayload|null>} - Returns decoded payload or null if invalid
         */
        decodeResetPasswordToken(token: string): Promise<JwtPayload | null> {
            return new Promise((resolve) => {
                jwt.verify(token, this.settings.jwtSecret as string, (err, decoded) => {
                    if (err || !decoded || typeof(decoded) === 'string' || !decoded.resetPassword) {
                        resolve(null);
                    } else {
                        resolve(decoded as JwtPayload);
                    }
                });
            });
        },

        decodeAccessToken(token: string): Promise<JwtPayload | null> {
            return new Promise((resolve) => {
                jwt.verify(token, this.settings.jwtSecret as string, (err, decoded) => {
                    if (err || !decoded || typeof(decoded) === 'string' || !decoded.sub || !decoded.pwd) {
                        resolve(null);
                    } else {
                        resolve(decoded as JwtPayload);
                    }
                });
            });
        }
    },

    /**
     * Service started lifecycle event handler
     */
    async started() {
        this.logger.info("Token mixin started");
        
        // Validate JWT secret
        if (!this.settings.jwtSecret || this.settings.jwtSecret === "default-secret") {
            this.logger.warn("JWT_SECRET environment variable not set or using default secret. This is not secure for production!");
        }
    }
};

export default TokenMixin;
