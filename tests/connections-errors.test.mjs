import assert from "node:assert/strict"
import test from "node:test"
import {connectionError, connectionLoadFailure} from "../src/features/workshop/connections/connection-errors.ts"

const fallback = "Could not load project connections."

test("a missing Connections endpoint asks for the API update instead of retrying", () => {
    for (const error of [
        {status: 404, data: {title: "Not Found", code: "Http.404"}},
        {status: 404, data: null},
        {status: "PARSING_ERROR", originalStatus: 404, data: "Not Found"},
    ]) {
        const failure = connectionLoadFailure(error, fallback)
        assert.match(failure.message, /missing the Connections API/)
        assert.equal(failure.canRetry, false)
    }
})

test("the Connections API can report a project is unavailable", () => {
    const failure = connectionLoadFailure({status: 404, data: {code: "Connections.NotFound"}}, fallback)
    assert.match(failure.message, /project is unavailable/)
    assert.equal(failure.canRetry, false)
})

test("transient load errors can be retried and draft errors keep their detail", () => {
    assert.deepEqual(connectionLoadFailure({status: "FETCH_ERROR"}, fallback), {message: fallback, canRetry: true})
    assert.equal(connectionError({status: 409, data: {detail: "This connection changed. Reload before saving it again."}}, fallback),
        "This connection changed. Reload before saving it again.")
})
