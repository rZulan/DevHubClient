import {Button} from "@/components/ui/button"
import {connectionError} from "./connection-errors"
import {useSetTodoCalendarConnectionMutation, type ConnectionScope} from "./connections-api"

export function TodoCalendarConnectionSettings({scope, enabled, writable}: {
    scope: ConnectionScope; enabled: boolean; writable: boolean
}) {
    const [setEnabled, result] = useSetTodoCalendarConnectionMutation()
    return <>
        <p className="connection-muted" role="status">{enabled ? "Enabled" : "Removed"}</p>
        {result.isError && <p className="connection-inline-error" role="alert">{connectionError(result.error, "Could not update this connection.")}</p>}
        {writable && <div className="connection-editor-footer">
            <Button type="button" variant={enabled ? "outline" : "default"} disabled={result.isLoading}
                onClick={() => void setEnabled({...scope, enabled: !enabled})}>
                {result.isLoading ? "Saving…" : enabled ? "Remove connection" : "Restore connection"}
            </Button>
        </div>}
    </>
}
