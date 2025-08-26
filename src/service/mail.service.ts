import nodemailer from 'nodemailer'
import { classInjection } from '../util/injection-decorators'

@classInjection
export default  class MailService {
    private transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Boolean(process.env.SMTP_SECURE),
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        },
    })

    async sendVerifyRegisterEmail(email: string, token: string) {
        let url = `${process.env.BASE_URL}/email-postprocess/verify-register?token=${encodeURIComponent(token)}`
        await this.transporter.sendMail({
            from: `${process.env.APP_NAME} ${process.env.SMTP_USER}`,
            to: email,
            subject: 'Email Verification',
            html: `<a href="${url}">${url}</a>`
        })
    }

    async sendVerifyEmailEmail(email: string, token: string) {
        let url = `${process.env.BASE_URL}/email-postprocess/verify-email?token=${encodeURIComponent(token)}`
        await this.transporter.sendMail({
            from: `${process.env.APP_NAME} ${process.env.SMTP_USER}`,
            to: email,
            subject: 'Email Verification',
            html: `<a href="${url}">${url}</a>`
        })
    }

    async sendResetPasswordEmail(email: string, token: string) {
        let url = `${process.env.BASE_URL}/email-postprocess/reset-password?token=${encodeURIComponent(token)}`
        await this.transporter.sendMail({
            from: `${process.env.APP_NAME} ${process.env.SMTP_USER}`,
            to: email,
            subject: 'Reset Password',
            html: `<a href="${url}">${url}</a>`
        })
    }


}
