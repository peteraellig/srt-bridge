FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /src
COPY srt_bridge/go.mod srt_bridge/go.sum ./
RUN go mod download

COPY srt_bridge/ .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/srt-bridge .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

COPY --from=builder /bin/srt-bridge /app/srt-bridge

EXPOSE 21101/udp 21101/tcp 9990/tcp

VOLUME ["/data"]

ENTRYPOINT ["/app/srt-bridge", "-headless", "-config", "/data/config.json", "-log", "-"]
