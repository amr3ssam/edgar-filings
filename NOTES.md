# NOTES

How to run it is in [README.md](README.md). This file covers the decisions behind the code and what's left out.

## Stack

- Backend: Bun + Express 5 on port 3333. Express 5 sends errors thrown in async handlers to the error middleware.
- Frontend: Vite + React + MUI. Vite proxies `/api` to the backend in dev, so there's no CORS setup.

## Scope decision

The backend uses only **SEC's `recent` block** (`filings.recent` in the submissions JSON). SEC guarantees it covers at least the last year (JPM: ~26k filings for one year; Spotify: its whole history since 2015). That's enough for the 12-month summary and for browsing recent filings, and it avoids fetching older pages (JPM has 71 of them, ~9s at SEC's rate limit). See "Known limitations" for what this costs.

## Talking to SEC

- Every request sends a declared `User-Agent` (from env). SEC returns 403 without one.
- All SEC traffic goes through one `secFetch` with a **rate limiter** (min 125ms gap, ~8 req/s, under SEC's 10 req/s per requester). It sits in the client, not in individual routes, because the limit applies to the whole server.
- On 429: one retry after a back-off, then 502.

## Caching

- In-memory TTL cache that stores **promises**, so concurrent requests share one in-flight fetch.
- A rejected promise is removed, but only if the entry still holds that same promise (so a late failure can't evict a newer entry).
- LRU eviction with a max entry count, so memory stays bounded.
- Cached values are **normalised filings**, not raw SEC JSON, keyed by **CIK** (GOOG and GOOGL share one entry).
- Ticker list: 24h TTL. Company filings: 10 min TTL, max 50 companies.

## Ticker → CIK

- `company_tickers.json` loaded once into a `Map`.
- Input and SEC tickers are normalised the same way: trim, uppercase, `.` → `-` (`BRK.B` → `BRK-B`).
- Only current tickers resolve (`FB` → 404; Meta is `META`).
- CIK is zero-padded to 10 digits for the submissions URL and unpadded in Archives URLs.

## Normalising filings

- Columnar `filings.recent` is zipped by index into `Filing` objects, then sorted newest first.
- Document URL: `https://www.sec.gov/Archives/edgar/data/{cik}/{accessionNoDashes}/{primaryDocument}`.
  - Empty `primaryDocument` or a paper filing (`.paper`) → link to the filing index `{accessionNumber}-index.htm`.
  - `primaryDocument` can contain a subfolder (Form 4: `xslF345X06/form4.xml`); it's kept as is.
- URLs use the company CIK, never the accession prefix (that's often a filing agent).
- Sort key: `filingDate`, then `acceptanceDateTime`, then `accessionNumber`. The accession number is unique, so the order is total and pages are stable.

## Form types

- Matching key: `form.toUpperCase().replace(/[\s-]/g, "")`, applied to both input and data. `10k`, `10K` and `10-K` all match; `424B2` and `DEF 14A` keep working.
- `/` is kept, so `10-K/A` ≠ `10-K`. `NT 10-K` (`NT10K`) never matches `10-K`.
- The original SEC form string is displayed; the key is only for matching.

## `GET /companies/:ticker/filings`

- Query: `form` (one form), `sort=desc|asc`, `page`, `pageSize` (1–100, default 25).
- Order: filter → sort → paginate, all on the server.
- The cached list is already newest first, so `sort=asc` is `toReversed()`: a reversed copy, not a re-sort, and the cached array is never mutated.
- `availableForms` (with counts) is computed **before** the filter, so the dropdown doesn't shrink after you pick a form.
- Invalid `sort`/`page`/`pageSize` fall back to defaults instead of returning 400.
- Unknown ticker → 404. SEC failure → 502.

## `GET /filings/summary?tickers=AAPL,SPOT,JPM`

- Tickers are normalised and de-duplicated. One row per ticker; GOOG and GOOGL are two rows from one cached fetch.
- Partial failure: a bad ticker gives `{ ticker, error }` and the rest still succeed.
- `countsByForm`: filings per form with `filingDate >= today − 1 year` (UTC, inclusive, computed once per request; a leap day maps to Feb 28).
- `latest10K`: the newest filing with form exactly `10-K` in `recent`, or `null`.
  - Foreign filers (Spotify: 20-F, RY: 40-F) correctly get `null`; they don't file 10-Ks.

## Frontend

One page: summary on top, filings below. Standard MUI components, default theme.

- **Summary:** company tickers as chips (type a ticker, press Enter). Table with one row per company: the 5 most common form types as columns (ranked by how many of the selected companies file them, then by total), Other, Total, Latest 10-K. "None" has a tooltip explaining foreign filers. Error rows for unknown tickers. Clicking a row loads that company's filings below.
- **Filings:** ticker text field (Enter to load), form-type select filled from `availableForms`, sort by filing date, pagination (10/25/50/100 per page). Each filing links to its document on sec.gov.
- Filtering, sorting and pagination are done by the API; the UI only sends parameters.
- The filings section is rendered with `key={ticker}`, so switching company remounts it and resets the form filter, sort and page instead of carrying them over (e.g. page 7 of JPM onto a company with 2 pages).
- Requests are cancelled with `AbortController` when the inputs change, so a slow old response can't overwrite a newer one.
- Loading, empty and error states.
- No ticker suggestions: the backend has no search endpoint.

## Testing

`bun test` in `backend/`: 74 unit tests, no network.
- cache: in-flight sharing, TTL, failure removal, LRU eviction.
- tickers: normalisation, CIK lookup, share classes, 404.
- normalize: real SEC rows (Spotify recent, Apple's oldest page) incl. empty and paper documents.
- companies: sort order, form counts, `getRecent` caching.
- query / summary: filter, sort, pagination, 12-month window, leap day, latest 10-K.

Manual checks:

| Input | Expect |
|---|---|
| `aapl` | Resolves to AAPL (CIK 320193) |
| `SPOT` | latest10K `null` (files 20-F) |
| `JPM` | 10-K present; large 424B2 count |
| `BRK.B` | Normalised to BRK-B (CIK 1067983) |
| `GOOG` + `GOOGL` | Same CIK, one SEC fetch, two rows |
| `RY` | latest10K `null` (files 40-F) |
| `META` / `FB` | META works; FB → 404 |
| `XXXX` | 404 on filings; error row in summary |

## Known limitations

- **Only `recent` filings.** The filings list covers SEC's `recent` block, not the full history. For most companies that's years of filings; for very active filers (JPM, RY) it's about one year.
- **Latest 10-K is searched in `recent` only.** A company whose last 10-K is older than its `recent` block (e.g. a late filer) gets `null`.
- **Cache is in memory.** It's lost on restart, and each server instance has its own.
- **UI state isn't in the URL**, so a filtered view can't be bookmarked or shared.

## Next steps

Planned as extensions once the required features are done, in priority order:

1. **Filter by several forms** (`form=10-K,10-Q`) and an `includeAmendments` flag.
2. **Validation:** return 400 for bad params instead of silently using defaults; cap the summary at ~20 tickers.
3. **Keep UI state in the URL** (ticker, form, sort, page).
4. **Richer filing objects:** `reportDate`, `primaryDocDescription`, and the filing-index URL alongside the document URL.

## Status

_TODO: fill in at the end (time spent, what was finished)._
