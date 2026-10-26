import { describe, expect, test } from 'bun:test'
import type { Filing } from './normalize'
import { formKey, queryFilings, type FilingsQuery } from './query'

function filing(filingDate: string, form: string, accessionNumber: string): Filing {
    return { accessionNumber, form, filingDate, acceptanceDateTime: `${filingDate}T16:00:00.000Z`, documentUrl: '' }
}

// queryFilings expects filings already sorted newest first (getRecent does that).
const filings: Filing[] = [
    filing('2026-04-30', '8-K', '0000000000-26-000006'),
    filing('2026-03-15', 'DEF 14A', '0000000000-26-000005'),
    filing('2026-02-20', '10-K/A', '0000000000-26-000004'),
    filing('2026-02-10', '10-K', '0000000000-26-000003'),
    filing('2026-01-28', '424B2', '0000000000-26-000002'),
    filing('2026-01-05', '8-K', '0000000000-26-000001'),
]

const defaults: FilingsQuery = { sort: 'desc', page: 1, pageSize: 25 }

function datesOf(result: ReturnType<typeof queryFilings>) {
    return result.filings.map((f) => f.filingDate)
}

describe('formKey', () => {
    test('ignores case, hyphens and spaces', () => {
        expect(formKey('10-K')).toBe('10K')
        expect(formKey('10k')).toBe('10K')
        expect(formKey(' 10 - k ')).toBe('10K')
        expect(formKey('DEF 14A')).toBe('DEF14A')
        expect(formKey('def14a')).toBe('DEF14A')
        expect(formKey('424B2')).toBe('424B2')
    })

    test('keeps the slash, so amendments stay distinct', () => {
        expect(formKey('10-K/A')).toBe('10K/A')
        expect(formKey('10-K/A')).not.toBe(formKey('10-K'))
    })

    test('a late-filing notice is not the form itself', () => {
        expect(formKey('NT 10-K')).toBe('NT10K')
        expect(formKey('NT 10-K')).not.toBe(formKey('10-K'))
    })
})

describe('queryFilings: filter', () => {
    test('no form returns every filing', () => {
        expect(queryFilings(filings, defaults).pagination.total).toBe(6)
    })

    test('an empty form string returns every filing', () => {
        expect(queryFilings(filings, { ...defaults, form: '' }).pagination.total).toBe(6)
    })

    test.each(['10-K', '10k', '10K', ' 10-k '])('"%s" matches the 10-K, not the 10-K/A', (form) => {
        expect(datesOf(queryFilings(filings, { ...defaults, form }))).toEqual(['2026-02-10'])
    })

    test('amendments can be asked for directly', () => {
        expect(datesOf(queryFilings(filings, { ...defaults, form: '10-K/A' }))).toEqual(['2026-02-20'])
    })

    test('forms without hyphens or with spaces still match', () => {
        expect(datesOf(queryFilings(filings, { ...defaults, form: '424b2' }))).toEqual(['2026-01-28'])
        expect(datesOf(queryFilings(filings, { ...defaults, form: 'def14a' }))).toEqual(['2026-03-15'])
        expect(datesOf(queryFilings(filings, { ...defaults, form: 'DEF 14A' }))).toEqual(['2026-03-15'])
    })

    test('an unknown form returns no filings and zero pages', () => {
        const result = queryFilings(filings, { ...defaults, form: 'S-1' })
        expect(result.filings).toEqual([])
        expect(result.pagination).toEqual({ page: 1, pageSize: 25, total: 0, totalPages: 0 })
    })
})

describe('queryFilings: sort', () => {
    test('desc keeps the newest-first input order', () => {
        expect(datesOf(queryFilings(filings, defaults))).toEqual([
            '2026-04-30',
            '2026-03-15',
            '2026-02-20',
            '2026-02-10',
            '2026-01-28',
            '2026-01-05',
        ])
    })

    test('asc returns oldest first', () => {
        expect(datesOf(queryFilings(filings, { ...defaults, sort: 'asc' }))).toEqual([
            '2026-01-05',
            '2026-01-28',
            '2026-02-10',
            '2026-02-20',
            '2026-03-15',
            '2026-04-30',
        ])
    })

    test('asc does not mutate the cached input', () => {
        queryFilings(filings, { ...defaults, sort: 'asc' })
        expect(filings[0]!.filingDate).toBe('2026-04-30')
    })

    test('sort applies to the filtered set, before pagination', () => {
        const result = queryFilings(filings, { ...defaults, form: '8-K', sort: 'asc', pageSize: 1 })
        expect(datesOf(result)).toEqual(['2026-01-05'])
        expect(result.pagination.total).toBe(2)
    })
})

describe('queryFilings: pagination', () => {
    test('first page', () => {
        const result = queryFilings(filings, { ...defaults, pageSize: 4 })
        expect(datesOf(result)).toEqual(['2026-04-30', '2026-03-15', '2026-02-20', '2026-02-10'])
        expect(result.pagination).toEqual({ page: 1, pageSize: 4, total: 6, totalPages: 2 })
    })

    test('the last page can be partial', () => {
        expect(datesOf(queryFilings(filings, { ...defaults, page: 2, pageSize: 4 }))).toEqual(['2026-01-28', '2026-01-05'])
    })

    test('a page past the end is empty but keeps the totals', () => {
        const result = queryFilings(filings, { ...defaults, page: 3, pageSize: 4 })
        expect(result.filings).toEqual([])
        expect(result.pagination).toEqual({ page: 3, pageSize: 4, total: 6, totalPages: 2 })
    })

    test('an exact multiple has no empty trailing page', () => {
        expect(queryFilings(filings, { ...defaults, pageSize: 3 }).pagination.totalPages).toBe(2)
    })

    test('total counts the filtered filings, not the page', () => {
        const result = queryFilings(filings, { ...defaults, form: '8-K', pageSize: 1 })
        expect(datesOf(result)).toEqual(['2026-04-30'])
        expect(result.pagination).toMatchObject({ total: 2, totalPages: 2 })
    })
})
