import { ArrowLeft, Gauge } from "lucide-react"
import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from "react"
import { Link } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getUserHandle, getUserInitials } from "@/features/auth/user-display"

const placeholderProfilePictures = Array.from(
  { length: 24 },
  (_, index) => `/avatars/discovery/profile-${String(index + 1).padStart(2, "0")}.png`,
)
const randomAt = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}
const travelers = Array.from({ length: 100 }, (_, id) => ({
  avatarUrl: placeholderProfilePictures[id % placeholderProfilePictures.length],
  id,
  duration: 0.82 + randomAt(id + 1) * 0.42,
  x: (randomAt(id + 13) * 2 - 1) * 80,
  y: (randomAt(id + 37) * 2 - 1) * 68,
}))
const defaultFlightSpeed = 30
const flightSpeedStorageKey = "devhub.discovery.flight-speed.v2"
const controlledFlightAnimations = new Set([
  "discovery-flyby",
  "discovery-mesh-forward",
])
const meshSpeedMultiplier = 5

type DragOffset = { x: number; y: number }
type DragSession = {
  element: HTMLElement
  id: string
  pointerId: number
  startOffset: DragOffset
  startX: number
  startY: number
}
type BeginDrag = (id: string, event: PointerEvent<HTMLElement>) => void

export function DiscoveryPage() {
  const sceneRef = useRef<HTMLElement>(null)
  const dragOffsetsRef = useRef<Record<string, DragOffset>>({})
  const dragSessionRef = useRef<DragSession | null>(null)

  const beginDrag = useCallback<BeginDrag>((id, event) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.dataset.dragging = "true"
    dragSessionRef.current = {
      element: event.currentTarget,
      id,
      pointerId: event.pointerId,
      startOffset: dragOffsetsRef.current[id] ?? { x: 0, y: 0 },
      startX: event.clientX,
      startY: event.clientY,
    }
  }, [])

  const updateDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    const offset = {
      x: session.startOffset.x + event.clientX - session.startX,
      y: session.startOffset.y + event.clientY - session.startY,
    }
    dragOffsetsRef.current[session.id] = offset

    const variablePrefix = session.id === "pilot" ? "pilot" : "travel"
    session.element.style.setProperty(`--${variablePrefix}-drag-x`, `${offset.x}px`)
    session.element.style.setProperty(`--${variablePrefix}-drag-y`, `${offset.y}px`)
  }, [])

  const endDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    delete session.element.dataset.dragging
    dragSessionRef.current = null
  }, [])

  return (
    <section
      aria-label="Discovery space"
      className="discovery-flight"
      onPointerCancel={endDrag}
      onPointerMove={updateDrag}
      onPointerUp={endDrag}
      ref={sceneRef}
    >
      <div className="discovery-stars" aria-hidden="true" />
      <div className="discovery-aurora" />
      <div className="discovery-forward-mesh" aria-hidden="true" />

      <Link className="discovery-back" to="/">
        <ArrowLeft className="size-4" /> Back to home
      </Link>

      <FlightSpeedControl sceneRef={sceneRef} />
      <TravelerStream beginDrag={beginDrag} />
      <DiscoveryPilot beginDrag={beginDrag} />
    </section>
  )
}

function FlightSpeedControl({ sceneRef }: { sceneRef: RefObject<HTMLElement | null> }) {
  const [speed, setSpeed] = useState(getInitialFlightSpeed)

  useLayoutEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const travelerPlaybackRate = speed / 50

    updateFlightPlaybackRate(
      scene.getAnimations({ subtree: true }),
      travelerPlaybackRate,
    )
    window.localStorage.setItem(flightSpeedStorageKey, String(speed))

    function handleAnimationStart(event: AnimationEvent) {
      if (
        !controlledFlightAnimations.has(event.animationName) ||
        !(event.target instanceof Element)
      ) {
        return
      }

      updateFlightPlaybackRate(
        event.target.getAnimations({ subtree: true }),
        travelerPlaybackRate,
      )
    }

    scene.addEventListener("animationstart", handleAnimationStart)
    return () => scene.removeEventListener("animationstart", handleAnimationStart)
  }, [sceneRef, speed])

  return (
    <label className="discovery-speed-control">
      <span>
        <Gauge className="size-4" /> Flight speed <b>{speed}%</b>
      </span>
      <input
        aria-label="Flight speed"
        max="100"
        min="0"
        onChange={(event) => setSpeed(Number(event.target.value))}
        type="range"
        value={speed}
      />
    </label>
  )
}

function updateFlightPlaybackRate(
  animations: Animation[],
  travelerPlaybackRate: number,
) {
  animations.forEach((animation) => {
    if (
      animation instanceof CSSAnimation &&
      controlledFlightAnimations.has(animation.animationName)
    ) {
      const playbackRate =
        animation.animationName === "discovery-mesh-forward"
          ? travelerPlaybackRate * meshSpeedMultiplier
          : travelerPlaybackRate

      animation.updatePlaybackRate(playbackRate)
    }
  })
}

function getInitialFlightSpeed() {
  const savedValue = window.localStorage.getItem(flightSpeedStorageKey)
  if (savedValue === null) return defaultFlightSpeed

  const savedSpeed = Number(savedValue)
  return Number.isFinite(savedSpeed) && savedSpeed >= 0 && savedSpeed <= 100
    ? savedSpeed
    : defaultFlightSpeed
}

function TravelerStream({ beginDrag }: { beginDrag: BeginDrag }) {
  const nextTravelerIndex = useRef(12)
  const [travelerSlots, setTravelerSlots] = useState(() =>
    Array.from({ length: 12 }, (_, index) => ({ delay: -index * 1.8, index })),
  )

  const replaceTraveler = useCallback((slotToReplace: number) => {
    const nextIndex = nextTravelerIndex.current
    nextTravelerIndex.current = (nextIndex + 1) % travelers.length
    setTravelerSlots((slots) =>
      slots.map((slot, index) =>
        index === slotToReplace ? { delay: 0, index: nextIndex } : slot,
      ),
    )
  }, [])

  return travelerSlots.map((slot, slotIndex) => (
    <TravelerAvatar
      beginDrag={beginDrag}
      delay={slot.delay}
      key={travelers[slot.index].id}
      onReplace={replaceTraveler}
      slotIndex={slotIndex}
      traveler={travelers[slot.index]}
    />
  ))
}

const TravelerAvatar = memo(function TravelerAvatar({
  beginDrag,
  delay,
  onReplace,
  slotIndex,
  traveler,
}: {
  beginDrag: BeginDrag
  delay: number
  onReplace: (slotIndex: number) => void
  slotIndex: number
  traveler: (typeof travelers)[number]
}) {
  const travelerKey = `traveler-${traveler.id}`

  return (
    <div
      className="discovery-traveler"
      onAnimationIteration={() => onReplace(slotIndex)}
      onPointerDown={(event) => beginDrag(travelerKey, event)}
      style={
        {
          "--travel-drag-x": "0px",
          "--travel-drag-y": "0px",
          "--travel-delay": `${delay}s`,
          "--travel-duration": `${traveler.duration}`,
          "--travel-end-x": `${traveler.x * 1.25}vw`,
          "--travel-end-y": `${traveler.y * 1.25}vh`,
          "--travel-start-x": `${traveler.x * 0.32}vw`,
          "--travel-start-y": `${traveler.y * 0.32}vh`,
        } as CSSProperties
      }
    >
      <img
        alt=""
        className="discovery-traveler-avatar"
        draggable={false}
        src={traveler.avatarUrl}
      />
    </div>
  )
})

const DiscoveryPilot = memo(function DiscoveryPilot({ beginDrag }: { beginDrag: BeginDrag }) {
  const user = useAppSelector((state) => state.auth.user)
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : "You"

  return (
    <div
      aria-label={`Your profile, ${name}`}
      className="discovery-pilot"
      onPointerDown={(event) => beginDrag("pilot", event)}
      style={
        {
          "--pilot-drag-x": "0px",
          "--pilot-drag-y": "0px",
        } as CSSProperties
      }
    >
      <div className="discovery-pilot-avatar relative rounded-full bg-gradient-to-br from-cyan-200 via-violet-300 to-fuchsia-400 p-[3px] shadow-[0_0_55px_rgba(103,232,249,0.5)]">
        <Avatar className="size-20 border-4 border-slate-950 bg-slate-900 sm:size-24">
          {user?.avatarUrl && <AvatarImage alt={name} src={user.avatarUrl} />}
          <AvatarFallback className="bg-slate-800 text-xl font-semibold text-white">
            {user ? getUserInitials(user) : "YOU"}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="mt-3 text-center">
        <p className="text-sm font-semibold text-white">{name}</p>
        <p className="mt-0.5 text-xs text-cyan-100/75">
          {user ? getUserHandle(user) : "@current-explorer"}
        </p>
      </div>
    </div>
  )
})
