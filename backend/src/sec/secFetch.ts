import { config } from '../config'
import { HttpError } from '../errors'

const minGAP = 125
const retruDelay = 1000

let nextSlot = 0

async function waitForSlot() {
    const now = Date.now()
    const wait = Math.max(0, nextSlot - now)
    nextSlot = Math.max(now, nextSlot) + minGAP
    if (wait > 0) await Bun.sleep(wait)
}

export async function secFetch<T>(url: string): Promise<T> {
    for (let attempt = 1; attempt <= 2; attempt++) {
        await waitForSlot()

        let res: Response
        try {
            res = await fetch(url, { headers: { 'User-Agent': config.secUserAgent } })
        } catch {
            throw new HttpError(502, 'Could not reach SEC')
        }

        if (res.ok) return (await res.json()) as T
        if (res.status === 404) throw new HttpError(404, 'Not found on SEC')
        if (res.status === 429 && attempt === 1) {
            await Bun.sleep(retruDelay)
            continue
        }
        throw new HttpError(502, `SEC responded with ${res.status}`)
    }
    throw new HttpError(502, 'SEC rate limit exceeded')
}