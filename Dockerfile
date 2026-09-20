# Frontend build stage
FROM node:22-alpine AS web-builder
# If your frontend lives in ./frontend instead of ./web
WORKDIR /frontEnd/
ARG FRONTEND_DIR=frontEnd/
COPY ${FRONTEND_DIR}/package.json ${FRONTEND_DIR}/package-lock.json* ${FRONTEND_DIR}/pnpm-lock.yaml* ${FRONTEND_DIR}/yarn.lock* ./
# Pick one manager; defaulting to npm
RUN npm ci

# Copy frontend source and build
COPY ${FRONTEND_DIR}/ ./
# Ensure production build
ARG VITE_API_BASE_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm ci && npm run build

# Go build stage
FROM golang:1.24-alpine AS go-builder
WORKDIR /app
RUN apk add --no-cache build-base git

# Go deps cache
COPY go.mod go.sum ./
RUN go mod download

# Copy full source (excluding what .dockerignore filters out)
COPY . ./

# Bring built frontend into expected path for release serving
# Your server serves ./web/dist in release mode
COPY --from=web-builder /frontEnd/dist /app/web/dist

# Build static binary
ENV CGO_ENABLED=0 GOOS=linux
RUN go build -ldflags="-s -w" -o /app/app ./cmd

# Runtime stage (minimal)
FROM alpine:3.20
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app \
  && apk add --no-cache ca-certificates tzdata curl \
  && curl -L https://github.com/golang-migrate/migrate/releases/download/v4.16.2/migrate.linux-amd64.tar.gz | tar xvz \
  && mv migrate /usr/local/bin/migrate \
  && chmod +x /usr/local/bin/migrate

# Copy binary and static assets
COPY --from=go-builder /app/app /app/app
COPY --from=go-builder /app/web/dist /app/web/dist
COPY --from=go-builder /app/static /app/static
COPY --from=go-builder /app/migrations /app/migrations

# Ports
EXPOSE 443

# Sensible defaults for production
# Adjust env names to match your config loader
ENV GIN_MODE=release \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=443

USER app
ENTRYPOINT ["/app/app"]