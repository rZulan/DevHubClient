import { DeveloperFeatures } from "@/components/developer-features"
import { ScrollAssemble } from "@/components/scroll-assemble"
import { WelcomeHero } from "@/components/welcome-hero"
import { ReduxCounterCard } from "@/features/counter/redux-counter-card"

export function HomePage() {
  return (
    <div>
      <div className="grid items-start gap-10 md:grid-cols-[1.3fr_0.7fr]">
        <ScrollAssemble>
          <WelcomeHero />
        </ScrollAssemble>

        <ScrollAssemble delay={70}>
          <ReduxCounterCard />
        </ScrollAssemble>
      </div>

      <DeveloperFeatures />
    </div>
  )
}
