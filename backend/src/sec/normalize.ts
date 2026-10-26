const archivesUrl = 'https://www.sec.gov/Archives/edgar/data'

export type FilingColumns = {
    accessionNumber: string[]
    form: string[]
    filingDate: string[]
    acceptanceDateTime: string[]
    primaryDocument: string[]
}

export type SubmissionsFile = {
    cik: string
    name: string
    filings: {
        recent: FilingColumns
        files: { name: string; filingCount: number; filingFrom: string; filingTo: string }[]
    }
}

export type Filing = {
    accessionNumber: string
    form: string
    filingDate: string
    acceptanceDateTime: string
    documentUrl: string
}

export function buildDocumentUrl(cik: number, accessionNumber: string, primaryDocument: string): string {
    const folder = `${archivesUrl}/${cik}/${accessionNumber.replaceAll('-', '')}`
    if (!primaryDocument || primaryDocument.endsWith('.paper')) {
        return `${folder}/${accessionNumber}-index.htm`
    }
    return `${folder}/${primaryDocument}`
}

export function normalizeFilings(columns: FilingColumns, cik: number): Filing[] {
    return columns.accessionNumber.map((accessionNumber, i) => ({
        accessionNumber,
        form: columns.form[i] ?? '',
        filingDate: columns.filingDate[i] ?? '',
        acceptanceDateTime: columns.acceptanceDateTime[i] ?? '',
        documentUrl: buildDocumentUrl(cik, accessionNumber, columns.primaryDocument[i] ?? ''),
    }))
}