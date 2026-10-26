import { afterEach, describe, expect, mock, setSystemTime, test } from "bun:test"
import { TimeToLiveCache } from "./cache"

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

afterEach(() => {
    setSystemTime()
})

describe("TimeToLiveCache", () => {
    test("returns the cached value without calling load again", async () => {
        const cache = new TimeToLiveCache<string>(1000)
        const load = mock(async () => "value")

        expect(await cache.getOrLoad("a", load)).toBe("value")
        expect(await cache.getOrLoad("a", load)).toBe("value")
        expect(load).toHaveBeenCalledTimes(1)
    })

    test("keeps keys separate", async () => {
        const cache = new TimeToLiveCache<string>(1000)

        expect(await cache.getOrLoad("a", async () => "A")).toBe("A")
        expect(await cache.getOrLoad("b", async () => "B")).toBe("B")
    })

    test("shares one in-flight load between concurrent callers", async () => {
        const cache = new TimeToLiveCache<string>(1000)
        const pending = deferred<string>()
        const load = mock(() => pending.promise)

        const first = cache.getOrLoad("a", load)
        const second = cache.getOrLoad("a", load)
        pending.resolve("value")

        expect(await first).toBe("value")
        expect(await second).toBe("value")
        expect(load).toHaveBeenCalledTimes(1)
    })

    test("reloads after the time to live has passed", async () => {
        setSystemTime(new Date("2026-01-01T00:00:00Z"))
        const cache = new TimeToLiveCache<string>(1000)
        await cache.getOrLoad("a", async () => "old")

        setSystemTime(new Date("2026-01-01T00:00:00.999Z"))
        expect(await cache.getOrLoad("a", async () => "new")).toBe("old")

        setSystemTime(new Date("2026-01-01T00:00:01Z"))
        expect(await cache.getOrLoad("a", async () => "new")).toBe("new")
    })

    test("removes a failed load so the next call retries", async () => {
        const cache = new TimeToLiveCache<string>(1000)

        await expect(cache.getOrLoad("a", async () => { throw new Error("boom") })).rejects.toThrow("boom")
        expect(await cache.getOrLoad("a", async () => "value")).toBe("value")
    })

    test("concurrent callers all see the same failure", async () => {
        const cache = new TimeToLiveCache<string>(1000)
        const pending = deferred<string>()
        const load = mock(() => pending.promise)

        const first = cache.getOrLoad("a", load)
        const second = cache.getOrLoad("a", load)
        pending.reject(new Error("boom"))

        await expect(first).rejects.toThrow("boom")
        await expect(second).rejects.toThrow("boom")
        expect(load).toHaveBeenCalledTimes(1)
    })

    test("a late failure does not evict a newer entry for the same key", async () => {
        setSystemTime(new Date("2026-01-01T00:00:00Z"))
        const cache = new TimeToLiveCache<string>(1000)
        const slow = deferred<string>()
        const stale = cache.getOrLoad("a", () => slow.promise)

        // The slow load expires while still in flight, so the next call replaces it.
        setSystemTime(new Date("2026-01-01T00:00:02Z"))
        expect(await cache.getOrLoad("a", async () => "fresh")).toBe("fresh")

        slow.reject(new Error("boom"))
        await expect(stale).rejects.toThrow("boom")

        const load = mock(async () => "reloaded")
        expect(await cache.getOrLoad("a", load)).toBe("fresh")
        expect(load).not.toHaveBeenCalled()
    })

    test("evicts the oldest entry when over maxEntries", async () => {
        const cache = new TimeToLiveCache<string>(1000, 2)
        await cache.getOrLoad("a", async () => "A")
        await cache.getOrLoad("b", async () => "B")
        await cache.getOrLoad("c", async () => "C")

        const loadA = mock(async () => "A2")
        const loadC = mock(async () => "C2")
        expect(await cache.getOrLoad("a", loadA)).toBe("A2")
        expect(await cache.getOrLoad("c", loadC)).toBe("C")
        expect(loadA).toHaveBeenCalledTimes(1)
        expect(loadC).not.toHaveBeenCalled()
    })

    test("a cache hit counts as recent use (LRU, not FIFO)", async () => {
        const cache = new TimeToLiveCache<string>(1000, 2)
        await cache.getOrLoad("a", async () => "A")
        await cache.getOrLoad("b", async () => "B")

        // Reading "a" should make "b" the least recently used.
        await cache.getOrLoad("a", async () => "unused")
        await cache.getOrLoad("c", async () => "C")

        const loadA = mock(async () => "A2")
        const loadB = mock(async () => "B2")
        expect(await cache.getOrLoad("a", loadA)).toBe("A")
        expect(await cache.getOrLoad("b", loadB)).toBe("B2")
        expect(loadA).not.toHaveBeenCalled()
    })
})
