FROM golang:1.23-alpine AS build
WORKDIR /app

# Copy Go module metadata first for better layer caching.
COPY gosource/go.mod ./go.mod
COPY gosource/go.sum ./go.sum
RUN go mod download

# Copy the Go source and build.
COPY gosource .
RUN CGO_ENABLED=0 go build -o /bin/devaintart ./cmd/server

FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache \
  chromium \
  fontconfig \
  ttf-dejavu \
  font-noto \
  font-noto-cjk \
  font-noto-emoji
COPY --from=build /bin/devaintart /app/devaintart
COPY gosource/static /app/static
ENV PORT=3000
EXPOSE 3000
CMD ["/app/devaintart"]
