import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { container } from './container'
import { DB_CONSTANTS } from '../constants/app.constants'
import { Logger } from 'pino'

// Schedule to clean up unverified users every hour
cron.schedule('0 * * * *', async () => {
    const prisma: PrismaClient = container.resolve('prisma')
    const logger: Logger = container.resolve('logger')
    
    const expiryTime = new Date(Date.now() - DB_CONSTANTS.UNVERIFIED_USER_EXPIRY_HOURS * 60 * 60 * 1000)
    
    try {
        const result = await prisma.user.deleteMany({
            where: {
                isVerified: false,
                createdAt: { lt: expiryTime },
            },
        })
        
        if (result.count > 0) {
            logger.info(`[schedule] Deleted ${result.count} unverified users older than ${DB_CONSTANTS.UNVERIFIED_USER_EXPIRY_HOURS} hour(s)`)
        }
    } catch (err) {
        logger.error({ err }, '[schedule] Error deleting unverified users')
    }
})
