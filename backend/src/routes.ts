import { Router } from 'express'
import { queryFilings } from './sec/query'
import { getRecent } from './sec/companies'
import { resolveTicker } from './sec/tickers'

export const apiRouter = Router()

apiRouter.get('/companies/:ticker/filings', async (req, res) => {
    const form = typeof req.query.form === 'string' && req.query.form.trim() ? req.query.form : undefined
    const sort = req.query.sort === 'asc' ? 'asc' : 'desc'
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1)
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(req.query.pageSize)) || 25))

    const company = await resolveTicker(req.params.ticker)
    const recent = await getRecent(company.cik)

    res.json({
        company: { ticker: company.ticker, cik: company.cik, name: recent.name },
        availableForms: recent.availableForms,
        ...queryFilings(recent.filings, { form, sort, page, pageSize }),
    })
})