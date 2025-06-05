import Joi from 'joi'

const envSchema = Joi.object({
    APP_PORT: Joi.number().required(),
    APP_NAME: Joi.string().required(),
    BASE_URL: Joi.string().uri().required(),
    DATABASE_URL: Joi.string().uri().required(),
    JWT_SECRET: Joi.string().required(),
    SMTP_HOST: Joi.string().required(),
    SMTP_PORT: Joi.number().required(),
    SMTP_SECURE: Joi.string().allow(''),
    SMTP_USER: Joi.string().required(),
    SMTP_PASSWORD: Joi.string().required(),
    MINIO_HOST: Joi.string().required(),
    MINIO_PORT: Joi.number().required(),
    MINIO_USE_SSL: Joi.string().allow(''),
    MINIO_ACCESS_KEY: Joi.string().required(),
    MINIO_SECRET_KEY: Joi.string().required(),
    MINIO_BUCKET: Joi.string().required(),
    STATIC_ROOT: Joi.string().required(),
    AMAP_JSCODE: Joi.string().required(),
}).unknown(true).required()

export function validateEnv() {
    const err = envSchema.validate(process.env, { abortEarly: false }).error
    if (err) {
        throw err
    }
}
