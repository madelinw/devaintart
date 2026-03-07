# Parity Target

Goal: Go app output and behavior must match legacy Next app exactly for:
- HTML routes
- CSS rendering
- API payloads
- Database query semantics

## Process

1. Run `scripts/parity_check.sh` against production vs staging.
2. Fix highest-impact diffs first:
- HTML structure and route-level markup
- CSS loading and class coverage
- API fields/order/shape
- Query order/filtering and counters
3. Re-run parity check and repeat until no diffs.

## Current Rule

No runtime proxy fallback to Next.
All behavior must be implemented in Go.
