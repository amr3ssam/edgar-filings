export type Filing = {
    accessionNumber: string
    form: string
    filingDate: string
    acceptanceDateTime: string
    documentUrl: string
}

export type FormCount = { form: string; count: number }

export type FilingsResponse = {
    company: { ticker: string; cik: number; name: string }
    availableForms: FormCount[]
    filings: Filing[]
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export type CompanySummary =
    | { ticker: string; name: string; countsByForm: Record<string, number>; latest10K: string | null }
    | { ticker: string; error: string }

export type SummaryResponse = { since: string; companies: CompanySummary[] }

export type FilingsParams = {
    ticker: string
    form?: string
    sort: 'asc' | 'desc'
    page: number
    pageSize: number
}

export function normalizeTicker(input: string): string {
    return input.trim().toUpperCase().replaceAll('.', '-')
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    const res = await fetch(`/api${path}`, { signal })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? `Request failed with ${res.status}`)
    return body as T
}

export function fetchFilings(params: FilingsParams, signal?: AbortSignal) {
    const query = new URLSearchParams({
        sort: params.sort,
        page: String(params.page),
        pageSize: String(params.pageSize),
    })
    if (params.form) query.set('form', params.form)
    return getJson<FilingsResponse>(`/companies/${encodeURIComponent(params.ticker)}/filings?${query}`, signal)
}

export function fetchSummary(tickers: string[], signal?: AbortSignal) {
    const query = new URLSearchParams({ tickers: tickers.join(',') })
    return getJson<SummaryResponse>(`/filings/summary?${query}`, signal)
}