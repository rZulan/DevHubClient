import type {ErdDocument} from "./tool-documents.ts"
import type {ErdImageOptions, ErdImagePalette} from "./erd-image-scene.ts"

export type ErdPngRequest = {document: ErdDocument; palette: ErdImagePalette; options: ErdImageOptions}
export type ErdPngResult = {blob: Blob; width: number; height: number}
export type ErdPngMessage = {type: "progress"; percent: number} | ({type: "done"} & ErdPngResult) | {type: "error"; message: string}
