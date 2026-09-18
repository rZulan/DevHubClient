import type { RichTextRun } from "../shape-clipboard"
import { shapeFontStack } from "../shape-fonts"

export function RichTextContent({ runs }: { runs: RichTextRun[] }) {
  return <>{runs.map((run, index) => <span
    data-rich-run="true"
    data-bold={run.bold}
    data-italic={run.italic}
    data-underline={run.underline}
    data-strikethrough={run.strikethrough}
    data-font-family={run.fontFamily}
    data-font-size={run.fontSize}
    data-text-color={run.textColor}
    data-letter-spacing={run.letterSpacing}
    key={index}
    style={{
      fontWeight: run.bold ? 700 : 400,
      fontStyle: run.italic ? "italic" : "normal",
      textDecoration: [run.underline ? "underline" : "", run.strikethrough ? "line-through" : ""].filter(Boolean).join(" ") || "none",
      fontFamily: run.fontFamily ? shapeFontStack(run.fontFamily) : undefined,
      fontSize: run.fontSize,
      color: run.textColor && run.textColor !== "auto" ? run.textColor : undefined,
      letterSpacing: run.letterSpacing,
    }}
  >{run.text}</span>)}</>
}
