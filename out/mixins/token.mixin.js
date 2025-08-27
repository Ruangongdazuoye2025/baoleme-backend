"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Token mixin for JWT token operations
 *
 * @name token-mixin
 * @module Mixin
 */
const TokenMixin = {
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
        generateAccessToken(userId, password) {
            return jsonwebtoken_1.default.sign({ sub: userId, pwd: password }, this.settings.jwtSecret, { expiresIn: '100d' });
        },
        /**
         * Generate verification token
         *
         * @param {string} userId - User ID
         *
         * @returns {string} - Returns generated verification token
         */
        generateVerifyToken(userId) {
            return jsonwebtoken_1.default.sign({ sub: userId, verify: true }, this.settings.jwtSecret, { expiresIn: '1h' });
        },
        /**
         * Decode verification token
         *
         * @param {string} token - JWT token to decode
         *
         * @returns {Promise<JwtPayload|null>} - Returns decoded payload or null if invalid
         */
        decodeVerifyToken(token) {
            return new Promise((resolve) => {
                jsonwebtoken_1.default.verify(token, this.settings.jwtSecret, (err, decoded) => {
                    if (err || !decoded || typeof (decoded) === 'string' || !decoded.verify) {
                        resolve(null);
                    }
                    else {
                        resolve(decoded);
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
        generateUpdateEmailToken(userId, newEmail) {
            return jsonwebtoken_1.default.sign({ sub: userId, email: newEmail }, this.settings.jwtSecret, { expiresIn: '1h' });
        },
        /**
         * Decode update email token
         *
         * @param {string} token - JWT token to decode
         *
         * @returns {Promise<(JwtPayload & { email: string })|null>} - Returns decoded payload with email or null if invalid
         */
        decodeUpdateEmailToken(token) {
            return new Promise((resolve) => {
                jsonwebtoken_1.default.verify(token, this.settings.jwtSecret, (err, decoded) => {
                    if (err || !decoded || typeof (decoded) === 'string' || typeof (decoded.email) !== 'string') {
                        resolve(null);
                    }
                    else {
                        resolve({ ...decoded, email: decoded.email });
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
        generateResetPasswordToken(userId) {
            return jsonwebtoken_1.default.sign({ sub: userId, resetPassword: true }, this.settings.jwtSecret, { expiresIn: '1h' });
        },
        /**
         * Decode reset password token
         *
         * @param {string} token - JWT token to decode
         *
         * @returns {Promise<JwtPayload|null>} - Returns decoded payload or null if invalid
         */
        decodeResetPasswordToken(token) {
            return new Promise((resolve) => {
                jsonwebtoken_1.default.verify(token, this.settings.jwtSecret, (err, decoded) => {
                    if (err || !decoded || typeof (decoded) === 'string' || !decoded.resetPassword) {
                        resolve(null);
                    }
                    else {
                        resolve(decoded);
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
exports.default = TokenMixin;
//# sourceMappingURL=token.mixin.js.map