# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM quay.prod-openshift-na.hybrid.sunlifecorp.com/asiaekscp/node:22.17.0-alpine3.21 AS build
WORKDIR /app

COPY .npmrc .npmrc
COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:1.29-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
