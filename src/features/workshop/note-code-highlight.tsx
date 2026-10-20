import {Fragment} from "react"
import type {CodeTokens} from "./shiki-highlighter.ts"

export function NoteCodeTokens({tokens, source}: {tokens: CodeTokens | null; source: string}) {
    return tokens ? tokens.map((line, lineIndex) => <Fragment key={lineIndex}><span className="line">{line.map((token, tokenIndex) => {
        const style = token.fontStyle ?? 0
        return <span key={tokenIndex} style={{color: token.color, fontStyle: style & 1 ? "italic" : undefined, fontWeight: style & 2 ? 700 : undefined, textDecoration: style & 4 ? "underline" : undefined}}>{token.content}</span>
    })}</span>{lineIndex < tokens.length - 1 ? "\n" : null}</Fragment>) : source
}
