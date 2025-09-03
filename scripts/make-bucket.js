const { Client } = require('minio')
const dotenv = require('dotenv')
dotenv.config()

const minio = new Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: Number(process.env.MINIO_PORT),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
})

minio.bucketExists(process.env.MINIO_BUCKET).then(exists => {
    if (!exists) {
        return minio.makeBucket(process.env.MINIO_BUCKET)
    }
})
