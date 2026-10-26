import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { HttpError } from '../errors'
import type { Filing, FilingColumns, SubmissionsFile } from './normalize'
import aaplOlderPageJson from './fixtures/aapl-submissions-001.json'
import spotSubmissionsJson from './fixtures/spot-submissions.json'

const spotSubmissions = spotSubmissionsJson as SubmissionsFile

// Apple's older-page rows are out of date order (2014, 2000, 2015), which makes them
// a good "recent" block for checking that getRecent sorts.
const aaplSubmissions: SubmissionsFile = {
    cik: '0000320193',
    name: 'Apple Inc.',
    filings: {
        recent: aaplOlderPageJson as FilingColumns,
        files: [{ name: 'CIK0000320193-submissions-001.json', filingCount: 1268, filingFrom: '1994-01-26', filingTo: '2015-10-01' }],
    },
}

const secFetch = mock(async (_url: string): Promise<unknown> => aaplSubmissions)
mock.module('./secFetch', () => ({ secFetch }))

// Imported after mock.module so companies.ts picks up the mocked secFetch (and never loads config).
const { compareNewestFirst, countForms, getRecent } = await import('./companies')

beforeEach(() => {
    secFetch.mockReset()
    secFetch.mockImplementation(async () => aaplSubmissions)
})

function filing(overrides: Partial<Filing>): Filing {
    return {
        accessionNumber: '0000000000-26-000001',
        form: '8-K',
        filingDate: '2026-01-01',
        acceptanceDateTime: '2026-01-01T12:00:00.000Z',
        documentUrl: '',
        ...overrides,
    }
}

describe('compareNewestFirst', () => {
    test('orders by filing date, newest first', () => {
        const older = filing({ filingDate: '2025-12-31' })
        const newer = filing({ filingDate: '2026-01-01' })
        expect([older, newer].sort(compareNewestFirst)).toEqual([newer, older])
    })

    test('breaks a same-day tie on acceptance time', () => {
        const morning = filing({ acceptanceDateTime: '2026-01-01T09:00:00.000Z' })
        const evening = filing({ acceptanceDateTime: '2026-01-01T20:00:00.000Z' })
        expect([morning, evening].sort(compareNewestFirst)).toEqual([evening, morning])
    })

    test('breaks a full tie on accession number, so the order is total', () => {
        const a = filing({ accessionNumber: '0000000000-26-000001' })
        const b = filing({ accessionNumber: '0000000000-26-000002' })
        expect([a, b].sort(compareNewestFirst)).toEqual([b, a])
        expect([b, a].sort(compareNewestFirst)).toEqual([b, a])
    })

    test('the date wins over acceptance time', () => {
        // Accepted after 17:30 ET, so filed the next business day: acceptance is earlier
        // than a later-dated filing's, but filingDate still decides.
        const friday = filing({ filingDate: '2026-01-02', acceptanceDateTime: '2026-01-02T23:00:00.000Z' })
        const monday = filing({ filingDate: '2026-01-05', acceptanceDateTime: '2026-01-02T22:00:00.000Z' })
        expect([friday, monday].sort(compareNewestFirst)).toEqual([monday, friday])
    })
})

describe('countForms', () => {
    test('counts each form, most common first', () => {
        const filings = [
            filing({ form: '4' }),
            filing({ form: '8-K' }),
            filing({ form: '4' }),
            filing({ form: '10-K' }),
            filing({ form: '4' }),
            filing({ form: '8-K' }),
        ]
        expect(countForms(filings)).toEqual([
            { form: '4', count: 3 },
            { form: '8-K', count: 2 },
            { form: '10-K', count: 1 },
        ])
    })

    test('keeps amendments and look-alikes as separate forms', () => {
        const forms = countForms([filing({ form: '10-K' }), filing({ form: '10-K/A' }), filing({ form: 'NT 10-K' })])
        expect(forms.map((f) => f.form).sort()).toEqual(['10-K', '10-K/A', 'NT 10-K'])
    })

    test('returns an empty list for no filings', () => {
        expect(countForms([])).toEqual([])
    })
})

// getRecent has a module-level cache keyed by CIK, so each test uses its own CIK.
describe('getRecent', () => {
    test('fetches the submissions file with a zero-padded CIK', async () => {
        await getRecent(320193)
        expect(secFetch).toHaveBeenCalledTimes(1)
        expect(secFetch).toHaveBeenCalledWith('https://data.sec.gov/submissions/CIK0000320193.json')
    })

    test('returns normalised filings, newest first, with form counts and older pages', async () => {
        const company = await getRecent(1)

        expect(company.cik).toBe(1)
        expect(company.name).toBe('Apple Inc.')
        expect(company.filings.map((f) => [f.filingDate, f.form])).toEqual([
            ['2015-09-18', 'CERTNYS'],
            ['2014-10-27', '10-K'],
            ['2000-05-15', 'S-8'],
        ])
        expect(company.availableForms).toHaveLength(3)
        expect(company.availableForms.every((f) => f.count === 1)).toBe(true)
        expect(company.olderPages).toEqual(aaplSubmissions.filings.files)
    })

    test('builds document URLs from the CIK it was given, unpadded', async () => {
        secFetch.mockImplementation(async () => spotSubmissions)
        const company = await getRecent(1639920)
        for (const f of company.filings) {
            expect(f.documentUrl).toStartWith('https://www.sec.gov/Archives/edgar/data/1639920/')
        }
    })

    test('caches per CIK', async () => {
        await getRecent(2)
        await getRecent(2)
        expect(secFetch).toHaveBeenCalledTimes(1)

        await getRecent(3)
        expect(secFetch).toHaveBeenCalledTimes(2)
    })

    test('concurrent calls for one CIK share a single fetch', async () => {
        const [a, b] = await Promise.all([getRecent(4), getRecent(4)])
        expect(a).toBe(b)
        expect(secFetch).toHaveBeenCalledTimes(1)
    })

    test('a failed fetch is not cached', async () => {
        secFetch.mockImplementationOnce(async () => {
            throw new HttpError(502, 'Could not reach SEC')
        })

        await expect(getRecent(5)).rejects.toMatchObject({ status: 502 })
        expect((await getRecent(5)).name).toBe('Apple Inc.')
        expect(secFetch).toHaveBeenCalledTimes(2)
    })
})
