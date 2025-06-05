import { factoryInjection, factoryMethod, injected } from "../util/injection-decorators";
import passport from 'passport'
import { Strategy as JWTStrategy, ExtractJwt } from 'passport-jwt'
import AuthService from "./auth.service";
import { ResponseError } from "../util/errors";
import { PrismaClient } from "@prisma/client";

class PassportFactory {
    @factoryMethod
    static passportFactory(
        @injected('prisma') prisma: PrismaClient,
    ) {
        const p = new passport.Authenticator()
        const jwtOptions = {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: process.env.JWT_SECRET!
        }

        const getUserById = async (id: string, encryptedPassword: string) => {
            const user = await prisma.user.findUnique({ where: { id } })
            if (user && encryptedPassword && encryptedPassword !== user?.password) {
                return null
            }
            return user
        }

        p.use(new JWTStrategy(jwtOptions, async (payload, done) => {
            try {
                const user = await getUserById(payload.sub, payload.pwd)
                return user ? done(null, user) : done(new ResponseError(401, 'Unauthorized'))
            } catch (error) {
                return done(new ResponseError(401, 'Unauthorized'))
            }
        }))
        return p
    }
}

export default factoryInjection(PassportFactory)