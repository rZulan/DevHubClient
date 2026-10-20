import {relationshipEndTypes, relationshipEndLabels, type RelationshipEnd} from "./tool-documents"
export function ErdEndSymbol({end}: {end: RelationshipEnd}) {
    const many = end === "many" || end === "zero-many", optional = end === "zero-one" || end === "zero-many"
    return <g className="erd-end-symbol">
        {many ? <path d="M3 -9 L17 0 L3 9 M3 0 H17"/> : <path d="M8 -9 V9"/>}
        {optional ? <circle className="erd-end-open" cx="25" cy="0" r="5"/> : <path d="M25 -9 V9"/>}
    </g>
}
export function RelationshipEndSelect({label, value, onChange, ariaLabel, right = false}: {label: string; value: RelationshipEnd; onChange: (value: RelationshipEnd) => void; ariaLabel?: string; right?: boolean}) {
    return <label>{label}<select aria-label={ariaLabel ?? label} value={value} onChange={event => onChange(event.target.value as RelationshipEnd)}>{relationshipEndTypes.map(end => <option key={end} value={end}>{relationshipEndLabels[end]}</option>)}</select>
        <span className="erd-end-preview"><svg viewBox="0 -12 40 24" aria-hidden="true"><path d="M0 0 H40"/><g transform={right ? "translate(40 0) scale(-1 1)" : undefined}><ErdEndSymbol end={value}/></g></svg></span>
    </label>
}
