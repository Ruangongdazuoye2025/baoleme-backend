import { Client } from 'minio'
import stream from 'stream'
import { classInjection, injected } from '../util/injection-decorators'

@classInjection
export default class OSSService {

    @injected
    private minio!: Client

    async createBucketIfNotExist() {
        if (!await this.minio.bucketExists(process.env.MINIO_BUCKET!)) {
            await this.minio.makeBucket(process.env.MINIO_BUCKET!)
            return true
        }
        return false
    }

    async existsObject(objectName: string) {
        return (await this.minio.listObjects(process.env.MINIO_BUCKET!, objectName, false).toArray()).length > 0
    }

    async getObjectUrl(objectName: string) {
        return await this.minio.presignedGetObject(process.env.MINIO_BUCKET!, objectName)
    }

    async putObject(objectName: string, buffer: stream.Readable | Buffer | string, contentType?: string) {
        await this.minio.putObject(process.env.MINIO_BUCKET!, objectName, buffer, undefined, contentType ? { 'Content-Type': contentType } : undefined)
        return await this.getObjectUrl(objectName)
    }

    async removeObject(objectName: string) {
        await this.minio.removeObject(process.env.MINIO_BUCKET!, objectName)
    }

}