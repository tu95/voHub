FROM node:24-alpine AS frontend-builder
WORKDIR /src/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.26.5-alpine AS backend-builder
ARG VERSION=v1.0.0
ARG BUILD_TIME=unknown
WORKDIR /src
RUN apk add --no-cache git
ENV GOTOOLCHAIN=local
COPY go.mod go.sum ./
COPY third_party/vowifi-go/go.mod ./third_party/vowifi-go/go.mod
RUN go mod download
COPY . ./
COPY --from=frontend-builder /src/web/dist ./internal/web/dist
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -buildvcs=false \
    -tags "with_utls nomsgpack" \
    -ldflags "-s -w -X 'github.com/tu95/vohub/internal/global.Version=${VERSION}' -X 'github.com/tu95/vohub/internal/global.BuildTime=${BUILD_TIME}'" \
    -o /out/vohub ./cmd/vohub

FROM alpine:3.23
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata && mkdir -p config data logs
COPY --from=backend-builder /out/vohub ./vohub
EXPOSE 8000
ENV CONFIG_PATH=/app/config/config.yaml
ENTRYPOINT ["./vohub"]
CMD ["-c", "/app/config/config.yaml"]
