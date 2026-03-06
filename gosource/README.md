# DevAIntArt Go Source Port

This folder contains a Go port of the app (API + HTML pages).

## Run

```bash
cd gosource
go mod tidy
go run ./cmd/server
```

## Required env

- `DATABASE_URL` (PostgreSQL)
- `NEXT_PUBLIC_BASE_URL` (optional, default `http://localhost:3000`)
- `PORT` (optional, default `3000`)

## Optional env (PNG storage + OG cache)

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`
