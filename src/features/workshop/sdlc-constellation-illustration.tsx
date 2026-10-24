import type {SdlcModel} from "./sdlc-models"
import {SdlcWaterfallIllustration} from "./sdlc-waterfall-illustration"

function VModelBird() {
    const wing = "M140 65C134 164 187 204 220 215C156 230 115 207 100 165C107 257 160 299 221 302C170 316 129 305 105 276C145 369 235 392 275 411C301 423 319 447 320 457C295 465 264 451 250 434C289 514 363 511 405 567C435 608 454 642 480 660M140 65C150 146 252 176 315 251C378 327 365 415 434 469C462 493 479 484 482 461"
    return <g className="sdlc-illustration-contour">
        <path d={wing}/><path d={wing} transform="translate(1000 0) scale(-1 1)"/>
        <path d="M500 285C507 319 470 327 479 357C484 374 496 378 500 395C504 378 516 374 521 357C530 327 493 319 500 285M482 389C453 438 451 463 469 506C492 555 497 603 500 660C503 603 508 555 531 506C549 463 547 438 518 389"/>
        <path d="M481 662C461 712 444 750 500 820C556 750 539 712 519 662M500 690V813"/>
        <path className="sdlc-illustration-detail" d="M254 265C309 286 345 326 364 379M746 265C691 286 655 326 636 379"/>
    </g>
}
function AgileHummingbird() {
    return <g className="sdlc-illustration-contour">
        <path d="M195 50C180 158 220 220 300 245C263 256 232 249 210 240C233 311 285 350 350 365C322 372 300 368 280 355C322 434 392 472 500 480C446 459 453 408 430 365C390 242 295 162 245 120C215 95 201 70 195 50Z"/>
        <path d="M535 385C575 366 576 312 625 297C654 283 681 303 701 317C724 332 791 335 865 335L752 346C682 350 655 369 644 424C633 493 611 541 560 575C517 606 472 620 450 635"/>
        <path d="M500 480C432 524 432 578 350 620C285 654 235 722 195 820C249 799 292 767 330 740L310 790C374 757 393 689 450 635"/>
        <path className="sdlc-illustration-detail" d="M350 620C321 678 286 739 245 783M657 329C649 343 670 350 676 337"/>
    </g>
}
export function SdlcConstellationIllustration({model}: {model: Exclude<SdlcModel, "iterative">}) {
    return <svg className={`sdlc-model-art sdlc-art-${model}`} viewBox="0 0 1000 900" fill="none" aria-hidden="true">
        {model === "waterfall" ? <SdlcWaterfallIllustration/> : model === "v-model" ? <VModelBird/> : <AgileHummingbird/>}
    </svg>
}
