import { Context, ServiceSchema } from "moleculer";
import { Client } from 'minio';

const OSSService: ServiceSchema = {
    name: "oss",
    settings: {
        endPoint: process.env.MINIO_ENDPOINT || "",
        port: Number(process.env.MINIO_PORT) || 9000,
        useSSL: process.env.MINIO_USE_SSL === "true",
        accessKey: process.env.MINIO_ACCESS_KEY || "",
        secretKey: process.env.MINIO_SECRET_KEY || "",
        bucketName: process.env.MINIO_BUCKET_NAME || ""
    },

    actions: {
        existsObject: {
            async handler(ctx) {
                return (await this.minio.listObjects(this.settings.bucketName, ctx.meta.objectName, false).toArray()).length > 0;
            }
        },

        getObjectUrl: {
            async handler(ctx) {
                return await this.minio.presignedGetObject(this.settings.bucketName, ctx.meta.objectName);
            }
        },

        putObject: {
            async handler(ctx) {
                await this.minio.putObject(this.settings.bucketName, ctx.meta.objectName, ctx.params, undefined, ctx.meta.contentType);
                return await this.actions.getObjectUrl({}, { parentCtx: ctx })
            }
        },

        removeObject: {
            async handler(ctx) {
                await this.minio.removeObject(this.settings.bucketName, ctx.meta.objectName);
            }
        }
    },

    
    created() {
        this.minio = new Client({
            endPoint: this.settings.endPoint,
            port: this.settings.port,
            useSSL: this.settings.useSSL,
            accessKey: this.settings.accessKey,
            secretKey: this.settings.secretKey
        });
    }
}

export default OSSService;