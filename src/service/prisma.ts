import { PrismaClient } from '@prisma/client';
import { Logger } from 'pino';
import { factoryInjection, factoryMethod, injected } from '../util/injection-decorators';

class PrismaFactory {

    @factoryMethod
    static makePrisma(@injected('logger', true) logger: Logger) {
        const prisma = new PrismaClient()

        return prisma
    }

}

export default factoryInjection(PrismaFactory)
