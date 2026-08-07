import type { PointerEvent, ReactNode } from "react"

import { cn } from "@/lib/utils"

export function MeshSurface({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100

    event.currentTarget.style.setProperty("--mesh-x", `${x}%`)
    event.currentTarget.style.setProperty("--mesh-y", `${y}%`)
  }

  function handlePointerLeave(event: PointerEvent<HTMLElement>) {
    event.currentTarget.style.setProperty("--mesh-x", "50%")
    event.currentTarget.style.setProperty("--mesh-y", "50%")
  }

  return (
    <section
      className={cn("mesh-surface", className)}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
    >
      <div aria-hidden="true" className="mesh-visual">
        <div className="mesh-glow" />
        <div className="mesh-orb mesh-orb-one" />
        <div className="mesh-orb mesh-orb-two" />
        <div className="mesh-orb mesh-orb-three" />
        <div className="mesh-waves" />
      </div>
      <div className={cn("relative z-10", contentClassName)}>{children}</div>
    </section>
  )
}
