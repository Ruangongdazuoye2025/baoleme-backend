import express, { Router } from 'express'
import { errorHandler } from '../middleware/errorhandler.middleware'
import { factoryInjection, factoryMethod, injected } from '../util/injection-decorators'

class APIFactory {

    @factoryMethod
    static apiRoute(
        @injected('helloController') helloController: Router,
        @injected('authController') authController: Router,
        @injected('userController') userController: Router,
        @injected('shopController') shopController: Router,
        @injected('shopCategoryController') shopCategoryController: Router,
        @injected('itemCategoryController') itemCategoryController: Router
    ) {
        const router = Router()

        router.use(express.json())
        router.use('/', helloController)
        router.use('/', authController)
        router.use('/', userController)
        router.use('/', shopController)
        router.use('/', shopCategoryController)
        router.use('/', itemCategoryController)
        router.use(errorHandler)

        return router
    }

}

export default factoryInjection(APIFactory)
