
import dotenv from 'dotenv'
import { Express } from 'express'
import { container, asyncInitializeRoutine } from './app/container'
import { Logger } from 'pino'
import { validateEnv } from './app/env'

dotenv.config()
validateEnv()

const port = parseInt(process.env.APP_PORT!)

const logger: Logger = container.resolve('logger')
const app: Express = container.resolve('app')

logger.info(`${process.env.APP_NAME} has started`)
logger.info(`Initializing...`)

asyncInitializeRoutine.initialize().then(() => {
    logger.info(`Initializing finished, starting listening...`)
    app.listen(port, () => {
        logger.info(`Server is running at http://localhost:${port}`)
    })
}).catch(err => {
    logger.error({ err }, `Error during initialization`)
    process.exit(1)
})
