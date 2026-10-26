type Entry<T> = { promise: Promise<T>; expires: number }

export class TimeToLiveCache<T> {
    private entries = new Map<string, Entry<T>>()

    constructor(
        private timeToLiveMs: number,
        private maxEntries = 100,
    ) { }

    getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
        const hit = this.entries.get(key)
        if (hit && hit.expires > Date.now()) {
            this.entries.delete(key)
            this.entries.set(key, hit)
            return hit.promise
        }

        const promise = load()
        this.entries.delete(key)
        this.entries.set(key, { promise, expires: Date.now() + this.timeToLiveMs })

        promise.catch(() => {
            if (this.entries.get(key)?.promise === promise) this.entries.delete(key)
        })

        if (this.entries.size > this.maxEntries) {
            const oldest = this.entries.keys().next().value
            if (oldest !== undefined) this.entries.delete(oldest)
        }

        return promise
    }
}