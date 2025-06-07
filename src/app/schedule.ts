import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { container } from './container'

const prisma = new PrismaClient()

cron.schedule('0 * * * *', async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    try {
        const result = await prisma.user.deleteMany({
            where: {
                isVerified: false,
                createdAt: { lt: oneHourAgo },
            },
        })
        if (result.count > 0) {
            console.log(`[schedule] Deleted ${result.count} unverified users older than 1 hour`)
        }
    } catch (err) {
        console.error('[schedule] Error deleting unverified users:', err)
    }
})
