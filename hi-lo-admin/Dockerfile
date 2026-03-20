FROM node:20-alpine AS builder

WORKDIR /app

COPY hi-lo-admin/package*.json ./
RUN npm ci

COPY hi-lo-admin/ ./
COPY hi-lo-server/prisma/schema.prisma ./prisma/schema.prisma

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/admin-page.html ./admin-page.html
COPY --from=builder /app/package*.json ./

EXPOSE 4002

CMD ["node", "dist/main.js"]

