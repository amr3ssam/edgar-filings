import { describe, expect, test } from 'bun:test'
import type { Filing } from './normalize'
import { oneYearAgo, summarizeFilings } from './query'

function filing(filingDate: string, form: string): Filing {
    return { accessionNumber: '', form, filingDate, acceptanceDateTime: '', documentUrl: '' }
}

// Summary as of 2026-10-24, so the window starts on 2025-10-24 (inclusive).
const since = '2025-10-24'

// Newest first, as getRecent returns them.
const domesticFiler: Filing[] = [
    filing('2026-10-20', '8-K'),
    filing('2026-07-31', '10-Q'),
    filing('2026-02-10', '10-K'),
    filing('2025-10-24', '8-K'), // first day of the window: counted
    filing('2025-10-23', '4'), // one day too old: not counted
    filing('2025-02-07', '10-K'), // older 10-K
]

describe('oneYearAgo', () => {
    test('returns the same day one year earlier, as YYYY-MM-DD', () => {
        expect(oneYearAgo(new Date('2026-10-24T12:00:00Z'))).toBe('2025-10-24')
    })

    test('uses the UTC date, not the local one', () => {
        expect(oneYearAgo(new Date('2026-10-24T00:30:00Z'))).toBe('2025-10-24')
        expect(oneYearAgo(new Date('2026-10-24T23:30:00Z'))).toBe('2025-10-24')
    })

    test('crosses a year boundary', () => {
        expect(oneYearAgo(new Date('2026-01-01T00:00:00Z'))).toBe('2025-01-01')
    })

    test('does not change the date passed in', () => {
        const today = new Date('2026-10-24T12:00:00Z')
        oneYearAgo(today)
        expect(today.toISOString()).toBe('2026-10-24T12:00:00.000Z')
    })

    test('a leap day maps to Feb 28, not Mar 1', () => {
        expect(oneYearAgo(new Date('2028-02-29T12:00:00Z'))).toBe('2027-02-28')
    })
})

describe('summarizeFilings', () => {
    test('counts each form filed inside the window', () => {
        expect(summarizeFilings(domesticFiler, since).countsByForm).toEqual({ '8-K': 2, '10-Q': 1, '10-K': 1 })
    })

    test('the first day of the window counts, the day before does not', () => {
        const { countsByForm } = summarizeFilings(domesticFiler, since)
        expect(countsByForm['8-K']).toBe(2)
        expect(countsByForm['4']).toBeUndefined()
    })

    test('latest 10-K is the newest one', () => {
        expect(summarizeFilings(domesticFiler, since).latest10K).toBe('2026-02-10')
    })

    test('latest 10-K is found even when it is older than the window', () => {
        const filings = [filing('2026-09-01', '8-K'), filing('2025-03-01', '10-K')]
        const summary = summarizeFilings(filings, since)
        expect(summary.countsByForm).toEqual({ '8-K': 1 })
        expect(summary.latest10K).toBe('2025-03-01')
    })

    test('amendments and late-filing notices are not the latest 10-K', () => {
        const filings = [
            filing('2026-04-01', '10-K/A'),
            filing('2026-03-31', 'NT 10-K'),
            filing('2026-02-10', '10-K'),
        ]
        expect(summarizeFilings(filings, since).latest10K).toBe('2026-02-10')
    })

    test('a foreign filer (20-F, 6-K) has no 10-K', () => {
        const foreignFiler = [filing('2026-10-22', '6-K'), filing('2026-02-10', '20-F')]
        const summary = summarizeFilings(foreignFiler, since)
        expect(summary.countsByForm).toEqual({ '6-K': 1, '20-F': 1 })
        expect(summary.latest10K).toBeNull()
    })

    test('no filings gives empty counts and no 10-K', () => {
        expect(summarizeFilings([], since)).toEqual({ countsByForm: {}, latest10K: null })
    })
})
