npm run build  # 由于 TypedORM 需要依赖 PostgreSQL 的原因只能在运行前编译
node scripts/make-bucket
npx prisma migrate deploy
npm start