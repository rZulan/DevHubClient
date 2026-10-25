import {useEffect, useId, useImperativeHandle, useMemo, type CSSProperties, type Ref} from "react"
import {Check, Move, Orbit, RotateCcw, ScanEye, View} from "lucide-react"
import type {SdlcPhase} from "./sdlc-models"
import {createTornadoScene, tornadoHue, tornadoLabels, tornadoProjection} from "./tornado-geometry"
import {useTornadoCamera} from "./use-tornado-camera"
import "./iterative-tornado.css"

export type TornadoControls = {fit: () => void; zoom: (factor: number) => void; focus: (cycle: number, phase: number) => void}
type Props = {ref: Ref<TornadoControls>; cycles: number; phases: readonly SdlcPhase[]; currentPhase: number; completed: boolean;
    selectedCycle: number; selectedPhase: number; onSelect: (cycle: number, phase: number) => void; onZoomChange: (zoom: number) => void}
const colorStyle = (hue: number) => ({"--tornado-hue": hue, color: `hsl(${hue} 72% var(--tornado-lightness))`, "--sdlc-ink": "currentColor"} as CSSProperties)

export function IterativeTornado({ref, cycles, phases, currentPhase, completed, selectedCycle, selectedPhase, onSelect, onZoomChange}: Props) {
    const scene = useMemo(() => createTornadoScene(cycles, phases.length), [cycles, phases.length])
    const navigation = useTornadoCamera(scene)
    const {viewport, camera} = navigation
    const starId = useId(), helpId = useId()
    useImperativeHandle(ref, () => ({fit: navigation.fit, zoom: navigation.zoom, focus: navigation.focus}), [navigation.fit, navigation.zoom, navigation.focus])
    useEffect(() => {onZoomChange(camera.zoom)}, [camera.zoom, onZoomChange])
    const rendered = useMemo(() => {
        const project = tornadoProjection(scene, camera, viewport)
        const lines = scene.layers.flatMap(layer => layer.points.slice(1).map((point, index) => {
            const from = project(layer.points[index]), to = project(point)
            const done = layer.cycle < cycles || completed || (index + 1) / (layer.points.length - 1) <= currentPhase / (phases.length - 1)
            return {kind: "line" as const, key: `line-${layer.cycle}-${index}`, layer, from, to, depth: (from.depth + to.depth) / 2, done}
        }))
        const stars = scene.layers.flatMap(layer => layer.phases.map((point, phase) => {
            const projected = project(point)
            const done = layer.cycle < cycles || completed || phase < currentPhase
            return {kind: "star" as const, key: `star-${layer.cycle}-${phase}`, layer, phase, projected, depth: projected.depth, done,
                current: layer.cycle === cycles && phase === currentPhase && !completed}
        }))
        const bridges = scene.layers.slice(1).map((layer, index) => {
            const from = project(scene.layers[index].phases.at(-1)!), to = project(layer.phases[0])
            return {kind: "line" as const, key: `bridge-${layer.cycle}`, layer, from, to, depth: (from.depth + to.depth) / 2, done: true}
        })
        const items = [...lines, ...bridges, ...stars].sort((a, b) => a.depth - b.depth)
        const selectedLayer = scene.layers[selectedCycle - 1] ?? scene.layers.at(-1)!
        const labels = tornadoLabels(selectedLayer.phases.map(project), viewport)
        return {items, labels, guides: scene.guides.map(points => points.map(project))}
    }, [scene, camera, viewport, cycles, currentPhase, completed, phases.length, selectedCycle])
    const legendCycles = [...new Set([selectedCycle, ...Array.from({length: Math.min(7, cycles)}, (_, index) => cycles - Math.min(7, cycles) + index + 1)])].sort((a, b) => a - b)
    const choose = (cycle: number, phase: number) => onSelect(cycle, phase)
    return <div ref={navigation.root} className={`sdlc-viewport tornado-view ${navigation.dragging ? "is-dragging" : ""} mode-${navigation.mode}`}
        tabIndex={0} role="region" aria-label="Iterative tornado 3D canvas" aria-describedby={helpId}
        data-layer-count={cycles} data-yaw={camera.yaw} data-pitch={camera.pitch} data-zoom={camera.zoom} {...navigation.handlers}>
        <svg className="tornado-scene" viewBox={`0 0 ${viewport.width} ${viewport.height}`} aria-label={`${cycles} iteration ${cycles === 1 ? "layer" : "layers"} in a 3D tornado`}>
            <defs><g id={starId}><path d="M0-28L3-8L13-13L8-3L28 0L8 3L13 13L3 8L0 28L-3 8L-13 13L-8 3L-28 0L-8-3L-13-13L-3-8Z" opacity=".3"/><path d="M0-22L4-4L22 0L4 4L0 22L-4 4L-22 0L-4-4Z"/><circle r="3"/></g>
                {scene.layers.map(layer => <radialGradient key={layer.cycle} id={`${starId}-halo-${layer.cycle}`} style={colorStyle(layer.hue)}>
                    <stop offset="0" stopColor="currentColor" stopOpacity=".7"/><stop offset=".3" stopColor="currentColor" stopOpacity=".2"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/>
                </radialGradient>)}
            </defs>
            <g className="tornado-guides" aria-hidden="true">{rendered.guides.map((points, index) => <path key={index} d={points.map((point, i) => `${i ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ")}/>)}</g>
            {rendered.items.map(item => {
                const chosenLayer = item.layer.cycle === selectedCycle
                const depthOpacity = Math.max(.3, Math.min(1, .65 + item.depth / scene.height))
                if (item.kind === "line") return <path key={item.key} className="tornado-segment" data-cycle={item.layer.cycle} data-kind={item.key.startsWith("bridge-") ? "iteration-feedback" : "iteration-flow"}
                    d={`M${item.from.x} ${item.from.y}L${item.to.x} ${item.to.y}`} style={{...colorStyle(item.layer.hue), opacity: (chosenLayer ? item.done ? .95 : .55 : .5) * depthOpacity}}/>
                const {projected, phase} = item
                const selected = chosenLayer && phase === selectedPhase
                const detail = chosenLayer || cycles <= 16
                const starSize = Math.max(3, Math.min(17, (detail ? 11 : 4) * projected.perspective * Math.sqrt(camera.zoom)))
                const state = item.done ? "completed" : item.current ? "current phase" : "upcoming"
                return <g key={item.key} className={`tornado-phase ${selected ? "selected" : ""} ${item.current ? "current" : ""} ${item.done ? "completed" : ""}`}
                    style={colorStyle(item.layer.hue)} transform={`translate(${projected.x} ${projected.y})`} data-cycle={item.layer.cycle} data-phase={phase} data-depth={item.depth.toFixed(3)}
                    role="button" tabIndex={chosenLayer ? 0 : -1} aria-label={`Iteration ${item.layer.cycle}, ${phases[phase].title}, ${state}`} aria-pressed={selected}
                    onClick={() => choose(item.layer.cycle, phase)} onKeyDown={event => {if (event.key === "Enter" || event.key === " ") {event.preventDefault(); event.stopPropagation(); choose(item.layer.cycle, phase)}}}>
                    <title>Iteration {item.layer.cycle} · {phases[phase].title} · {state}</title>
                    <circle className="tornado-hit-target" r={Math.max(14, starSize * 1.6)}/>
                    {selected && <circle className="tornado-selected-ring" r={starSize + 7}/>}
                    <g className={`tornado-star-glow ${phase % 2 ? "alternate" : ""}`} transform={`scale(${starSize / 24})`}><circle className="tornado-star-halo" r="58" fill={`url(#${starId}-halo-${item.layer.cycle})`}/><use href={`#${starId}`}/></g>
                </g>
            })}
            <g className="tornado-labels" aria-hidden="true">{rendered.labels.map(label => {
                const title = `${String(label.index + 1).padStart(2, "0")}  ${phases[label.index].title}`
                const width = title.length * 6.2
                const x = label.side < 0 ? Math.max(width + 10, Math.min(viewport.width - 12, label.x - 22)) : Math.max(12, Math.min(viewport.width - width - 10, label.x + 22))
                return <g key={label.index} className={label.index === selectedPhase ? "selected" : ""} style={colorStyle(tornadoHue(selectedCycle))}>
                    <path d={`M${label.x} ${label.y}L${x + (label.side < 0 ? 5 : -5)} ${label.labelY}`}/>
                    <text x={x} y={label.labelY + 4} textAnchor={label.side < 0 ? "end" : "start"}>{title}</text>
                </g>
            })}</g>
        </svg>
        <div className="tornado-view-badge"><span style={colorStyle(tornadoHue(selectedCycle))}/><span>3D · {cycles} {cycles === 1 ? "layer" : "layers"}</span></div>
        <div className="tornado-toolbar" role="group" aria-label="3D tornado controls">
            <button type="button" aria-pressed={navigation.mode === "orbit"} onClick={() => navigation.setMode("orbit")}><Orbit/>Orbit</button>
            <button type="button" aria-pressed={navigation.mode === "pan"} onClick={() => navigation.setMode("pan")}><Move/>Pan</button>
            <button type="button" aria-label="Front view" title="Front view" onClick={() => navigation.preset("front")}><View/></button>
            <button type="button" aria-label="Top view" title="Top view" onClick={() => navigation.preset("top")}><ScanEye/></button>
            <button type="button" aria-label="Reset 3D view" title="Reset 3D view (Home)" onClick={navigation.reset}><RotateCcw/></button>
        </div>
        <div className="tornado-layer-legend" role="group" aria-label="Iteration layers">
            {legendCycles.map(number => <button type="button" key={number} style={colorStyle(tornadoHue(number))} aria-label={`View iteration ${number} layer`} aria-pressed={number === selectedCycle}
                onClick={() => {choose(number, number === cycles ? currentPhase : phases.length - 1); navigation.focus(number, number === cycles ? currentPhase : phases.length - 1)}}><i/>{number}{number < cycles && <Check/>}</button>)}
        </div>
        <p id={helpId} className="sr-only">Drag to orbit in three dimensions. Shift-drag, right-drag or Pan mode moves the view. Scroll to zoom. On touch screens, use two fingers to pan and pinch to zoom. Arrow keys rotate; Shift with arrow keys pans. Plus and minus zoom. Home resets the view. Select an iteration star to inspect its phase and notes.</p>
    </div>
}
