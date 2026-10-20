// Fixture-only endpoints: exercise the real Ideas editor without contacting or changing a project.
import {ideasApi, type IdeasDocument, type IdeasKey} from "@/features/workshop/ideas-api"
import {defaultTextStyle, normalizeCanvasItem} from "@/features/workshop/shape-clipboard"
let document: IdeasDocument = {revision: 1, items: [normalizeCanvasItem({...defaultTextStyle, id: "preview-idea", kind: "note", x: 80, y: 60, width: 320, height: 220, appearance: "fill", fillColor: "#fef3c7", outlineColor: "#c9b880", outlineStyle: "solid", outlineWidth: 1, cornerRadius: 8, text: "", textAlign: "left", verticalAlign: "top", noteHeader: "Plan the next release", noteBody: "Map the experience and share ideas with your team."})]}
ideasApi.injectEndpoints({overrideExisting: true, endpoints: builder => ({
    getIdeas: builder.query<IdeasDocument, IdeasKey>({queryFn: () => ({data: structuredClone(document)})}),
    saveIdeas: builder.mutation<IdeasDocument, IdeasKey & IdeasDocument>({queryFn: input => {
        document = {revision: document.revision + 1, items: structuredClone(input.items)}
        return {data: structuredClone(document)}
    }}),
})})
