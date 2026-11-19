import {connectionLoadFailure} from "./connection-errors"

export function ConnectionLoadError({error, fallback, retry}: {error: unknown; fallback: string; retry?: () => void}) {
    const failure = connectionLoadFailure(error, fallback)

    return <div className="connection-inline-error" role="alert">
        {failure.message}{failure.canRetry && retry && <> <button type="button" onClick={retry}>Retry</button></>}
    </div>
}
