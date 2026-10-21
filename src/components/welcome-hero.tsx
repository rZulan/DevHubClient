import {ArrowRight, Compass, LayoutGrid} from "lucide-react"
import {memo, useEffect, useState} from "react"
import {Link} from "react-router-dom"
import {useAppSelector} from "@/app/hooks"
import {DiscoveryOrbitPreview, WorkshopScene, WorkshopTour} from "@/components/home-product-previews"

type Preview = "workshop" | "discovery"

export const WelcomeHero = memo(function WelcomeHero() {
    const user = useAppSelector(state => state.auth.user)
    const [hovered, setHovered] = useState<Preview | null>(null)
    const [focused, setFocused] = useState<Preview | null>(null)
    const [preview, setPreview] = useState<Preview | null>(null)
    const target = hovered ?? focused

    useEffect(() => {
        setPreview(null)
        if (!target) return
        const timer = window.setTimeout(() => setPreview(target), 350)
        return () => window.clearTimeout(timer)
    }, [target])

    const previewEvents = (name: Preview) => ({
        onPointerEnter: (event: React.PointerEvent) => { if (event.pointerType !== "touch") setHovered(name) },
        onPointerLeave: () => setHovered(null),
        onFocus: () => setFocused(name),
        onBlur: () => setFocused(null),
        onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === "Escape") { setHovered(null); setFocused(null) }
        },
        "data-waiting": target === name && preview !== name,
        "data-preview-active": preview === name,
    })

    return <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
            <h1 id="landing-title">Build<br/>with your<br/><span>people.</span></h1>
            <p>Plan in Workshop. Explore in Discovery.</p>
            <div className="landing-actions" aria-label="Choose your space">
                <Link className="landing-button landing-button-primary landing-preview-trigger" to="/workshop" {...previewEvents("workshop")}><LayoutGrid/><span>Workshop</span><ArrowRight/></Link>
                <Link className="landing-button landing-button-secondary landing-preview-trigger" to="/discovery" {...previewEvents("discovery")}><Compass/><span>Discovery</span><ArrowRight/></Link>
            </div>
        </div>
        <div className="landing-hero-preview" data-preview={preview ?? "idle"}>
            <div className="landing-preview-frame" key={preview ?? "idle"}>
                {preview === "workshop" ? <WorkshopTour/> : preview === "discovery" ? <DiscoveryOrbitPreview user={user}/> : <WorkshopScene hero/>}
            </div>
        </div>
    </section>
})
