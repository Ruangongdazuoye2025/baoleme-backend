"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const minio_1 = require("minio");
const OSSService = {
    name: "oss",
    settings: {
        endPoint: process.env.OSS_ENDPOINT || "",
        port: Number(process.env.OSS_PORT) || 9000,
        useSSL: process.env.OSS_USE_SSL === "true",
        accessKey: process.env.OSS_ACCESS_KEY || "",
        secretKey: process.env.OSS_SECRET_KEY || "",
        bucketName: process.env.OSS_BUCKET_NAME || ""
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
                return await this.actions.getObjectUrl({}, { parentCtx: ctx });
            }
        },
        removeObject: {
            async handler(ctx) {
                await this.minio.removeObject(this.settings.bucketName, ctx.meta.objectName);
            }
        }
    },
    created() {
        this.minio = new minio_1.Client({
            endPoint: this.settings.endPoint,
            port: this.settings.port,
            useSSL: this.settings.useSSL,
            accessKey: this.settings.accessKey,
            secretKey: this.settings.secretKey
        });
    }
};
//# sourceMappingURL=oss.service.js.map