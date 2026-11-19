import assert from "node:assert/strict"
import test from "node:test"
import {nextTravelerWave} from "../src/features/discovery/traveler-schedule.ts"

const profiles = (size) => Array.from({length: size}, (_, index) => ({id: String(index)}))
const sizeOfWave = (size, waveNumber = 0) =>
    nextTravelerWave(profiles(size), new Set(), 0, waveNumber, false)?.arrivals.length ?? 0

test("small pools grow gradually and large pools vary from five to seven arrivals", () => {
    assert.deepEqual([0, 1, 5, 10, 25, 50, 75].map((size) => sizeOfWave(size)), [0, 1, 1, 2, 3, 4, 5])
    for (const size of [99, 100, 1_000, 10_000]) {
        assert.deepEqual([0, 1, 2, 3, 4].map((wave) => sizeOfWave(size, wave)), [5, 6, 7, 6, 5])
    }
})

test("successive waves overlap without spawning an active profile again", () => {
    const pool = profiles(3)
    const first = nextTravelerWave(pool, new Set(), 0, 0, false)
    const second = nextTravelerWave(pool, new Set(["0"]), first.nextIndex, 1, false)
    const third = nextTravelerWave(pool, new Set(["0", "1"]), second.nextIndex, 2, false)
    assert.deepEqual([...first.arrivals, ...second.arrivals, ...third.arrivals], pool)
    assert.equal(nextTravelerWave(pool, new Set(["0", "1", "2"]), third.nextIndex, 3, false), null)
    assert.deepEqual(nextTravelerWave(pool, new Set(["1", "2"]), third.nextIndex, 3, false).arrivals, [pool[0]])
})

test("the stream waits at a page boundary and wraps once all pages are loaded", () => {
    const firstPage = profiles(100)
    const fullPool = profiles(102)
    assert.equal(nextTravelerWave(firstPage, new Set(), 98, 0, true), null)
    const next = nextTravelerWave(fullPool, new Set(), 98, 0, false)
    assert.deepEqual(next.arrivals.map(({id}) => id), ["98", "99", "100", "101", "0"])
    assert.equal(next.nextIndex, 1)
})
