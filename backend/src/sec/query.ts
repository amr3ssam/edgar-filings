import type { Filing } from '../sec/normalize'

export type SortOrder = 'asc' | 'desc'

export type FilingsQuery = {
    form?: string
    sort: SortOrder
    page: number
    pageSize: number
}

export function formKey(form: string): string {
    return form.toUpperCase().replace(/[\s-]/g, '')
}

export function queryFilings(filings: Filing[], query: FilingsQuery) {
    const wanted = query.form ? formKey(query.form) : undefined
    const matching = wanted ? filings.filter((f) => formKey(f.form) === wanted) : filings
    const ordered = query.sort === 'asc' ? matching.toReversed() : matching

    const total = ordered.length
    const start = (query.page - 1) * query.pageSize

    return {
        filings: ordered.slice(start, start + query.pageSize),
        pagination: {
            page: query.page,
            pageSize: query.pageSize,
            total,
            totalPages: Math.ceil(total / query.pageSize),
        },
    }
}
export function oneYearAgo(today: Date): string {
    const date = new Date(today)
    date.setUTCFullYear(date.getUTCFullYear() - 1)
    if (date.getUTCMonth() !== today.getUTCMonth()) date.setUTCDate(0)

    return date.toISOString().slice(0, 10)
}

export function summarizeFilings(filings: Filing[], since: string) {
    const countsByForm: Record<string, number> = {}
    for (const filing of filings) {
        if (filing.filingDate >= since) {
            countsByForm[filing.form] = (countsByForm[filing.form] ?? 0) + 1
        }
    }
    const latest10K = filings.find((f) => f.form === '10-K')?.filingDate ?? null
    return { countsByForm, latest10K }
}