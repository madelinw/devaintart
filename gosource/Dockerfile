FROM golang:1.23-alpine AS build
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /bin/devaintart ./cmd/server

FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache resvg
COPY --from=build /bin/devaintart /app/devaintart
COPY static /app/static
ENV PORT=3000
EXPOSE 3000
CMD ["/app/devaintart"]
