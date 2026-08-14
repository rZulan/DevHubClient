import { ArrowLeft, ArrowUpRight, Gauge, X } from "lucide-react"
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
import { createPortal } from "react-dom"
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
const travelerFirstNames = [
  "Mina",
  "Theo",
  "Amara",
  "Jules",
  "Kenji",
  "Nia",
  "Soren",
  "Lina",
  "Ravi",
  "Maeve",
]
const travelerLastNames = [
  "Park",
  "Rivera",
  "Okafor",
  "Dubois",
  "Tanaka",
  "Santos",
  "Nielsen",
  "Kovac",
  "Sharma",
  "Byrne",
]
const travelerTechStacks = [
  ["React", "TypeScript", "Node.js"],
  ["Vue", "Go", "Postgres"],
  ["Next.js", "Python", "AWS"],
  ["Svelte", "Rust", "GraphQL"],
  ["Angular", ".NET", "Azure"],
  ["React Native", "Expo", "Firebase"],
  ["Nuxt", "Laravel", "MySQL"],
  ["SolidJS", "Bun", "Redis"],
]
const travelers = Array.from({ length: 100 }, (_, id) => ({
  avatarUrl: placeholderProfilePictures[id % placeholderProfilePictures.length],
  id,
  duration: 0.82 + randomAt(id + 1) * 0.42,
  fullName: `${travelerFirstNames[id % travelerFirstNames.length]} ${travelerLastNames[Math.floor(id / travelerFirstNames.length) % travelerLastNames.length]}`,
  techStack: travelerTechStacks[id % travelerTechStacks.length],
  username: `${travelerFirstNames[id % travelerFirstNames.length].toLowerCase()}${String(id + 7).padStart(2, "0")}`,
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
const profileHoverExitDelay = 140
const tapMovementThreshold = 6
const compactDiscoveryQuery = "(max-width: 700px), (max-height: 480px) and (pointer: coarse)"

type DragOffset = { x: number; y: number }
type DragSession = {
  element: HTMLElement
  id: string
  lastX: number
  lastY: number
  onPositionChange?: (deltaX: number, deltaY: number) => void
  pointerId: number
  screenDragScale: number | null
  startLeft: number
  startOffset: DragOffset
  startTop: number
  startX: number
  startY: number
}
type BeginDrag = (
  id: string,
  event: PointerEvent<HTMLElement>,
  onPositionChange?: (deltaX: number, deltaY: number) => void,
) => void
type Traveler = (typeof travelers)[number]
type HoveredTraveler = {
  avatarSize: number
  element: HTMLElement
  left: number
  profileOffset: number
  profileTop: number
  side: "left" | "right"
  top: number
  traveler: Traveler
}

export function DiscoveryPage() {
  const sceneRef = useRef<HTMLElement>(null)
  const dragOffsetsRef = useRef<Record<string, DragOffset>>({})
  const dragSessionRef = useRef<DragSession | null>(null)

  const beginDrag = useCallback<BeginDrag>((id, event, onPositionChange) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    delete event.currentTarget.dataset.dragMoved
    event.currentTarget.dataset.dragging = "true"
    const startBounds = event.currentTarget.getBoundingClientRect()
    dragSessionRef.current = {
      element: event.currentTarget,
      id,
      lastX: event.clientX,
      lastY: event.clientY,
      onPositionChange,
      pointerId: event.pointerId,
      screenDragScale: id === "pilot" ? 1 : null,
      startLeft: startBounds.left,
      startOffset: dragOffsetsRef.current[id] ?? { x: 0, y: 0 },
      startTop: startBounds.top,
      startX: event.clientX,
      startY: event.clientY,
    }
  }, [])

  const updateDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    const pointerDeltaX = event.clientX - session.startX
    const pointerDeltaY = event.clientY - session.startY
    const variablePrefix = session.id === "pilot" ? "pilot" : "travel"

    if (Math.hypot(pointerDeltaX, pointerDeltaY) >= tapMovementThreshold) {
      session.element.dataset.dragMoved = "true"
    }

    if (
      session.screenDragScale === null &&
      Math.max(Math.abs(pointerDeltaX), Math.abs(pointerDeltaY)) >= 2
    ) {
      session.element.style.setProperty(
        `--${variablePrefix}-drag-x`,
        `${session.startOffset.x + pointerDeltaX}px`,
      )
      session.element.style.setProperty(
        `--${variablePrefix}-drag-y`,
        `${session.startOffset.y + pointerDeltaY}px`,
      )

      const movedBounds = session.element.getBoundingClientRect()
      const useHorizontalAxis = Math.abs(pointerDeltaX) >= Math.abs(pointerDeltaY)
      const pointerDistance = useHorizontalAxis ? pointerDeltaX : pointerDeltaY
      const screenDistance = useHorizontalAxis
        ? movedBounds.left - session.startLeft
        : movedBounds.top - session.startTop
      const measuredScale = screenDistance / pointerDistance

      if (Number.isFinite(measuredScale) && measuredScale > 0.05) {
        session.screenDragScale = measuredScale
      }
    }

    const screenDragScale = session.screenDragScale ?? 1
    const offset = {
      x: session.startOffset.x + pointerDeltaX / screenDragScale,
      y: session.startOffset.y + pointerDeltaY / screenDragScale,
    }
    session.onPositionChange?.(
      event.clientX - session.lastX,
      event.clientY - session.lastY,
    )
    session.lastX = event.clientX
    session.lastY = event.clientY

    session.element.style.setProperty(`--${variablePrefix}-drag-x`, `${offset.x}px`)
    session.element.style.setProperty(`--${variablePrefix}-drag-y`, `${offset.y}px`)
    dragOffsetsRef.current[session.id] = offset
  }, [])

  const endDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    updateDrag(event)
    delete session.element.dataset.dragging
    delete session.element.dataset.dragMoved
    dragSessionRef.current = null
  }, [updateDrag])

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
      <p aria-hidden="true" className="discovery-mobile-hint">
        Tap a traveler <span>•</span> Drag to reposition
      </p>
      <TravelerStream beginDrag={beginDrag} sceneRef={sceneRef} />
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

function TravelerStream({
  beginDrag,
  sceneRef,
}: {
  beginDrag: BeginDrag
  sceneRef: RefObject<HTMLElement | null>
}) {
  const activeTravelerElementRef = useRef<HTMLElement | null>(null)
  const deactivateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextTravelerIndex = useRef(12)
  const [hoveredTraveler, setHoveredTraveler] = useState<HoveredTraveler | null>(null)
  const [travelerSlots, setTravelerSlots] = useState(() =>
    Array.from({ length: 12 }, (_, index) => ({ delay: -index * 1.8, index })),
  )

  const setScenePaused = useCallback((paused: boolean) => {
    const scene = sceneRef.current
    if (!scene) return

    if (paused) {
      scene.dataset.profileActive = "true"
    } else {
      delete scene.dataset.profileActive
    }
  }, [sceneRef])

  const cancelDeactivation = useCallback(() => {
    if (deactivateTimerRef.current === null) return
    window.clearTimeout(deactivateTimerRef.current)
    deactivateTimerRef.current = null
  }, [])

  const scheduleDeactivation = useCallback((travelerId: number, element: HTMLElement) => {
    cancelDeactivation()
    deactivateTimerRef.current = window.setTimeout(() => {
      delete element.dataset.profileHover
      if (activeTravelerElementRef.current === element) {
        activeTravelerElementRef.current = null
      }
      setHoveredTraveler((current) =>
        current?.traveler.id === travelerId ? null : current,
      )
      setScenePaused(false)
      deactivateTimerRef.current = null
    }, profileHoverExitDelay)
  }, [cancelDeactivation, setScenePaused])

  const dismissActiveTraveler = useCallback(() => {
    cancelDeactivation()
    if (activeTravelerElementRef.current) {
      delete activeTravelerElementRef.current.dataset.profileHover
      activeTravelerElementRef.current = null
    }
    setHoveredTraveler(null)
    setScenePaused(false)
  }, [cancelDeactivation, setScenePaused])

  useLayoutEffect(() => {
    if (
      !hoveredTraveler ||
      !window.matchMedia(compactDiscoveryQuery).matches
    ) {
      return
    }

    function handleTapAway(event: globalThis.PointerEvent) {
      const target = event.target
      if (
        target instanceof Element &&
        (target.closest(".discovery-profile") ||
          target.closest(".discovery-traveler"))
      ) {
        return
      }

      dismissActiveTraveler()
    }

    document.addEventListener("pointerdown", handleTapAway, true)
    return () => document.removeEventListener("pointerdown", handleTapAway, true)
  }, [dismissActiveTraveler, hoveredTraveler])

  const moveHoveredTraveler = useCallback((
    travelerId: number,
    deltaX: number,
    deltaY: number,
  ) => {
    setHoveredTraveler((current) =>
      current?.traveler.id === travelerId
        ? {
            ...current,
            left: current.left + deltaX,
            top: current.top + deltaY,
          }
        : current,
    )
  }, [])

  const activateTraveler = useCallback((traveler: Traveler, element: HTMLElement) => {
    cancelDeactivation()
    if (
      activeTravelerElementRef.current &&
      activeTravelerElementRef.current !== element
    ) {
      delete activeTravelerElementRef.current.dataset.profileHover
    }

    const bounds = element.getBoundingClientRect()
    const rootFontSize = Number.parseFloat(
      window.getComputedStyle(document.documentElement).fontSize,
    )
    const compactViewport = window.matchMedia(compactDiscoveryQuery).matches
    const tabletWidth = 18.5 * rootFontSize
    element.dataset.profileHover = "true"
    activeTravelerElementRef.current = element
    setScenePaused(true)

    setHoveredTraveler({
      avatarSize: bounds.width,
      element,
      left: bounds.left,
      profileOffset: bounds.width * (2.6 / 3.5),
      profileTop: (bounds.height - 9 * rootFontSize) / 2,
      side:
        !compactViewport && bounds.right + tabletWidth > window.innerWidth
          ? "left"
          : "right",
      top: bounds.top,
      traveler,
    })
  }, [cancelDeactivation, setScenePaused])

  useLayoutEffect(() => () => {
    cancelDeactivation()
    setScenePaused(false)
  }, [cancelDeactivation, setScenePaused])

  const replaceTraveler = useCallback((slotToReplace: number) => {
    const nextIndex = nextTravelerIndex.current
    nextTravelerIndex.current = (nextIndex + 1) % travelers.length
    setTravelerSlots((slots) =>
      slots.map((slot, index) =>
        index === slotToReplace ? { delay: 0, index: nextIndex } : slot,
      ),
    )
  }, [])

  return (
    <>
      {travelerSlots.map((slot, slotIndex) => (
        <TravelerAvatar
          beginDrag={beginDrag}
          delay={slot.delay}
          key={travelers[slot.index].id}
          onActivate={activateTraveler}
          onMove={moveHoveredTraveler}
          onScheduleDeactivate={scheduleDeactivation}
          onReplace={replaceTraveler}
          slotIndex={slotIndex}
          traveler={travelers[slot.index]}
        />
      ))}
      {hoveredTraveler &&
        createPortal(
          <TravelerHoverOverlay
            hoveredTraveler={hoveredTraveler}
            key={`${hoveredTraveler.traveler.id}-${hoveredTraveler.side}`}
            onActivate={() => {
              if (window.matchMedia(compactDiscoveryQuery).matches) return
              cancelDeactivation()
              hoveredTraveler.element.dataset.profileHover = "true"
            }}
            onDeactivate={() => {
              if (window.matchMedia(compactDiscoveryQuery).matches) return
              scheduleDeactivation(
                hoveredTraveler.traveler.id,
                hoveredTraveler.element,
              )
            }}
            onDismiss={dismissActiveTraveler}
          />,
          document.body,
        )}
    </>
  )
}

const TravelerAvatar = memo(function TravelerAvatar({
  beginDrag,
  delay,
  onActivate,
  onMove,
  onScheduleDeactivate,
  onReplace,
  slotIndex,
  traveler,
}: {
  beginDrag: BeginDrag
  delay: number
  onActivate: (traveler: Traveler, element: HTMLElement) => void
  onMove: (travelerId: number, deltaX: number, deltaY: number) => void
  onScheduleDeactivate: (travelerId: number, element: HTMLElement) => void
  onReplace: (slotIndex: number) => void
  slotIndex: number
  traveler: Traveler
}) {
  const travelerKey = `traveler-${traveler.id}`

  return (
    <div
      aria-label={`${traveler.fullName}, @${traveler.username}. ${traveler.techStack.join(", ")}`}
      className="discovery-traveler"
      onBlur={(event) => {
        if (window.matchMedia(compactDiscoveryQuery).matches) return
        if (event.currentTarget.dataset.dragging === "true") return
        if (event.currentTarget.matches(":hover")) {
          onActivate(traveler, event.currentTarget)
        } else {
          onScheduleDeactivate(traveler.id, event.currentTarget)
        }
      }}
      onFocus={(event) => {
        if (!window.matchMedia(compactDiscoveryQuery).matches) {
          onActivate(traveler, event.currentTarget)
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        onActivate(traveler, event.currentTarget)
      }}
      onAnimationIteration={() => onReplace(slotIndex)}
      onPointerDown={(event) => {
        beginDrag(travelerKey, event, (deltaX, deltaY) =>
          onMove(traveler.id, deltaX, deltaY),
        )
      }}
      onPointerEnter={(event) => {
        if (!window.matchMedia(compactDiscoveryQuery).matches) {
          onActivate(traveler, event.currentTarget)
        }
      }}
      onPointerLeave={(event) => {
        if (window.matchMedia(compactDiscoveryQuery).matches) return
        if (event.currentTarget.dataset.dragging === "true") return
        if (document.activeElement !== event.currentTarget) {
          onScheduleDeactivate(traveler.id, event.currentTarget)
        }
      }}
      onPointerCancel={(event) => {
        if (!window.matchMedia(compactDiscoveryQuery).matches) {
          onActivate(traveler, event.currentTarget)
        }
      }}
      onPointerUp={(event) => {
        const compactViewport = window.matchMedia(compactDiscoveryQuery).matches
        if (
          compactViewport &&
          event.currentTarget.dataset.dragMoved === "true"
        ) {
          return
        }
        onActivate(traveler, event.currentTarget)
      }}
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
      tabIndex={0}
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

function TravelerHoverOverlay({
  hoveredTraveler,
  onActivate,
  onDeactivate,
  onDismiss,
}: {
  hoveredTraveler: HoveredTraveler
  onActivate: () => void
  onDeactivate: () => void
  onDismiss: () => void
}) {
  const {
    avatarSize,
    left,
    profileOffset,
    profileTop,
    side,
    top,
    traveler,
  } = hoveredTraveler

  return (
    <div
      className="discovery-hover-overlay"
      data-side={side}
      onBlur={onDeactivate}
      onFocus={onActivate}
      onPointerEnter={onActivate}
      onPointerLeave={onDeactivate}
      style={
        {
          "--discovery-hover-avatar-size": `${avatarSize}px`,
          "--discovery-profile-offset": `${profileOffset}px`,
          "--discovery-profile-top": `${profileTop}px`,
          left,
          top,
        } as CSSProperties
      }
    >
      <div
        aria-hidden="true"
        className="discovery-profile-backdrop"
      />
      <div className="discovery-hover-content">
        <TravelerProfileTablet onDismiss={onDismiss} traveler={traveler} />
        <img
          alt=""
          className="discovery-hover-avatar"
          draggable={false}
          src={traveler.avatarUrl}
        />
      </div>
    </div>
  )
}

function TravelerProfileTablet({
  onDismiss,
  traveler,
}: {
  onDismiss: () => void
  traveler: Traveler
}) {
  return (
    <div className="discovery-profile">
      <div className="discovery-profile-rail discovery-profile-rail-top" />
      <div className="discovery-profile-screen">
        <button
          aria-label="Close mini profile"
          className="discovery-profile-close"
          onClick={onDismiss}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
        <div className="discovery-profile-status">
          <span>Traveler // linked</span>
          <i aria-hidden="true" />
        </div>
        <p className="discovery-profile-name">{traveler.fullName}</p>
        <p className="discovery-profile-handle">@{traveler.username}</p>
        <ul className="discovery-profile-stack">
          {traveler.techStack.map((technology) => (
            <li key={technology}>{technology}</li>
          ))}
        </ul>
        <Link
          aria-label={`Visit ${traveler.fullName}'s profile`}
          className="discovery-profile-visit"
          to={`/users/${traveler.username}`}
        >
          Visit profile <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
      <div className="discovery-profile-rail discovery-profile-rail-bottom" />
    </div>
  )
}

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
