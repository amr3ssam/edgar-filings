import express, { type NextFunction, type Request, type Response } from 'express'
import { config } from './config'
import { HttpError } from './errors'
import { apiRouter } from './routes'

const app = express()

app.get('/health', (_req, res) => {
    res.json({ ok: true })
})

app.use(apiRouter)

app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
})

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message })
        return
    }
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
})

app.listen(config.port, () => console.log(`API on :${config.port}`))