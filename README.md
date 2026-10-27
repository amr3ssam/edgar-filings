# EDGAR Filings

A small API and React UI on top of the SEC's EDGAR submissions API. Look up any SEC filer by ticker, browse its filings (filter by form type, sort by date, paginate) and compare companies' filing activity over the last 12 months.

- `backend/`: Bun + Express 5 API
- `frontend/`: Vite + React + MUI

Design decisions, edge cases and limitations are in [NOTES.md](NOTES.md).

## Requirements

- [Bun](https://bun.sh) 1.x (used for both backend and frontend)

## Run it

**1. Backend** (port 3333)

```sh
cd backend
bun install
cp .env.example .env    # then put your name and email in SEC_USER_AGENT
bun run dev
```

SEC rejects requests without a `User-Agent` that identifies you, so `SEC_USER_AGENT` is required, e.g. `SEC_USER_AGENT="EdgarFilings Jane Doe jane@example.com"`.

**2. Frontend** (in a second terminal)

```sh
cd frontend
bun install
bun run dev
```

Open http://localhost:5173. Vite proxies `/api/*` to the backend on port 3333.

## API

### `GET /companies/:ticker/filings`

| Param | Default | Notes |
|---|---|---|
| `form` | all | One form type. Case, hyphens and spaces are ignored: `10k` matches `10-K`. |
| `sort` | `desc` | `asc` or `desc` by filing date |
| `page` | `1` | |
| `pageSize` | `25` | 1–100 |

```sh
curl "http://localhost:3333/companies/AAPL/filings?form=10-K&pageSize=5"
```

```json
{
  "company": { "ticker": "AAPL", "cik": 320193, "name": "Apple Inc." },
  "availableForms": [{ "form": "4", "count": 601 }, { "form": "8-K", "count": 101 }, "…"],
  "filings": [
    {
      "accessionNumber": "0000320193-25-000079",
      "form": "10-K",
      "filingDate": "2025-10-31",
      "acceptanceDateTime": "2025-10-31T10:01:26.000Z",
      "documentUrl": "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm"
    }
  ],
  "pagination": { "page": 1, "pageSize": 5, "total": 1, "totalPages": 1 }
}
```

Unknown ticker → `404 { "error": "Unknown ticker: XXXX" }`.

### `GET /filings/summary?tickers=AAPL,SPOT,JPM`

Filings per form type over the last 12 months, and the date of the latest 10-K, for each company.

```sh
curl "http://localhost:3333/filings/summary?tickers=AAPL,SPOT,XXXX"
```

```json
{
  "since": "2025-10-26",
  "companies": [
    { "ticker": "AAPL", "name": "Apple Inc.", "countsByForm": { "4": 52, "144": 12, "8-K": 8, "10-Q": 3, "10-K": 1, "…": "…" }, "latest10K": "2025-10-31" },
    { "ticker": "SPOT", "name": "Spotify Technology S.A.", "countsByForm": { "4": 56, "3": 16, "6-K": 16, "144": 11, "S-8": 2, "20-F": 1 }, "latest10K": null },
    { "ticker": "XXXX", "error": "Unknown ticker: XXXX" }
  ]
}
```

A bad ticker returns an error row; the other companies still succeed. Spotify has no 10-K because foreign companies file a 20-F instead.

Example values are from 26 Oct 2026 and shortened where marked with "…"; counts change as companies file.

## Tests

```sh
cd backend
bun test
```

74 unit tests, no network calls: cache, ticker lookup, normalising SEC's columnar data (with real SEC rows as fixtures), filtering, sorting, pagination and the summary.

## Tickers to try

`AAPL`, `SPOT`, `JPM`, `brk.b` (becomes `BRK-B`), `GOOG` and `GOOGL` (same company), `RY` (Canadian, no 10-K), `XXXX` (unknown).

## AI usage

Planning, reviews and tests were done with Claude Code. The prompt log is in _TODO: add path_.
