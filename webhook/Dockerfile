FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY main.go .
RUN go build -o webhook main.go

FROM alpine:latest
RUN apk add --no-cache docker-cli docker-cli-compose git bash openssh-client
WORKDIR /app
COPY --from=builder /app/webhook .
CMD ["./webhook"]
