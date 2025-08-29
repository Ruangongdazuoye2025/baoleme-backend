import { Context, ServiceSchema } from "moleculer";
import ApiGateway, { IncomingRequest, Route, GatewayResponse, ApiSettingsSchema } from 'moleculer-web'
import ApiAuthMixin from "../mixins/api-auth.mixin";

const E = ApiGateway.Errors;



const ApiService: ServiceSchema<ApiSettingsSchema> = {
    name: "api",
    mixins: [ApiGateway, ApiAuthMixin],
    settings: {
        port: parseInt(process.env.PORT || "3000"),
        ip: "0.0.0.0",
        routes: [
            {
                path: "/api",
                mappingPolicy: "restrict",
                authorization: true,
                aliases: {
                    "POST /auth/register": "auth.register",
                    "POST /auth/login": "auth.login",
                    "POST /auth/forgot-password": "auth.forgotPassword",
                    "POST /auth/verify-register": "auth.verifyRegister",
                    "POST /auth/verify-email": "auth.verifyEmail",
                    "POST /auth/reset-password": "auth.resetPassword",
                    "POST /auth/update-email": "auth.updateEmail",
                    "POST /auth/update-password": "auth.updatePassword",
                    "GET /user/{id}": "user.get",
                },
                onAfterCall(ctx, route, req, res, data) {
                    if (!data) {
                        res.statusCode = 204
                    }
                    return data
                },
            }
        ]
    },
};

export default ApiService;
