# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM quay.prod-openshift-na.hybrid.sunlifecorp.com/asiaekscp/node:22.17.0-alpine3.21 AS build
WORKDIR /app

COPY .npmrc .npmrc
COPY package.json ./
RUN npm install

COPY . .
# Same-origin by default; nginx proxies /api to the API container.
ARG VITE_APP_API_URL=/api/v1
ENV VITE_APP_API_URL=${VITE_APP_API_URL}
RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:1.29-alpine AS runtime

# Where nginx forwards /api requests. Override at run time, e.g. http://api:8000 on a
# compose network.
ENV API_UPSTREAM=http://host.docker.internal:8000

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
