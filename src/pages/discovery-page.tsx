import { ArrowLeft, Gauge, Sparkles } from "lucide-react"
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react"
import { Link } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getUserHandle, getUserInitials } from "@/features/auth/user-display"

const travelerSeeds = [
  { initials: "AL", color: "from-rose-400 to-orange-300" }, { initials: "MK", color: "from-cyan-400 to-blue-500" },
  { initials: "JR", color: "from-violet-400 to-fuchsia-500" }, { initials: "SO", color: "from-amber-300 to-rose-400" },
  { initials: "NA", color: "from-emerald-300 to-cyan-500" }, { initials: "DV", color: "from-indigo-400 to-purple-500" },
  { initials: "KE", color: "from-pink-400 to-violet-500" }, { initials: "RO", color: "from-lime-300 to-teal-500" },
]
const randomAt = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}
const travelers = Array.from({ length: 100 }, (_, id) => ({
  ...travelerSeeds[id % travelerSeeds.length], id,
  duration: 0.82 + randomAt(id + 1) * 0.42,
  x: (randomAt(id + 13) * 2 - 1) * 80,
  y: (randomAt(id + 37) * 2 - 1) * 68,
}))
const flightSpeedStorageKey = "devhub.discovery.flight-speed"

export function DiscoveryPage() {
  const user = useAppSelector((state) => state.auth.user)
  const [speed, setSpeed] = useState(() => {
    const savedSpeed = Number(window.localStorage.getItem(flightSpeedStorageKey))
    return Number.isFinite(savedSpeed) && savedSpeed >= 0 && savedSpeed <= 100 ? savedSpeed : 30
  })
  const [hoveredTravelerId, setHoveredTravelerId] = useState<number | null>(null)
  const [dragOffsets, setDragOffsets] = useState<Record<string, { x: number, y: number }>>({})
  const [dragging, setDragging] = useState<{
    id: string
    startOffset: { x: number, y: number }
    startX: number
    startY: number
  } | null>(null)
  const sceneRef = useRef<HTMLElement>(null)
  const nextTravelerIndex = useRef(12)
  const [travelerSlots, setTravelerSlots] = useState(() =>
    Array.from({ length: 12 }, (_, index) => ({ delay: -index * 1.8, index })),
  )
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : "You"

  useEffect(() => {
    const playbackRate = speed / 50
    sceneRef.current?.getAnimations({ subtree: true }).forEach((animation) => {
      if (
        "animationName" in animation &&
        typeof animation.animationName === "string" &&
        ["discovery-flyby", "discovery-mesh-forward"].includes(animation.animationName)
      ) {
        animation.playbackRate = playbackRate
      }
    })
  }, [speed])

  useEffect(() => {
    window.localStorage.setItem(flightSpeedStorageKey, String(speed))
  }, [speed])

  const replaceTraveler = (slotToReplace: number) => {
    const nextIndex = nextTravelerIndex.current
    nextTravelerIndex.current = (nextIndex + 1) % travelers.length
    setTravelerSlots((slots) =>
      slots.map((slot, index) => index === slotToReplace ? { delay: 0, index: nextIndex } : slot),
    )
  }

  const beginDrag = (id: string, event: PointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging({ id, startOffset: dragOffsets[id] ?? { x: 0, y: 0 }, startX: event.clientX, startY: event.clientY })
  }

  const updateDrag = (event: PointerEvent<HTMLElement>) => {
    if (!dragging) return
    setDragOffsets((offsets) => ({
      ...offsets,
      [dragging.id]: {
        x: dragging.startOffset.x + event.clientX - dragging.startX,
        y: dragging.startOffset.y + event.clientY - dragging.startY,
      },
    }))
  }

  return (
    <section
      className="discovery-flight"
      onPointerCancel={() => setDragging(null)}
      onPointerMove={updateDrag}
      onPointerUp={() => setDragging(null)}
      ref={sceneRef}
      aria-label="Discovery space"
    >
      <div className="discovery-stars" aria-hidden="true" />
      <div className="discovery-aurora" />
      <div className="discovery-forward-mesh" aria-hidden="true" />

      <div className="discovery-copy">
        <p className="discovery-kicker">Public developer space</p>
        <h1>Discovery</h1>
        <p>Move through a living universe of builders.</p>
      </div>

      <Link className="discovery-back" to="/"><ArrowLeft className="size-4" /> Back to home</Link>

      <label className="discovery-speed-control">
        <span><Gauge className="size-4" /> Flight speed <b>{speed}%</b></span>
        <input aria-label="Flight speed" max="100" min="0" onChange={(event) => setSpeed(Number(event.target.value))} type="range" value={speed} />
      </label>

      {travelerSlots.map((slot, slotIndex) => {
        const traveler = travelers[slot.index]
        const travelerKey = `traveler-${traveler.id}`
        const dragOffset = dragOffsets[travelerKey] ?? { x: 0, y: 0 }
        return (
        <div
          className="discovery-traveler"
          key={traveler.id}
          onAnimationIteration={() => replaceTraveler(slotIndex)}
          onPointerEnter={() => setHoveredTravelerId(traveler.id)}
          onPointerLeave={() => setHoveredTravelerId(null)}
          onPointerDown={(event) => beginDrag(travelerKey, event)}
          style={{
            "--travel-drag-x": `${dragOffset.x}px`,
            "--travel-drag-y": `${dragOffset.y}px`,
            "--travel-delay": `${slot.delay}s`,
            "--travel-duration": `${traveler.duration}`,
            "--travel-end-x": `${traveler.x * 1.25}vw`,
            "--travel-end-y": `${traveler.y * 1.25}vh`,
            "--travel-start-x": `${traveler.x * 0.32}vw`,
            "--travel-start-y": `${traveler.y * 0.32}vh`,
            animationPlayState: hoveredTravelerId === traveler.id || dragging?.id === travelerKey ? "paused" : "running",
          } as CSSProperties}
        >
          <div className={`discovery-traveler-avatar bg-gradient-to-br ${traveler.color}`}>{traveler.initials}</div>
        </div>
        )
      })}

      <div
        className="discovery-pilot"
        onPointerDown={(event) => beginDrag("pilot", event)}
        style={{
          "--pilot-drag-x": `${dragOffsets.pilot?.x ?? 0}px`,
          "--pilot-drag-y": `${dragOffsets.pilot?.y ?? 0}px`,
        } as CSSProperties}
        aria-label={`Your profile, ${name}`}
      >
        <div className="relative rounded-full bg-gradient-to-br from-cyan-200 via-violet-300 to-fuchsia-400 p-[3px] shadow-[0_0_55px_rgba(103,232,249,0.5)]">
          <Avatar className="size-20 border-4 border-slate-950 bg-slate-900 sm:size-24">
            {user?.avatarUrl && <AvatarImage alt={name} src={user.avatarUrl} />}
            <AvatarFallback className="bg-slate-800 text-xl font-semibold text-white">{user ? getUserInitials(user) : "YOU"}</AvatarFallback>
          </Avatar>
        </div>
        <div className="mt-3 text-center">
          <p className="text-sm font-semibold text-white">{name}</p>
          <p className="mt-0.5 text-xs text-cyan-100/75">{user ? getUserHandle(user) : "@current-explorer"}</p>
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-cyan-100"><Sparkles className="size-3 text-cyan-300" /> Piloting</div>
      </div>
    </section>
  )
}
