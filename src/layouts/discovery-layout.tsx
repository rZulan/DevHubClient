import { memo, type CSSProperties } from "react"
import { Outlet } from "react-router-dom"

import { MeshSurface } from "@/components/mesh-surface"

export const DiscoveryLayout = memo(function DiscoveryLayout() {
  return (
    <MeshSurface className="mesh-page" contentClassName="flex min-h-svh flex-col">
      <HyperspaceEntry />
      <main className="discovery-route-content w-full flex-1">
        <Outlet />
      </main>
    </MeshSurface>
  )
})

const hyperspaceStreaks = Array.from({ length: 88 }, (_, index) => {
  const angle = (index / 88) * 360 + pseudoRandom(index + 11) * 5
  const distance = 2 + pseudoRandom(index + 29) * 13
  const length = 16 + pseudoRandom(index + 47) * 32
  const delay = pseudoRandom(index + 71) * 240

  return { angle, delay, distance, index, length }
})

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function HyperspaceEntry() {
  return (
    <div aria-hidden="true" className="hyperspace-entry">
      <div className="hyperspace-vortex" />
      <div className="hyperspace-streaks">
        {hyperspaceStreaks.map(({ angle, delay, distance, index, length }) => (
          <span
            className="hyperspace-streak"
            key={index}
            style={
              {
                "--streak-angle": `${angle}deg`,
                "--streak-delay": `${delay}ms`,
                "--streak-distance": `${distance}vmin`,
                "--streak-length": `${length}vmin`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="hyperspace-flash" />
    </div>
  )
}
