import { Router } from 'express'
import { factoryInjection, factoryMethod } from '../util/injection-decorators'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { IncomingMessage } from 'http'

const addJscodeToQuery = (urlString: string) => {
    const url = new URL(urlString, 'http://_')
    url.searchParams.append('jscode', process.env.AMAP_JSCODE!)
    return url.searchParams.toString()
}

class AMapProxyRoute {
    @factoryMethod
    static amapProxyRoute() {
        const router = Router()

        router.use(
            '/v4/map/styles',
            createProxyMiddleware({
                target: 'https://webapi.amap.com',
                changeOrigin: true,
                pathRewrite: (path, req) => {
                    return '/v4/map/styles?' + addJscodeToQuery(req.url!)
                }
            })
        )
        router.use(
            '/v3/vectormap',
            createProxyMiddleware({
                target: 'https://fmap01.amap.com',
                changeOrigin: true,
                pathRewrite: (path, req) => {
                    return '/v3/vectormap?' + addJscodeToQuery(req.url!);
                }
            })
        )
        router.use(
            '/',
            createProxyMiddleware({
                target: 'https://restapi.amap.com',
                changeOrigin: true,
                pathRewrite: (path, req) => {
                    const newPath = path.replace(/^\/_AMapService/, '');
                    return newPath + (newPath.includes('?') ? '&' : '?') + addJscodeToQuery('');
                }
            })
        )

        return router
    }
}

export default factoryInjection(AMapProxyRoute)