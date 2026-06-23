FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o bastion-server ./cmd/main.go

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/bastion-server .
EXPOSE 3001
CMD ["./bastion-server"]
