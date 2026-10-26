import { TimeToLiveCache } from '../cache'
import { normalizeFilings, type Filing, type SubmissionsFile } from './normalize'
import { secFetch } from './secFetch'
import { padCik } from './tickers'

const tenMinutesMs = 10 * 60 * 1000

export type OlderPage = SubmissionsFile['filings']['files'][number]
export type FormCount = { form: string; count: number }

export type CompanyFilings = {
    cik: number
    name: string
    filings: Filing[]
    availableForms: FormCount[]
    olderPages: OlderPage[]
}

export function compareNewestFirst(a: Filing, b: Filing): number {
    return (
        b.filingDate.localeCompare(a.filingDate) ||
        b.acceptanceDateTime.localeCompare(a.acceptanceDateTime) ||
        b.accessionNumber.localeCompare(a.accessionNumber)
    )
}

export function countForms(filings: Filing[]): FormCount[] {
    const counts = new Map<string, number>()
    for (const filing of filings) {
        counts.set(filing.form, (counts.get(filing.form) ?? 0) + 1)
    }
    return [...counts].map(([form, count]) => ({ form, count })).sort((a, b) => b.count - a.count)
}

const recentCache = new TimeToLiveCache<CompanyFilings>(tenMinutesMs, 50)

async function loadRecent(cik: number): Promise<CompanyFilings> {
    const file = await secFetch<SubmissionsFile>(`https://data.sec.gov/submissions/CIK${padCik(cik)}.json`)
    const filings = normalizeFilings(file.filings.recent, cik).sort(compareNewestFirst)
    return {
        cik,
        name: file.name,
        filings,
        availableForms: countForms(filings),
        olderPages: file.filings.files,
    }
}

export function getRecent(cik: number): Promise<CompanyFilings> {
    return recentCache.getOrLoad(String(cik), () => loadRecent(cik))
}