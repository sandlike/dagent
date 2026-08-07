ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-alpine
ARG NGINX_IMAGE=docker.m.daocloud.io/library/nginx:1.27-alpine

FROM ${NODE_IMAGE} AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM ${NGINX_IMAGE}

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=101:101 /app/dist /usr/share/nginx/html

EXPOSE 8080

