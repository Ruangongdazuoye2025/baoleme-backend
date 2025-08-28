import { PrismaClient, User, UserRole } from "@prisma/client";
import { Context, ServiceSchema } from "moleculer";
import ApiGateway, { IncomingRequest, Route, GatewayResponse } from 'moleculer-web'

const E = ApiGateway.Errors;

const NON_LOGIN_APIS = [
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/forgot-password",
    "/api/auth/verify-register",
    "/api/auth/verify-email",
    "/api/auth/reset-password"
]

export interface AuthMeta {
    currentUserId: string;
    currentUserRole: UserRole;
}

const ApiAuthMixin: ServiceSchema = {
    name: "apiAuth",
    prisma: new PrismaClient(),
    settings: {
        jwtSecret: process.env.JWT_SECRET || "default-secret"
    },

    methods: {
        async authorize(ctx: Context<any, AuthMeta>, route: Route, req: IncomingRequest, res: GatewayResponse) {
            if (NON_LOGIN_APIS.includes(req.parsedUrl)) {
                return
            }
            const auth = req.headers["authorization"];
            if (auth && auth.startsWith("Bearer")) {
                const token = auth.slice(7);
                const user = await ctx.call("auth.authenticateWithToken", { token }) as User
                if (!user || !user.isVerified) {
                    throw new E.UnAuthorizedError(E.ERR_INVALID_TOKEN, { token });
                }
                ctx.meta.currentUserId = user.id;
                ctx.meta.currentUserRole = user.role;
            } else {
                throw new E.UnAuthorizedError(E.ERR_NO_TOKEN, undefined);
            }
        }
    }
};

export default ApiAuthMixin;