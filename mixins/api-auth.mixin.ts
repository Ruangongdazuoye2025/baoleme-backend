import { PrismaClient } from "@prisma/client";
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

const ApiAuthMixin: ServiceSchema = {
    name: "apiAuth",
    prisma: new PrismaClient(),
    settings: {
        jwtSecret: process.env.JWT_SECRET || "default-secret"
    },

    methods: {
        async authorize(ctx: Context<any, { currentUserId: string }>, route: Route, req: IncomingRequest, res: GatewayResponse) {
            if (NON_LOGIN_APIS.includes(req.parsedUrl)) {
                return
            }
            const auth = req.headers["authorization"];
            if (auth && auth.startsWith("Bearer")) {
                const token = auth.slice(7);
                const id = await ctx.call("auth.authenticateWithToken", { token }) as string
                if (!id) {
                    throw new E.UnAuthorizedError(E.ERR_INVALID_TOKEN, { token });
                }
                ctx.meta.currentUserId = id;
            } else {
                throw new E.UnAuthorizedError(E.ERR_NO_TOKEN, undefined);
            }
        }
    }
};

export default ApiAuthMixin;