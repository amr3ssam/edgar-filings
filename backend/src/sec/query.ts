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