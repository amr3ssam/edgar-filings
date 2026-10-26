import { TimeToLiveCache } from '../cache'
import { HttpError } from '../errors'
import { secFetch } from './secFetch'

const tickersUrl = 'https://www.sec.gov/files/company_tickers.json'
const oneDayMs = 24 * 60 * 60 * 1000

type TickersFile = Record<string, { cik_str: number; ticker: string; title: string }>

export type CompanyRef = { ticker: string; cik: number; name: string }

const tickersCache = new TimeToLiveCache<Map<string, CompanyRef>>(oneDayMs, 1)

export function normalizeTicker(input: string): string {
    return input.trim().toUpperCase().replaceAll('.', '-')
}

async function loadTickers(): Promise<Map<string, CompanyRef>> {
    const file = await secFetch<TickersFile>(tickersUrl)
    const byTicker = new Map<string, CompanyRef>()
    for (const row of Object.values(file)) {
        byTicker.set(normalizeTicker(row.ticker), { ticker: row.ticker, cik: row.cik_str, name: row.title })
    }
    return byTicker
}

export async function resolveTicker(input: string): Promise<CompanyRef> {
    const byTicker = await tickersCache.getOrLoad('all', loadTickers)
    const company = byTicker.get(normalizeTicker(input))
    if (!company) throw new HttpError(404, `Unknown ticker: ${input}`)
    return company
}

export function padCik(cik: number): string {
    return String(cik).padStart(10, '0')
}   