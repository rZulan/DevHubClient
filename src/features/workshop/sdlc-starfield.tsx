type BackgroundStar = {x: number; y: number; radius: number; opacity: number}

function scatterStars(count: number, seed: number, near: boolean): BackgroundStar[] {
    let state = seed
    function random() {
        state = (state + 0x6d2b79f5) | 0
        let value = Math.imul(state ^ state >>> 15, 1 | state)
        value ^= value + Math.imul(value ^ value >>> 7, 61 | value)
        return ((value ^ value >>> 14) >>> 0) / 4294967296
    }
    return Array.from({length: count}, () => ({
        x: random() * 1000,
        y: random() * 650,
        radius: near ? 1 + random() * .6 : .55 + random() * .65,
        opacity: near ? .2 + random() * .24 : .12 + random() * .275,
    }))
}

// Independent random coordinates remove lattice patterns; fixed seeds keep the sky still.
const layers = [
    {name: "far", parallax: .06, stars: scatterStars(100, 0x41c6ce57, false)},
    {name: "near", parallax: .16, stars: scatterStars(24, 0x9e3779b9, true)},
]

export function SdlcStarfield({camera}: {camera: {x: number; y: number}}) {
    return <>{layers.map(layer => <svg key={layer.name} className={`sdlc-starfield sdlc-stars-${layer.name}`}
        viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
        style={{transform: `translate3d(${camera.x * layer.parallax}px, ${camera.y * layer.parallax}px, 0)`}}>
        {layer.stars.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.radius} opacity={star.opacity}/>)}
    </svg>)}</>
}
