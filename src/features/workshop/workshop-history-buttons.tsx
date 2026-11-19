import {useLayoutEffect, useState} from "react"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useLocation, useNavigate, useNavigationType} from "react-router-dom"
import {Button} from "@/components/ui/button"

export function WorkshopHistoryButtons() {
    const {key} = useLocation()
    const action = useNavigationType()
    const navigate = useNavigate()
    const navigation = window.navigation
    const index: number = window.history.state?.idx ?? 0
    const [furthestIndex, setFurthestIndex] = useState(index)

    useLayoutEffect(() => {
        if (!navigation) setFurthestIndex(previous => action === "PUSH" ? index : Math.max(previous, index))
    }, [action, index, key, navigation])

    return <div className="workshop-history-buttons" role="group" aria-label="Page history">
        <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label="Go back" title="Go back"
                disabled={!(navigation?.canGoBack ?? (index > 0))} onClick={() => void navigate(-1)}><ArrowLeft aria-hidden="true"/></Button>
        <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label="Go forward" title="Go forward"
                disabled={!(navigation?.canGoForward ?? (index < furthestIndex))} onClick={() => void navigate(1)}><ArrowRight aria-hidden="true"/></Button>
    </div>
}
