import express, { type NextFunction, type Request, type Response } from 'express'
import { config } from './config'
import { HttpError } from './errors'

const app = express()

app.get('/health', (_req, res) => {
    res.json({ ok: true })
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