import type {CSSProperties} from "react"
import type {DesignLayer} from "./design-document"

export function designShapeStyle(layer: DesignLayer): CSSProperties {
    return {width: "100%", height: "100%", boxSizing: "border-box", backgroundColor: layer.kind === "text" ? "transparent" : layer.fill,
        backgroundImage: layer.image ? `url("${layer.image}")` : undefined, backgroundSize: layer.imageFit ?? "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
        border: `${layer.strokeWidth}px solid ${layer.stroke}`, borderRadius: layer.kind === "ellipse" ? "50%" : layer.radius,
        color: layer.textColor, fontFamily: `${layer.fontFamily ?? "Geist Variable"}, sans-serif`, fontSize: layer.fontSize,
        fontWeight: layer.fontWeight ?? (layer.kind === "button" ? 600 : 400), textAlign: layer.textAlign ?? (layer.kind === "button" ? "center" : "left"),
        lineHeight: layer.lineHeight ?? 1.4, boxShadow: layer.shadow ? "0 8px 24px #18213b14, 0 2px 6px #18213b08" : undefined,
        display: "flex", flexDirection: "column", justifyContent: layer.kind === "button" ? "center" : "flex-start",
        padding: layer.kind === "text" || layer.kind === "frame" || !layer.text ? 0 : layer.kind === "button" ? "0 12px" : "12px",
        whiteSpace: "pre-wrap", overflow: "hidden", overflowWrap: "anywhere"}
}
