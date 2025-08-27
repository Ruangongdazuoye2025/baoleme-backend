"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nodemailer_1 = __importDefault(require("nodemailer"));
const MailService = {
    name: "mail",
    settings: {
        /** @type {String} SMTP host from environment variable */
        smtpHost: process.env.SMTP_HOST || "localhost",
        /** @type {Number} SMTP port from environment variable */
        smtpPort: Number(process.env.SMTP_PORT) || 587,
        /** @type {Boolean} SMTP secure connection from environment variable */
        smtpSecure: process.env.SMTP_SECURE === "true",
        /** @type {String} SMTP user from environment variable */
        smtpUser: process.env.SMTP_USER || "",
        /** @type {String} SMTP password from environment variable */
        smtpPassword: process.env.SMTP_PASSWORD || "",
        /** @type {String} Base URL from environment variable */
        baseUrl: process.env.BASE_URL || "http://localhost:3000",
        /** @type {String} Application name from environment variable */
        appName: process.env.APP_NAME || "Application"
    },
    actions: {
        /**
         * Send verification email for user registration
         *
         * @actions
         * @param {string} email - Recipient email address
         * @param {string} token - Verification token
         *
         * @returns {PromiseLike<object>} - Returns sending result
         */
        sendVerifyRegisterEmail: {
            params: {
                email: { type: "string", format: "email" },
                token: { type: "string" }
            },
            async handler(ctx) {
                const { email, token } = ctx.params;
                const url = `${this.settings.baseUrl}/email-postprocess/verify-register?token=${encodeURIComponent(token)}`;
                const result = await this.transporter.sendMail({
                    from: `${this.settings.appName} <${this.settings.smtpUser}>`,
                    to: email,
                    subject: 'Email Verification',
                    html: `<div>
                        <h2>Welcome to ${this.settings.appName}!</h2>
                        <p>Please click the link below to verify your email address:</p>
                        <a href="${url}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <p><a href="${url}">${url}</a></p>
                        <p>This link will expire in 1 hour.</p>
                    </div>`
                });
                this.logger.info(`Verification registration email sent to ${email}`);
                return {
                    success: true,
                    messageId: result.messageId,
                    message: "Verification email sent successfully"
                };
            }
        },
        /**
         * Send verification email for email change
         *
         * @actions
         * @param {string} email - Recipient email address
         * @param {string} token - Verification token
         *
         * @returns {PromiseLike<object>} - Returns sending result
         */
        sendVerifyEmailEmail: {
            params: {
                email: { type: "string", format: "email" },
                token: { type: "string" }
            },
            async handler(ctx) {
                const { email, token } = ctx.params;
                const url = `${this.settings.baseUrl}/email-postprocess/verify-email?token=${encodeURIComponent(token)}`;
                const result = await this.transporter.sendMail({
                    from: `${this.settings.appName} <${this.settings.smtpUser}>`,
                    to: email,
                    subject: 'Email Verification',
                    html: `<div>
                        <h2>Email Address Verification</h2>
                        <p>Please click the link below to verify your new email address:</p>
                        <a href="${url}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <p><a href="${url}">${url}</a></p>
                        <p>This link will expire in 1 hour.</p>
                    </div>`
                });
                this.logger.info(`Verification email sent to ${email}`);
            }
        },
        /**
         * Send reset password email
         *
         * @actions
         * @param {string} email - Recipient email address
         * @param {string} token - Reset password token
         *
         * @returns {PromiseLike<object>} - Returns sending result
         */
        sendResetPasswordEmail: {
            params: {
                email: { type: "string", format: "email" },
                token: { type: "string" }
            },
            async handler(ctx) {
                const { email, token } = ctx.params;
                const url = `${this.settings.baseUrl}/email-postprocess/reset-password?token=${encodeURIComponent(token)}`;
                const result = await this.transporter.sendMail({
                    from: `${this.settings.appName} <${this.settings.smtpUser}>`,
                    to: email,
                    subject: 'Reset Password',
                    html: `<div>
                        <h2>Password Reset Request</h2>
                        <p>You have requested to reset your password. Please click the link below:</p>
                        <a href="${url}" style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <p><a href="${url}">${url}</a></p>
                        <p>This link will expire in 1 hour.</p>
                        <p>If you didn't request this password reset, please ignore this email.</p>
                    </div>`
                });
                this.logger.info(`Reset password email sent to ${email}`);
            }
        },
    },
    methods: {
        /**
         * Create nodemailer transporter
         */
        createTransporter() {
            return nodemailer_1.default.createTransport({
                host: this.settings.smtpHost,
                port: this.settings.smtpPort,
                secure: this.settings.smtpSecure,
                auth: {
                    user: this.settings.smtpUser,
                    pass: this.settings.smtpPassword
                },
            });
        }
    },
    /**
     * Service created lifecycle event handler
     */
    created() {
        this.transporter = this.createTransporter();
    },
    /**
     * Service started lifecycle event handler
     */
    async started() {
        this.logger.info("Mail Service started");
        // Validate SMTP configuration
        if (!this.settings.smtpHost || !this.settings.smtpUser || !this.settings.smtpPassword) {
            this.logger.warn("SMTP configuration incomplete. Please check environment variables: SMTP_HOST, SMTP_USER, SMTP_PASSWORD");
        }
        // Test connection on startup
        try {
            await this.transporter.verify();
            this.logger.info("SMTP connection verified successfully");
        }
        catch (error) {
            this.logger.error("SMTP connection verification failed:", error.message);
        }
    },
    /**
     * Service stopped lifecycle event handler
     */
    async stopped() {
        if (this.transporter) {
            this.transporter.close();
            this.logger.info("Mail Service stopped and transporter closed");
        }
    }
};
exports.default = MailService;
//# sourceMappingURL=mail.service.js.map