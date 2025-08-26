import passport from 'passport'
import { classInjection, injected } from '../util/injection-decorators'

@classInjection
export default class AuthMiddleware {

    @injected('passport')
    private passport!: passport.Authenticator

    /**
     * Middleware for requiring authentication
     */
    requireAuth() {
        return this.passport.authenticate('jwt', { session: false, failWithError: true })
    }
}
