import {ArrowUpRight} from "lucide-react"
import {Link} from "react-router-dom"

export function ConstructionNotice() {
    return <aside className="landing-construction-notice" aria-label="Website status">
        <div className="landing-construction-bubble">
            <p>This website is still under construction.</p>
            <Link to="/changelogs">See Changelogs<ArrowUpRight aria-hidden="true"/></Link>
        </div>
        <svg className="landing-builder-avatar" viewBox="0 0 72 80" fill="none" aria-hidden="true">
            <circle cx="36" cy="45" r="33" fill="#d9cef3"/>
            <g stroke="#332b43" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 72c3-14 13-19 26-19s23 5 26 19a33 33 0 0 1-52 0Z" fill="#40394f"/>
                <path d="m27 55 9 9 9-9-9-5-9 5Z" fill="#f2bb94"/>
                <path d="m22 57 4 20m24-20-4 20" stroke="#f5bf57" strokeWidth="5"/>
                <path d="M21 36v8c0 12 7 18 15 18s15-6 15-18v-8" fill="#f5c9a7"/>
                <path d="M21 41c-6-3-6 8 1 8m29-8c6-3 6 8-1 8" fill="#f5c9a7"/>
                <path d="M21 35v8m30-8v8" strokeWidth="4"/>
                <path d="M28 43h2m12 0h2" strokeWidth="2.8"/>
                <path d="m36 45-2 5h3m-7 3c4 4 9 4 12-1"/>
                <path d="M16 31v-5C16 15 25 7 36 7s20 8 20 19v5" fill="#f7bf48"/>
                <path d="M31 9V5h10v4l2 22H29l2-22Z" fill="#ffd66c"/>
                <path d="M15 29h42l3 7c-14 4-34 4-48 0l3-7Z" fill="#f7bf48"/>
                <path d="M22 18c-2 3-3 5-3 8" stroke="#fff0ba" strokeWidth="2.4"/>
                <path d="M32 31h8" stroke="#fff0ba" strokeWidth="3"/>
            </g>
        </svg>
    </aside>
}
