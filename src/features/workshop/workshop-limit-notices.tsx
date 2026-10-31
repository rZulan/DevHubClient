import {useParams} from "react-router-dom"
import {useGetWorkshopLimitsQuery} from "./workshop-limits-api"
import {canvasObjectCount, workshopDefaults} from "./workshop-limits"

export function WorkshopStorageNotice({organizationId, persisted}: {organizationId: string; persisted: boolean}) {
    const {data} = useGetWorkshopLimitsQuery(organizationId, {skip: !persisted, pollingInterval: 60_000, refetchOnFocus: true})
    if (!data?.storage.warning) return null
    const {usedBytes, limitBytes, full} = data.storage
    return <div className="workshop-limit-notice" role="status">
        Attachment storage {full ? "is full" : "is almost full"}: {(usedBytes / 1024 / 1024).toFixed(1)} of {(limitBytes / 1024 / 1024).toFixed(0)} MB used.
        {full ? " Existing files remain available. Ask an administrator to free storage or raise the quota before uploading more." : " Ask an administrator to review storage before uploading more large files."}
    </div>
}

export function WorkshopCanvasNotice({tool, document}: {tool: string; document: unknown}) {
    const {organizationId = ""} = useParams()
    const {data} = useGetWorkshopLimitsQuery(organizationId, {skip: !/^[a-f\d-]{36}$/i.test(organizationId)})
    const count = canvasObjectCount(tool, document)
    const maximum = data?.canvasMaximumObjects ?? workshopDefaults.canvasMaximumObjects
    const warning = Math.min(data?.canvasWarningObjects ?? workshopDefaults.canvasWarningObjects, Math.floor(maximum * .8))
    if (count === null || count < warning) return null
    return <div className="workshop-limit-notice" role="status">{count.toLocaleString()} objects · {count > maximum
        ? "This existing canvas remains editable and exportable. Remove objects before growing it further."
        : count === maximum ? "Canvas limit reached. Edit or remove existing objects, or start another canvas."
        : `${maximum.toLocaleString()} object limit. Larger canvases may feel slower on mobile devices.`}</div>
}
