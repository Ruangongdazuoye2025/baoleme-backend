import { Router } from 'express'
import * as AuthSchema from '../schema/auth.schema'
import AuthService from '../service/auth.service'
import { validateBody } from '../middleware/validator.middleware'
import { factoryInjection, factoryMethod, injected } from '../util/injection-decorators'
import { HTTP_STATUS } from '../constants/app.constants'

class AuthController {

    @factoryMethod
    static authController(
        @injected('authService') authService: AuthService,
    ) {
        const router = Router()

        router.post(
            '/auth/register',
            validateBody(AuthSchema.registerLogin),
            async (req, res) => {
                const { email, password } = req.body as AuthSchema.RegisterLogin
                await authService.register(email, password)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        router.post(
            '/auth/login',
            validateBody(AuthSchema.registerLogin),
            async (req, res) => {
                const { email, password } = req.body as AuthSchema.RegisterLogin
                const { token, user } = await authService.login(email, password)
                res.status(HTTP_STATUS.OK).json({ token, id: user.id })
            }
        )

        router.post(
            '/auth/update-email',
            authService.requireAuth(),
            validateBody(AuthSchema.updateEmail),
            async (req, res) => {
                const { newEmail } = req.body as AuthSchema.UpdateEmail
                await authService.updateEmail(req.user!.id, newEmail)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        router.post(
            '/auth/update-password',
            authService.requireAuth(),
            validateBody(AuthSchema.updatePassword),
            async (req, res) => {
                const { oldPassword, newPassword } = req.body as AuthSchema.UpdatePassword
                const token = await authService.updatePassword(req.user!.id, oldPassword, newPassword)
                res.status(HTTP_STATUS.OK).json({ token })
            }
        )

        router.post(
            '/auth/forgot-password',
            validateBody(AuthSchema.forgotPassword),
            async (req, res) => {
                const { email } = req.body as AuthSchema.ForgotPassword
                await authService.forgotPassword(email)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        router.post(
            '/auth/verify-register',
            validateBody(AuthSchema.verifyToken),
            async (req, res) => {
                const { token } = req.body as AuthSchema.VerifyToken
                await authService.verifyRegister(token)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        router.post(
            '/auth/verify-email',
            validateBody(AuthSchema.verifyToken),
            async (req, res) => {
                const { token } = req.body as AuthSchema.VerifyToken
                await authService.verifyEmail(token)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        router.post(
            '/auth/reset-password',
            validateBody(AuthSchema.resetPassword),
            async (req, res) => {
                const { token, newPassword } = req.body as AuthSchema.ResetPassword
                await authService.resetPassword(token, newPassword)
                res.status(HTTP_STATUS.NO_CONTENT).send()
            }
        )

        return router

    }
}

export default factoryInjection(AuthController)
