import {useEffect, useId, useState} from "react"
import {waterfallMarble, waterfallRotation} from "./sdlc-waterfall-geometry"

// Water is seen from the front in two connected cascades.
const falls = [
    {left: 338, right: 495, top: 220, bottom: 402},
    {left: 552, right: 713, top: 455, bottom: 652},
]
// The first curtain and river share one silhouette, including the flared base.
const upperCascadeFill = "M338 220Q403 211 495 220C483 270 489 356 517 402C552 406 568 427 609 431C650 435 681 442 713 455Q633 446 552 455C514 457 493 440 452 440C394 445 329 429 312 402C347 347 348 273 338 220Z"
const upperCascadeBanks = "M495 220C483 270 489 356 517 402C552 406 568 427 609 431C650 435 681 442 713 455M338 220C348 273 347 347 312 402C329 429 394 445 452 440C493 440 514 457 552 455"
// The inlet shares the first waterfall's lip so the water meets without a gap.
const topRiverFill = "M180 80C230 105 260 138 305 151C330 160 353 153 375 170C410 195 457 187 495 220Q403 211 338 220C302 210 267 221 240 209C208 198 174 208 145 185Z"
const topRiverBanks = "M180 80C230 105 260 138 305 151C330 160 353 153 375 170C410 195 457 187 495 220M145 185C174 208 208 198 240 209C267 221 302 210 338 220"
const topRiverCurrents = [
    "M242 164C281 185 310 171 340 190C371 207 401 198 445 211",
    "M225 188C266 205 286 195 318 205C343 216 365 207 393 215",
]
const lakeLeftBank = "M120 674L169 665L207 672L235 663L275 676L307 671L346 675L378 663L415 670L453 665L476 669L505 659L526 652"
const lakeRightBank = "M735 652L765 658L788 654L817 670L848 665L871 672L900 665"
const lakeShore = `${lakeLeftBank}Q632.5 676 735 652${lakeRightBank.slice("M735 652".length)}`
const cliffInk = "color-mix(in oklab, #ad9273 78%, var(--foreground))"
const riverBanks = "M517 402C552 406 568 427 609 431C650 435 681 442 713 455M312 402C329 429 394 445 452 440C493 440 514 457 552 455"
const riverBankMargins = [
    "M517 402C552 406 568 427 609 431C650 435 681 442 713 455L718 446C683 432 651 426 610 422C570 418 554 397 521 393Z",
    "M312 402C329 429 394 445 452 440C493 440 514 457 552 455L550 464C512 466 491 449 452 449C392 454 325 437 305 407Z",
]
const lakeRipples = [
    "M235 718Q259 729 284 720T333 725",
    "M415 710Q440 718 466 711M754 704Q777 710 796 703",
    "M470 744Q500 735 530 746T596 742",
    "M298 763Q318 769 340 762T384 766",
    "M627 775Q653 781 680 773T728 778",
    "M407 798Q430 806 454 799T498 802",
    "M548 819Q570 824 590 818",
]
const lakeWaveFrames = lakeRipples.map((source, index) => Array.from({length: 9}, (_, frame) => {
    const phase = frame * Math.PI / 4 + index * .8
    return source.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, horizontal: string, vertical: string) =>
        `${horizontal} ${(Number(vertical) + Math.sin(Number(horizontal) / 34 - phase) * 3).toFixed(2)}`)
}))
// Trace the marked ledges across the circle, ending at the water's shared edges.
const cliffLedges = [
    "M100 220L147 216L174 224L208 215L232 222L260 213L288 221L312 218L326 223L338 220M495 220L529 215L550 224L575 219L596 230L627 218L651 221L670 213L696 225L735 223L762 229L788 220L815 228L851 224L876 232L900 230",
    "M100 402L137 396L161 403L190 393L216 400L242 396L265 402L286 392L312 402M517 402L542 397L562 410L589 403L612 412L636 406L657 416L681 405L710 412L739 407L761 417L789 410L817 415L843 406L866 419L900 412",
    "M100 473L131 464L156 476L185 465L213 471L234 465L256 478L283 471L302 478L326 469L350 480L377 467L400 475L424 466L449 472L475 460L496 467L527 458L552 455M713 455L739 460L766 472L789 465L810 475L830 468L855 478L878 471L900 474",
]
const cliffDetails = [
    "M168 324L180 319L190 331L208 328M222 291L238 299L251 288L274 293",
    "M625 326L643 328L655 318L674 331L694 335L710 327L734 334",
    "M308 562L329 558L343 569L368 570M466 525L479 517L489 528L502 528",
    "M796 561L809 553L823 566L844 568",
    "M260 213L256 232L263 242M596 230L592 248L602 256M762 229L759 245L768 251",
    "M185 465L181 486L191 495M400 475L396 493L404 504M789 465L785 486L794 498",
]
// Reuse the ledge vertices so shading meets the existing rock and water edges.
function reverseLedge(source: string) {
    return (source.match(/-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/g) ?? []).reverse().map(point => `L${point}`).join("")
}
const ledgeSides = cliffLedges.map(source => source.split(/(?=M)/))
const cliffFaces = [
    `${ledgeSides[0][0]}C348 273 347 347 312 402${reverseLedge(ledgeSides[1][0])}Z`,
    `${ledgeSides[0][1]}${reverseLedge(ledgeSides[1][1])}C489 356 483 270 495 220Z`,
    `${ledgeSides[2][0]}C562 508 561 597 526 652${reverseLedge(lakeLeftBank)}Z`,
    `${ledgeSides[2][1]}${reverseLedge(lakeRightBank)}C707 606 701 505 713 455Z`,
]
const upperPlateau = `M100 40H900V230${reverseLedge(ledgeSides[0][1])}L338 220${reverseLedge(ledgeSides[0][0])}Z`
const riverTerraces = [
    `${ledgeSides[1][0]}C329 429 394 445 452 440C493 440 514 457 552 455${reverseLedge(ledgeSides[2][0])}Z`,
    `${ledgeSides[1][1]}${reverseLedge(ledgeSides[2][1])}C681 442 650 435 609 431C568 427 552 406 517 402Z`,
]

/** Falling curtains, a connecting river and spray define the cascade. */
export function SdlcWaterfallIllustration() {
    const boundary = useId()
    const water = useId()
    const lake = useId()
    const stone = useId()
    const meadow = useId()
    const terrace = useId()
    const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    useEffect(() => {
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () => setReducedMotion(preference.matches)
        preference.addEventListener("change", update); update()
        return () => preference.removeEventListener("change", update)
    }, [])
    const {x, y, radius} = waterfallMarble
    return <>
        <defs>
            <linearGradient id={water} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
                <stop stopColor="currentColor" stopOpacity=".22"/>
                <stop offset=".55" stopColor="currentColor" stopOpacity=".07"/>
                <stop offset="1" stopColor="currentColor" stopOpacity=".24"/>
            </linearGradient>
            <linearGradient id={stone} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor={cliffInk} stopOpacity=".28"/>
                <stop offset=".3" stopColor={cliffInk} stopOpacity=".1"/>
                <stop offset="1" stopColor={cliffInk} stopOpacity=".3"/>
            </linearGradient>
            <linearGradient id={meadow} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#427450" stopOpacity=".12"/>
                <stop offset="1" stopColor="#6c9753" stopOpacity=".3"/>
            </linearGradient>
            <linearGradient id={terrace} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#879071" stopOpacity=".36"/>
                <stop offset="1" stopColor="#596a48" stopOpacity=".26"/>
            </linearGradient>
            <linearGradient id={lake} x1="0" y1="650" x2="0" y2="840" gradientUnits="userSpaceOnUse">
                <stop stopColor="currentColor" stopOpacity=".14"/>
                <stop offset="1" stopColor="currentColor" stopOpacity=".035"/>
            </linearGradient>
            <clipPath id={boundary}>
                <circle cx={x} cy={y} r={radius}/>
            </clipPath>
        </defs>
        <g className="sdlc-illustration-contour" style={{color: "var(--sdlc-ink)", opacity: .7}} fill="none" transform={`rotate(${waterfallRotation} ${x} ${y})`}>
            <g clipPath={`url(#${boundary})`}>
                <path d={upperPlateau} fill={`url(#${meadow})`} stroke="none"/>
                <g stroke="none">
                    {cliffFaces.map(d => <path key={d} d={d} fill={`url(#${stone})`}/>)}
                </g>
                <g stroke="none" fill={`url(#${terrace})`}>
                    {riverTerraces.map(d => <path key={d} d={d}/>)}
                </g>
                <g stroke={cliffInk} strokeWidth="3" opacity=".85" strokeLinejoin="miter" strokeLinecap="butt">
                    {cliffLedges.map(d => <path key={d} d={d}/>)}
                </g>
                <g stroke={cliffInk} strokeWidth="1.8" opacity=".65" strokeLinejoin="miter" strokeLinecap="butt">
                    {cliffDetails.map(d => <path key={d} d={d}/>)}
                </g>
                <path d={topRiverFill} fill={`url(#${water})`} stroke="none"/>
                <path d={topRiverBanks} stroke={cliffInk} strokeWidth="3" opacity=".85"/>
                {topRiverCurrents.map((d, index) => <g key={d}>
                    <path d={d} strokeWidth="1.5" opacity=".3"/>
                    <path d={d} strokeWidth="2" strokeDasharray="18 35 9 27" opacity=".65">
                        {!reducedMotion && <animate attributeName="stroke-dashoffset" from="89" to="0" dur={`${3 + index}s`} repeatCount="indefinite"/>}
                    </path>
                </g>)}
                <path d={`${lakeShore}L900 860H100Z`} fill={`url(#${lake})`} stroke="none"/>
                <path d={`${lakeLeftBank}${lakeRightBank}`} stroke={cliffInk} strokeWidth="3" opacity=".85" strokeLinejoin="miter" strokeLinecap="butt"/>
                <g strokeWidth="2" opacity=".65">
                    {lakeRipples.map((d, index) => <path key={d} d={d}>
                        {!reducedMotion && <>
                            <animate attributeName="d" values={lakeWaveFrames[index].join(";")} dur={`${6 + index % 3}s`} begin={`${-index}s`} repeatCount="indefinite"/>
                            <animateTransform attributeName="transform" type="translate" values="-8 0;0 3;8 0;0 -3;-8 0" keyTimes="0;.25;.5;.75;1" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1" dur={`${8 + index % 3}s`} begin={`${-index}s`} repeatCount="indefinite"/>
                            <animate attributeName="opacity" values=".45;.9;.45" dur={`${5 + index % 3}s`} begin={`${-index}s`} repeatCount="indefinite"/>
                        </>}
                    </path>)}
                </g>
                <path stroke="none" fill={`url(#${water})`} d={upperCascadeFill}/>
                <path strokeWidth="2.5" opacity=".75" d={upperCascadeBanks}/>
                <g stroke="none" fill={cliffInk} opacity=".13">
                    {riverBankMargins.map(d => <path key={d} d={d}/>)}
                </g>
                <path d={riverBanks} stroke={cliffInk} strokeWidth="3" opacity=".85"/>
                {["M360 410C406 424 468 407 511 422C547 436 565 436 594 439C625 442 652 443 675 450", "M347 418C388 437 429 432 469 432C506 434 525 447 557 445C585 445 612 450 638 451"].map((d, index) => <g key={d}>
                    <path d={d} strokeWidth="1.5" opacity=".3"/>
                    <path d={d} strokeWidth="2" strokeDasharray="18 35 9 27" opacity=".65">
                        {!reducedMotion && <animate attributeName="stroke-dashoffset" from="89" to="0" dur={`${3 + index}s`} repeatCount="indefinite"/>}
                    </path>
                </g>)}
                {falls.map(({left, right, top, bottom}, tier) => <g key={tier}>
                    {tier !== 0 && <path fill={`url(#${water})`} stroke="none" d={`M${left} ${top} Q${left + 65} ${top - 9} ${right} ${top} C${right - 12} ${top + 50} ${right - 6} ${bottom - 46} ${right + 22} ${bottom} Q${(left + right) / 2} ${bottom + 24} ${left - 26} ${bottom} C${left + 9} ${bottom - 55} ${left + 10} ${top + 53} ${left} ${top}Z`}/>}
                    <path strokeWidth="3.5" opacity=".9" d={`M${left - 5} ${top} Q${(left + right) / 2} ${top - 10} ${right + 4} ${top}`}/>
                    {Array.from({length: 18}, (_, index) => {
                        const x = left + 5 + index * (right - left - 10) / 17
                        const end = bottom - 6 - (index % 4) * 9
                        const d = `M${x} ${top + 8 + index % 3 * 5} C${x + 6} ${top + 55} ${x - 9} ${end - 40} ${x + (index - 8) * 1.8} ${end}`
                        return <g key={index}>
                            <path d={d} strokeWidth={index % 3 ? 1.3 : 2.6} opacity={index % 3 ? .24 : .55}/>
                            <path d={d} strokeWidth="2" strokeDasharray="9 47 18 65" opacity=".55">
                                {!reducedMotion && <animate attributeName="stroke-dashoffset" from="139" to="0" dur={`${1.5 + index % 5 * .18}s`} repeatCount="indefinite"/>}
                            </path>
                        </g>
                    })}
                    <g strokeWidth="1.8" opacity=".7">
                        {tier !== 0 && <>
                            <ellipse cx={(left + right) / 2} cy={bottom + 9} rx="103" ry="16" opacity=".4"/>
                            <path d={`M${left - 42} ${bottom + 23} Q${(left + right) / 2} ${bottom + 64} ${right + 48} ${bottom + 20}M${left - 22} ${bottom + 39} Q${(left + right) / 2} ${bottom + 66} ${right + 19} ${bottom + 38}`}/>
                        </>}
                        {Array.from({length: 26}, (_, index) => {
                            const x = left - 22 + index * (right - left + 44) / 25
                            const y = bottom - 4 - Math.sin(index * 2.4) ** 2 * 24
                            return <circle key={index} cx={x} cy={y} r={index % 3 === 0 ? 2.7 : 1.5} fill="currentColor" stroke="none" opacity={.35 + index % 3 * .2}/>
                        })}
                    </g>
                </g>)}
            </g>
            <circle cx={x} cy={y} r={radius} strokeWidth="6.5" opacity=".9"/>
        </g>
    </>
}
