import express, { Router } from 'express'
import { factoryInjection, factoryMethod } from '../util/injection-decorators'
import history from 'connect-history-api-fallback'

class StaticRoute {

    @factoryMethod
    static staticRoute() {
        const router = Router()

        router.use(history())
        router.use(express.static(process.env.STATIC_ROOT!))

        return router
    }

}

export default factoryInjection(StaticRoute)
