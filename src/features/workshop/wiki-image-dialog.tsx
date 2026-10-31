import {useState} from "react"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {wikiImageReference} from "./wiki-images"

export function WikiImageDialog({onInsert, onClose}: {onInsert: (markdown: string) => void; onClose: () => void}) {
    const [url, setUrl] = useState(""), [alt, setAlt] = useState(""), [width, setWidth] = useState(""), [height, setHeight] = useState(""), [error, setError] = useState("")
    function insert() {
        try {onInsert(wikiImageReference(url, alt, width, height)); onClose()}
        catch (failure) {setError((failure as Error).message)}
    }
    return <Dialog open onOpenChange={open => {if (!open) onClose()}}><DialogContent className="wiki-image-dialog">
        <DialogHeader><DialogTitle>Insert image</DialogTitle><DialogDescription>Reference an image by URL. Leave either size blank to keep its proportions.</DialogDescription></DialogHeader>
        <Label>Image URL<Input autoFocus value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/image.png"/></Label>
        <Label>Image description<Input value={alt} onChange={event => setAlt(event.target.value)} placeholder="Describe the image for readers"/></Label>
        <div className="wiki-image-dimensions"><Label>Width (px)<Input type="number" min={1} max={4096} step={1} value={width} onChange={event => setWidth(event.target.value)} placeholder="Auto"/></Label><Label>Height (px)<Input type="number" min={1} max={4096} step={1} value={height} onChange={event => setHeight(event.target.value)} placeholder="Auto"/></Label></div>
        <p className="wiki-muted">Images stay within the page width. When both sizes are set, the image fits inside that box without stretching.</p>
        {error && <p role="alert" className="wiki-notice">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="button" disabled={!url.trim()} onClick={insert}>Insert image</Button></DialogFooter>
    </DialogContent></Dialog>
}
