# syntax=docker/dockerfile:1

# ---- build stage -----------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# Install dependencies first so this layer is cached while sources change.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---- runtime stage ---------------------------------------------------------
FROM nginx:1.29-alpine AS runtime

# nginx entrypoint runs envsubst on /etc/nginx/templates/*.template,
# so ${BACKEND_URL} is resolved at container start.
ENV BACKEND_URL=http://backend:8080

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/admin-panel/browser /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
