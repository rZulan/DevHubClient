import {DeveloperFeatures} from "@/components/developer-features"
import {ConstructionNotice} from "@/components/construction-notice"
import {ScrollAssemble} from "@/components/scroll-assemble"
import {WelcomeHero} from "@/components/welcome-hero"
import "./home-page.css"

export function HomePage() {
    return (
        <div className="devhub-landing">
            <ScrollAssemble><WelcomeHero/></ScrollAssemble>
            <DeveloperFeatures/>
            <ConstructionNotice/>
        </div>
    )
}
