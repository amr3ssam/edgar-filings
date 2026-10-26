import { describe, expect, test } from 'bun:test'
import { buildDocumentUrl, normalizeFilings, type FilingColumns, type SubmissionsFile } from './normalize'
import aaplOlderPageJson from './fixtures/aapl-submissions-001.json'
import spotSubmissionsJson from './fixtures/spot-submissions.json'

// Fixtures are real SEC rows, trimmed to a few filings with every column kept:
// - spot-submissions.json: data.sec.gov/submissions/CIK0001639920.json (recent: 6-K, Form 4, 20-F)
// - aapl-submissions-001.json: Apple's oldest older page, which is the bare columnar object
//   (a normal 10-K, an S-8 with no primaryDocument, a paper filing)
const spotSubmissions = spotSubmissionsJson as SubmissionsFile
const aaplOlderPage = aaplOlderPageJson as FilingColumns

const archives = 'https://www.sec.gov/Archives/edgar/data'

describe('buildDocumentUrl', () => {
    test('links to the primary document in the accession folder', () => {
        expect(buildDocumentUrl(1639920, '0001628280-26-066889', 'spot-20260930x6xk.htm')).toBe(
            `${archives}/1639920/000162828026066889/spot-20260930x6xk.htm`,
        )
    })

    test('keeps subfolders in primaryDocument (XSL-rendered Form 4)', () => {
        expect(buildDocumentUrl(1639920, '0001140361-26-039594', 'xslF345X06/form4.xml')).toBe(
            `${archives}/1639920/000114036126039594/xslF345X06/form4.xml`,
        )
    })

    test('falls back to the filing index when primaryDocument is empty', () => {
        expect(buildDocumentUrl(320193, '0000912057-00-024086', '')).toBe(
            `${archives}/320193/000091205700024086/0000912057-00-024086-index.htm`,
        )
    })

    test('falls back to the filing index for paper filings', () => {
        expect(buildDocumentUrl(320193, '9999999997-15-013472', '9999999997-15-013472.paper')).toBe(
            `${archives}/320193/999999999715013472/9999999997-15-013472-index.htm`,
        )
    })

    test('uses the company CIK, not the filing agent prefix of the accession number', () => {
        const url = buildDocumentUrl(1639920, '0001628280-26-066889', 'spot-20260930x6xk.htm')
        expect(url).toStartWith(`${archives}/1639920/`)
        expect(url).not.toContain('/1628280/')
    })
})

describe('normalizeFilings', () => {
    test('turns the recent columns into one object per filing, in order', () => {
        const cik = Number(spotSubmissions.cik)
        expect(normalizeFilings(spotSubmissions.filings.recent, cik)).toEqual([
            {
                accessionNumber: '0001628280-26-066889',
                form: '6-K',
                filingDate: '2026-10-22',
                acceptanceDateTime: '2026-10-22T20:09:19.000Z',
                documentUrl: `${archives}/1639920/000162828026066889/spot-20260930x6xk.htm`,
            },
            {
                accessionNumber: '0001140361-26-039594',
                form: '4',
                filingDate: '2026-10-14',
                acceptanceDateTime: '2026-10-14T20:15:11.000Z',
                documentUrl: `${archives}/1639920/000114036126039594/xslF345X06/form4.xml`,
            },
            {
                accessionNumber: '0001628280-26-006874',
                form: '20-F',
                filingDate: '2026-02-10',
                acceptanceDateTime: '2026-02-10T21:26:10.000Z',
                documentUrl: `${archives}/1639920/000162828026006874/ck0001639920-20251231.htm`,
            },
        ])
    })

    test('accepts an older page, which is the bare columnar object', () => {
        const filings = normalizeFilings(aaplOlderPage, 320193)
        expect(filings.map((f) => [f.form, f.documentUrl])).toEqual([
            ['10-K', `${archives}/320193/000119312514383437/d783162d10k.htm`],
            ['S-8', `${archives}/320193/000091205700024086/0000912057-00-024086-index.htm`],
            ['CERTNYS', `${archives}/320193/999999999715013472/9999999997-15-013472-index.htm`],
        ])
    })

    test('the submissions cik is a zero-padded string', () => {
        // Callers must convert it; passing it through as-is would put "0001639920" in the URL.
        expect(spotSubmissions.cik).toBe('0001639920')
    })

    test('returns an empty list when there are no filings', () => {
        const empty: FilingColumns = {
            accessionNumber: [],
            form: [],
            filingDate: [],
            acceptanceDateTime: [],
            primaryDocument: [],
        }
        expect(normalizeFilings(empty, 320193)).toEqual([])
    })

    test('a column shorter than accessionNumber does not throw', () => {
        const columns: FilingColumns = {
            accessionNumber: ['0001628280-26-066889', '0001140361-26-039594'],
            form: ['6-K'],
            filingDate: ['2026-10-22'],
            acceptanceDateTime: ['2026-10-22T20:09:19.000Z'],
            primaryDocument: ['spot-20260930x6xk.htm'],
        }
        const [, second] = normalizeFilings(columns, 1639920)
        expect(second).toMatchObject({ accessionNumber: '0001140361-26-039594', form: '', filingDate: '' })
        expect(second?.documentUrl).toEndWith('/0001140361-26-039594-index.htm')
    })
})
