FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=/
ARG VITE_WS_URL=/

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY hi-lo-client/package*.json ./
RUN npm ci

COPY hi-lo-client/index.html ./
COPY hi-lo-client/vite.config.ts ./
COPY hi-lo-client/tsconfig.json ./
COPY hi-lo-client/tsconfig.node.json ./
COPY hi-lo-client/src ./src
COPY hi-lo-client/assets ./assets

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY hi-lo-client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

