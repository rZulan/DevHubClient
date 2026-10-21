import {ArrowRight, Compass, LayoutGrid} from "lucide-react"
import {memo} from "react"
import {Link} from "react-router-dom"
import {ScrollAssemble} from "@/components/scroll-assemble"
import {DiscoveryScene, NotesSchemaScene, WorkshopScene} from "@/components/home-product-previews"

export const DeveloperFeatures = memo(function DeveloperFeatures() {
    return <div className="landing-showcases">
        <ScrollAssemble>
            <section className="landing-showcase" aria-labelledby="landing-team-title">
                <div className="landing-showcase-visual"><WorkshopScene/></div>
                <div className="landing-showcase-copy"><span className="landing-section-label">Workshop</span><h2 id="landing-team-title">One team.<br/>One space.<br/>Your way.</h2><p>Projects, people, and roles. All in your organization.</p><Link to="/workshop">Open Workshop<ArrowRight/></Link></div>
            </section>
        </ScrollAssemble>
        <ScrollAssemble>
            <section className="landing-showcase landing-showcase-reverse" aria-labelledby="landing-tools-title">
                <div className="landing-showcase-visual"><NotesSchemaScene/></div>
                <div className="landing-showcase-copy"><span className="landing-section-label">Notes & ERD maker</span><h2 id="landing-tools-title">Catch the idea.<br/>Connect<br/>the dots.</h2><p>Markdown notes with draft recovery. Database diagrams with SQL import and export.</p><Link to="/workshop">Start building<ArrowRight/></Link></div>
            </section>
        </ScrollAssemble>
        <ScrollAssemble>
            <section className="landing-showcase" aria-labelledby="landing-discovery-title">
                <div className="landing-showcase-visual"><DiscoveryScene/></div>
                <div className="landing-showcase-copy"><span className="landing-section-label">Discovery · Preview</span><h2 id="landing-discovery-title">A little<br/>curiosity.<br/>A new orbit.</h2><p>Explore profile cards, tech stacks, and an interactive developer universe.</p><Link to="/discovery">Enter Discovery<ArrowRight/></Link></div>
            </section>
        </ScrollAssemble>
        <ScrollAssemble>
            <section className="landing-finish" aria-labelledby="landing-finish-title"><h2 id="landing-finish-title">See where<br/>it takes you.</h2><div className="landing-actions"><Link className="landing-button landing-button-primary" to="/workshop"><LayoutGrid/>Open Workshop<ArrowRight/></Link><Link className="landing-button landing-button-secondary" to="/discovery"><Compass/>Explore Discovery<ArrowRight/></Link></div></section>
        </ScrollAssemble>
    </div>
})
