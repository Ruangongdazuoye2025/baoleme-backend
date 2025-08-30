npx prisma migrate deploy
npm install --include=dev
npm run build  # TypedSQL 似乎只能在运行前临时编译一遍
node scripts/make-bucket
npm start