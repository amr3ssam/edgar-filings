import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { HttpError } from '../errors'

// Trimmed copy of company_tickers.json. "NONE." is a real row in the SEC file (EBR Systems).
const tickersFile = {
    '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
    '1': { cik_str: 1067983, ticker: 'BRK-B', title: 'BERKSHIRE HATHAWAY INC' },
    '2': { cik_str: 1652044, ticker: 'GOOGL', title: 'Alphabet Inc.' },
    '3': { cik_str: 1652044, ticker: 'GOOG', title: 'Alphabet Inc.' },
    '4': { cik_str: 1000275, ticker: 'RY', title: 'ROYAL BANK OF CANADA' },
    '5': { cik_str: 1347123, ticker: 'NONE.', title: 'EBR Systems, Inc.' },
}

const secFetch = mock(async (_url: string): Promise<unknown> => tickersFile)
mock.module('./secFetch', () => ({ secFetch }))

// Imported after mock.module so tickers.ts picks up the mocked secFetch (and never loads config).
const { normalizeTicker, padCik, resolveTicker } = await import('./tickers')

beforeEach(() => {
    secFetch.mockClear()
})

describe('normalizeTicker', () => {
    test('trims, uppercases and turns dots into hyphens', () => {
        expect(normalizeTicker('aapl')).toBe('AAPL')
        expect(normalizeTicker('  msft ')).toBe('MSFT')
        expect(normalizeTicker('brk.b')).toBe('BRK-B')
        expect(normalizeTicker('BRK-B')).toBe('BRK-B')
    })
})

describe('padCik', () => {
    test('zero-pads to 10 digits', () => {
        expect(padCik(320193)).toBe('0000320193')
        expect(padCik(19617)).toBe('0000019617')
        expect(padCik(1234567890)).toBe('1234567890')
    })
})

// resolveTicker shares one module-level cache across these tests, so order matters:
// the failure test runs first, while nothing is cached yet.
describe('resolveTicker', () => {
    test('a failed load is not cached, so the next call retries', async () => {
        secFetch.mockImplementationOnce(async () => {
            throw new HttpError(502, 'Could not reach SEC')
        })

        await expect(resolveTicker('AAPL')).rejects.toMatchObject({ status: 502 })
        expect(await resolveTicker('AAPL')).toEqual({ ticker: 'AAPL', cik: 320193, name: 'Apple Inc.' })
        expect(secFetch).toHaveBeenCalledTimes(2)
        expect(secFetch).toHaveBeenLastCalledWith('https://www.sec.gov/files/company_tickers.json')
    })

    test('loads the ticker file once for many lookups', async () => {
        await Promise.all([resolveTicker('AAPL'), resolveTicker('RY'), resolveTicker('GOOG')])
        expect(secFetch).not.toHaveBeenCalled()
    })

    test('resolves lowercase and dotted input', async () => {
        expect(await resolveTicker('aapl')).toMatchObject({ ticker: 'AAPL', cik: 320193 })
        expect(await resolveTicker('brk.b')).toMatchObject({ ticker: 'BRK-B', cik: 1067983 })
        expect(await resolveTicker(' ry ')).toMatchObject({ ticker: 'RY', cik: 1000275 })
    })

    test('share classes resolve to the same CIK', async () => {
        const goog = await resolveTicker('GOOG')
        const googl = await resolveTicker('GOOGL')
        expect(goog.cik).toBe(1652044)
        expect(googl.cik).toBe(goog.cik)
        expect(goog.ticker).toBe('GOOG')
        expect(googl.ticker).toBe('GOOGL')
    })

    test('unknown ticker is a 404 that names the input', async () => {
        const error = await resolveTicker('xxxx').catch((e) => e)
        expect(error).toBeInstanceOf(HttpError)
        expect(error.status).toBe(404)
        expect(error.message).toContain('xxxx')
    })

    test('empty input is not found', async () => {
        await expect(resolveTicker('   ')).rejects.toMatchObject({ status: 404 })
    })

    test('tickers in the SEC file are normalised the same way as input', async () => {
        // Input "NONE." normalises to "NONE-", so the map keys must be normalised too.
        expect(await resolveTicker('NONE.')).toMatchObject({ cik: 1347123 })
    })
})
