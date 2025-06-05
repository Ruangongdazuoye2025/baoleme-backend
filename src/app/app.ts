import express, { Router } from 'express'
import { factoryInjection, factoryMethod, injected } from '../util/injection-decorators'

class AppFactory {

    @factoryMethod
    static app(
        @injected('apiRoute') apiRoute: Router,
        @injected('staticRoute') staticRoute: Router,
        @injected('amapProxyRoute') amapProxyRoute: Router
    ) {
        const app = express()
        app.use('/api', apiRoute)
        app.use('/_AMapService', amapProxyRoute)
        app.use('/', staticRoute)

        return app
    }
    
}

export default factoryInjection(AppFactory)
