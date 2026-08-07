import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"

import { cn } from "@/lib/utils"

const particleCount = 28

type ParticleStyle = CSSProperties & {
  "--particle-delay": string
  "--particle-x": string
  "--particle-y": string
}

export function ScrollAssemble({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const scrollDirectionRef = useRef<"down" | "up">("down")
  const [isAssembled, setIsAssembled] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      setIsAssembled(true)
      return
    }

    let previousScrollY = window.scrollY

    const handleScroll = () => {
      const nextScrollY = window.scrollY

      if (Math.abs(nextScrollY - previousScrollY) > 2) {
        scrollDirectionRef.current = nextScrollY < previousScrollY ? "up" : "down"
        previousScrollY = nextScrollY
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return

        const isEntering = entry.isIntersecting && entry.intersectionRatio >= 0.18
        const isLeavingAbove =
          scrollDirectionRef.current === "down" &&
          entry.intersectionRatio <= 0.2 &&
          entry.boundingClientRect.bottom < window.innerHeight * 0.45
        const isLeavingBelow =
          scrollDirectionRef.current === "up" &&
          entry.intersectionRatio <= 0.2 &&
          entry.boundingClientRect.top > window.innerHeight * 0.55

        if (isLeavingAbove || isLeavingBelow) {
          setIsAssembled(false)
        } else if (isEntering) {
          setIsAssembled(true)
        }
      },
      {
        rootMargin: "0px 0px -4% 0px",
        threshold: [0, 0.08, 0.18, 0.35, 0.6],
      },
    )

    observer.observe(element)
    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  return (
    <div
      className={cn("scroll-assemble", className)}
      data-assembled={isAssembled}
      ref={elementRef}
      style={{ "--assemble-delay": `${delay}ms` } as CSSProperties}
    >
      <div className="scroll-assemble-content">{children}</div>
      <div aria-hidden="true" className="scroll-assemble-particles">
        {Array.from({ length: particleCount }, (_, index) => (
          <span
            className="scroll-assemble-particle"
            key={index}
            style={getParticleStyle(index)}
          />
        ))}
      </div>
    </div>
  )
}

function getParticleStyle(index: number): ParticleStyle {
  const horizontalDirection = index % 2 === 0 ? -1 : 1
  const verticalDirection = index % 3 === 0 ? -1 : 1

  return {
    left: `${(index * 37 + 7) % 94}%`,
    top: `${(index * 53 + 5) % 90}%`,
    "--particle-x": `${horizontalDirection * (22 + ((index * 17) % 64))}px`,
    "--particle-y": `${verticalDirection * (18 + ((index * 23) % 52))}px`,
    "--particle-delay": `${(index % 8) * 22}ms`,
  }
}
