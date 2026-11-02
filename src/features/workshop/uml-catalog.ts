import type {ShapePreset} from "./shape-catalog"

export const umlTypes = [
    {id: "class", label: "Class"}, {id: "sequence", label: "Sequence"}, {id: "use-case", label: "Use Case"},
    {id: "activity", label: "Activity"}, {id: "state-machine", label: "State Machine"}, {id: "component", label: "Component"},
    {id: "deployment", label: "Deployment"}, {id: "object", label: "Object"}, {id: "package", label: "Package"},
    {id: "communication", label: "Communication"}, {id: "timing", label: "Timing"}, {id: "interaction-overview", label: "Interaction Overview"},
    {id: "composite-structure", label: "Composite Structure"}, {id: "profile", label: "Profile"},
] as const
export type UmlType = typeof umlTypes[number]["id"]
export const umlSymbolKinds = ["class", "interface", "enumeration", "actor", "use-case", "boundary", "lifeline", "activation", "fragment", "action", "initial", "final", "flow-final", "decision", "fork", "state", "history", "deep-history", "terminate", "component", "node", "object", "package", "port", "timing", "stereotype", "association", "directed", "generalization", "realization", "dependency", "aggregation", "composition", "include", "extend", "sync", "async", "reply", "note", "constraint", "provided-interface", "required-interface", "artifact", "junction", "entry-point", "exit-point", "send-signal", "accept-event", "time-event", "region", "destruction", "create-message", "destroy-message", "note-link", "extension", "containment"] as const
export type UmlSymbol = typeof umlSymbolKinds[number]
function shape(category: string, symbol: UmlSymbol, label: string, text = label, changes: ShapePreset["changes"] = {}): ShapePreset {
    return {id: `uml-${category}-${symbol}-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g,"-")}`, category, label, kind: "rectangle", changes: {umlSymbol: symbol, text, width: 200, height: 110, appearance: "outlined", cornerRadius: 0, ...changes}}
}
const symbol = (category: string, name: UmlSymbol, label: string) => shape(category, name, label, "", {width: 52, height: 52})
const arrow = (name: UmlSymbol, label: string, text = "") => ({...shape("Connectors & Notation", name, label, text, {width: 200, height: 48, verticalAlign: "top", fontSize: 12, outlineStyle: ["realization","dependency","include","extend","reply","create-message","note-link"].includes(name) ? "dashed" : "solid"}), kind: "arrow" as const})
export const umlPresets: ShapePreset[] = [
    shape("Class", "class", "Class", "Class\n\n- id: UUID\n\n+ operation(): void", {height: 180, fontSize: 14, textAlign: "left", verticalAlign: "top"}),
    shape("Class", "interface", "Interface", "«interface»\nInterface\n+ operation(): void", {height: 160, textAlign: "left", verticalAlign: "top"}),
    shape("Class", "enumeration", "Enumeration", "«enumeration»\nStatus\nPending\nActive\nClosed", {height: 190, textAlign: "left", verticalAlign: "top"}),
    shape("Sequence", "lifeline", "Lifeline", "Participant", {width: 160, height: 480, verticalAlign: "top"}),
    shape("Sequence", "activation", "Activation", "", {width: 24, height: 120}),
    shape("Sequence", "fragment", "Combined fragment", "alt [condition]", {width: 520, height: 300, textAlign: "left", verticalAlign: "top"}),
    shape("Use Case", "actor", "Actor", "Actor", {width: 100, height: 150, verticalAlign: "bottom"}),
    shape("Use Case", "use-case", "Use case", "Use case", {height: 90}),
    shape("Use Case", "boundary", "System boundary", "System", {width: 520, height: 400, verticalAlign: "top", textAlign: "left"}),
    shape("Activity", "action", "Action"), symbol("Activity", "initial", "Initial"), symbol("Activity", "final", "Activity final"),
    symbol("Activity", "flow-final", "Flow final"), shape("Activity", "decision", "Decision", "", {width: 70, height: 70}),
    shape("Activity", "decision", "Merge", "", {width: 50, height: 50}), shape("Activity", "fork", "Fork / join", "", {width: 180, height: 24}),
    shape("Activity", "boundary", "Swimlane", "Responsibility", {width: 320, height: 520, verticalAlign: "top"}),
    shape("State Machine", "state", "State", "State\nentry / action()\ndo / activity()\nexit / cleanup()", {height: 160, textAlign: "left", verticalAlign: "top"}),
    symbol("State Machine", "initial", "Initial"), symbol("State Machine", "final", "Final"), symbol("State Machine", "history", "History"),
    symbol("State Machine", "deep-history", "Deep history"), symbol("State Machine", "terminate", "Terminate"),
    shape("State Machine", "decision", "Choice", "", {width: 60, height: 60}), shape("State Machine", "fragment", "Composite state", "Composite state", {width: 480, height: 320, verticalAlign: "top", textAlign: "left"}),
    shape("Component", "component", "Component", "«component»\nComponent"), shape("Component", "port", "Port", "", {width: 24, height: 24}),
    shape("Deployment", "node", "Node", "«device»\nNode", {width: 220, height: 160}), shape("Deployment", "object", "Artifact", "«artifact»\nApplication"),
    shape("Object", "object", "Object instance", "instance: Class\nattribute = value", {textAlign: "left", verticalAlign: "top", underline: true}),
    shape("Package", "package", "Package", "Package", {width: 280, height: 180}),
    shape("Communication", "object", "Participant", "instance: Class", {underline: true}),
    shape("Timing", "timing", "State timeline", "", {width: 360, height: 160}),
    shape("Interaction Overview", "fragment", "Interaction reference", "ref Interaction", {width: 260, height: 140}),
    shape("Composite Structure", "boundary", "Structured classifier", "Classifier", {width: 440, height: 300, verticalAlign: "top"}),
    shape("Composite Structure", "object", "Part", "part: Type"), shape("Composite Structure", "port", "Port", "", {width: 24, height: 24}),
    shape("Profile", "stereotype", "Stereotype", "«stereotype»\nStereotype"), shape("Profile", "class", "Metaclass", "«metaclass»\nClass", {height: 160}),
    shape("Class", "class", "Association class", "AssociationClass", {height:160}),
    shape("Sequence", "actor", "Actor participant", "Actor", {width:100,height:150,verticalAlign:"bottom"}),
    shape("Sequence", "destruction", "Destruction occurrence", "", {width:32,height:32}),
    shape("Activity", "send-signal", "Send signal", "Signal"), shape("Activity", "accept-event", "Accept event", "Event"),
    shape("Activity", "time-event", "Time event", "", {width:48,height:64}),
    symbol("State Machine", "junction", "Junction"),symbol("State Machine", "entry-point", "Entry point"),symbol("State Machine", "exit-point", "Exit point"),
    shape("State Machine", "fork", "Fork / join", "", {width:180,height:24}),
    shape("State Machine", "region", "Orthogonal region", "Region", {width:420,height:280,verticalAlign:"top"}),
    shape("Component", "provided-interface", "Provided interface", "", {width:60,height:60}),shape("Component", "required-interface", "Required interface", "", {width:60,height:60}),
    shape("Deployment", "artifact", "Artifact", "«artifact»\nApplication", {width:180,height:120}),
    shape("Deployment", "node", "Execution environment", "«executionEnvironment»\nEnvironment", {width:260,height:180}),
    shape("Composite Structure", "provided-interface", "Provided interface", "", {width:60,height:60}),shape("Composite Structure", "required-interface", "Required interface", "", {width:60,height:60}),
    arrow("create-message", "Create message"),arrow("destroy-message", "Destroy message"),arrow("note-link", "Note / constraint link"),arrow("extension", "Profile extension"),arrow("containment", "Package containment"),
    arrow("association", "Association"), arrow("directed", "Directed association / flow"), arrow("generalization", "Generalization"),
    arrow("realization", "Realization"), arrow("dependency", "Dependency"), arrow("aggregation", "Aggregation"), arrow("composition", "Composition"),
    arrow("include", "Include", "«include»"), arrow("extend", "Extend", "«extend»"), arrow("sync", "Synchronous message"),
    arrow("async", "Asynchronous message"), arrow("reply", "Reply"),
    shape("Connectors & Notation", "note", "UML note", "Note", {textAlign: "left", verticalAlign: "top"}),
    shape("Connectors & Notation", "constraint", "Constraint", "{condition}"),
]
export function prioritizedUmlPresets(type: UmlType | null) {
    const preferred = umlTypes.find(t => t.id === type)?.label
    return preferred ? [...umlPresets.filter(p => p.category === preferred), ...umlPresets.filter(p => p.category !== preferred)] : umlPresets
}
