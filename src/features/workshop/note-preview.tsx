import {useCallback, useRef, useState, type CSSProperties} from "react"
import {Pencil, X} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog"
import {NoteMarkdown} from "./note-markdown"
import {noteEmoji} from "./note-emojis"
import {noteTextColor} from "./sticky-notes"
import {claimNoteHover, createNotePeel, type NotePeel, type NotePreviewMotion} from "./note-preview-peel"
import type {StickyNote} from "./tool-documents"
import "./note-preview.css"

export function NotePreview({note, source, canEdit, animateOpening = true, initialPeel, onEdit, onClose}: {
    note: StickyNote; source: HTMLElement | null; canEdit: boolean; animateOpening?: boolean; initialPeel?: NotePeel | null; onEdit?: () => void; onClose: () => void
}) {
    const paper = useRef<HTMLDivElement>(null)
    const motion = useRef<NotePreviewMotion | null>(null)
    const lifted = useRef<NotePeel | null>(null)
    const alive = useRef(false)
    const phase = useRef<"peeling" | "preview">("peeling")
    const closeButton = useRef<HTMLButtonElement>(null)
    const closing = useRef(false)
    const editing = useRef(false)
    const [isClosing, setIsClosing] = useState(false)
    const [ready, setReady] = useState(false)
    // Radix mounts portal contents after the parent effect; attach at the actual paper mount.
    const attachPaper = useCallback((element: HTMLDivElement | null) => {
        if (!element) return
        paper.current = element
        alive.current = true
        if (source) {source.dataset.notePreviewActive = "true"; delete source.dataset.noteHoverActive}
        if (animateOpening && source?.isConnected && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            element.style.opacity = "0"
            element.inert = true
            const existing = initialPeel ?? claimNoteHover(source)
            const card = existing?.element.isConnected ? existing : createNotePeel(source, false, existing?.progress)
            lifted.current = card
            const peel = card.play()
            motion.current = peel
            void peel.finished.then(() => {
                if (!alive.current || closing.current) return
                phase.current = "preview"
                // The peel is complete before the full-size preview starts fading in.
                element.style.opacity = "1"
                element.inert = false
                setReady(true)
                const reveal = element.animate([{opacity: 0}, {opacity: 1}], {duration: 120, fill: "backwards"})
                motion.current = reveal
                card.element.animate([{opacity: 1}, {opacity: 0}], {duration: 120, fill: "both"})
                void reveal.finished.then(() => {
                    card.remove()
                    if (lifted.current === card) lifted.current = null
                    if (alive.current && !closing.current) closeButton.current?.focus({preventScroll: true})
                }, () => {})
            }, () => {})
        } else {
            phase.current = "preview"
            setReady(true)
        }
        return () => {
            alive.current = false
            motion.current?.cancel()
            lifted.current?.remove()
            if (source) delete source.dataset.notePreviewActive
        }
    }, [source, animateOpening, initialPeel])

    function close() {
        if (closing.current) return
        closing.current = true
        setIsClosing(true)
        const element = paper.current
        if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {onClose(); return}
        const opening = motion.current
        // Escape during the peel puts the original card straight back on the wall.
        if (phase.current === "peeling" && opening?.playState === "running") {
            opening.reverse()
            void opening.finished.then(onClose, () => {})
            return
        }
        const opacity = window.getComputedStyle(element).opacity
        opening?.cancel()
        lifted.current?.remove()
        const fade = element.animate([{opacity}, {opacity: 0}], {duration: 120, fill: "both"})
        motion.current = fade
        void fade.finished.then(() => {
            if (!alive.current) return
            if (!source?.isConnected) {onClose(); return}
            const card = createNotePeel(source, true)
            lifted.current = card
            const settle = card.play()
            motion.current = settle
            void settle.finished.then(() => {if (alive.current) onClose()}, () => {})
        }, () => {})
    }

    return <Dialog open onOpenChange={open => {if (!open) close()}}>
        <DialogContent className="note-preview-dialog" overlayClassName="notes-modal-overlay" showCloseButton={false} aria-describedby={undefined}
            onCloseAutoFocus={event => {
                if (editing.current) {event.preventDefault(); return}
                if (source?.isConnected) {event.preventDefault(); source.querySelector<HTMLButtonElement>(".sticky-note-open")?.focus({preventScroll: true})}
            }}>
            <DialogTitle className="sr-only">{note.title}</DialogTitle>
            <DialogDescription className="sr-only">Note preview</DialogDescription>
            <div className="note-preview-actions" data-closing={isClosing} data-ready={ready} data-animate={animateOpening}>
                <Button ref={closeButton} type="button" variant="outline" onClick={close}><X/>Close</Button>
                {onEdit && <Button type="button" disabled={!canEdit || isClosing} onClick={() => {editing.current = true; onEdit()}}><Pencil/>Edit note</Button>}
            </div>
            <div ref={attachPaper} className="notes-editor-paper notes-reader-paper note-preview-paper" data-closing={isClosing}
                style={{"--note-color": note.color, "--note-ink": noteTextColor(note.color)} as CSSProperties}>
                <h3>{noteEmoji(note) && <span className="note-emoji" aria-hidden="true">{noteEmoji(note)}</span>}{note.title}</h3>
                {note.body ? <NoteMarkdown body={note.body}/> : <p className="notes-reader-empty">No details yet.</p>}
            </div>
        </DialogContent>
    </Dialog>
}
