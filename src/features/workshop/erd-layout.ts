import {tableHeight, type ErdDocument} from "./tool-documents.ts"

const tableWidth = 300, columnGap = 200, rowGap = 80, groupGap = 140, maxColumns = 4

/** Arrange graph neighbors in adjacent columns so orthogonal links stay in the gutters. */
export function arrangeErd(document: ErdDocument): ErdDocument {
    if (!document.tables.length) return document
    const tables = new Map(document.tables.map(table => [table.id, table]))
    const neighbors = new Map(document.tables.map(table => [table.id, new Set<string>()]))
    const incoming = new Set<string>()
    for (const relation of document.relationships) {
        if (!tables.has(relation.fromTable) || !tables.has(relation.toTable) || relation.fromTable === relation.toTable) continue
        neighbors.get(relation.fromTable)!.add(relation.toTable)
        neighbors.get(relation.toTable)!.add(relation.fromTable)
        incoming.add(relation.toTable)
    }
    function compare(a: string, b: string) {
        const left = `${tables.get(a)!.name.toLowerCase()}\0${a}`, right = `${tables.get(b)!.name.toLowerCase()}\0${b}`
        return left < right ? -1 : left > right ? 1 : 0
    }
    const ordered = [...tables.keys()].sort(compare), remaining = new Set(ordered)
    const groups: {positions: Map<string, {x: number; y: number}>; width: number; height: number; key: string}[] = []
    while (remaining.size) {
        const ids = [remaining.values().next().value!]
        remaining.delete(ids[0])
        for (let i = 0; i < ids.length; i++) for (const id of neighbors.get(ids[i])!) {
            if (remaining.delete(id)) ids.push(id)
        }
        const root = [...ids].sort((a, b) => neighbors.get(b)!.size - neighbors.get(a)!.size
            || Number(incoming.has(a)) - Number(incoming.has(b)) || compare(a, b))[0]
        const depth = new Map([[root, 0]]), queue = [root], layers: string[][] = []
        for (let i = 0; i < queue.length; i++) {
            const id = queue[i], level = depth.get(id)!
            ;(layers[level] ??= []).push(id)
            for (const next of [...neighbors.get(id)!].sort(compare)) if (!depth.has(next)) {
                depth.set(next, level + 1); queue.push(next)
            }
        }
        // Alternating barycenter sweeps place shared neighbors together and reduce crossings.
        const rank = new Map<string, number>()
        const rankLayer = (layer: string[]) => layer.forEach((id, index) => rank.set(id, (index + .5) / layer.length))
        layers.forEach(rankLayer)
        for (let pass = 0; pass < 6; pass++) {
            const direction = pass % 2 === 0 ? 1 : -1
            for (let level = direction > 0 ? 1 : layers.length - 2; level >= 0 && level < layers.length; level += direction) {
                const score = (id: string) => {
                    const adjacent = [...neighbors.get(id)!].filter(next => depth.get(next) === level - direction)
                    return adjacent.length ? adjacent.reduce((sum, next) => sum + rank.get(next)!, 0) / adjacent.length : rank.get(id)!
                }
                const scores = new Map(layers[level].map(id => [id, score(id)]))
                layers[level].sort((a, b) => scores.get(a)! - scores.get(b)! || compare(a, b))
                rankLayer(layers[level])
            }
        }
        const positions = new Map<string, {x: number; y: number}>()
        let top = 0
        for (let band = 0; band * maxColumns < layers.length; band++) {
            const columns = layers.slice(band * maxColumns, (band + 1) * maxColumns)
            const heights = columns.map(layer => layer.reduce((sum, id) => sum + tableHeight(tables.get(id)!), 0) + (layer.length - 1) * rowGap)
            const height = Math.max(...heights)
            const simpleChain = columns.every(layer => layer.length === 1)
            columns.forEach((layer, index) => {
                const column = band % 2 === 0 ? index : maxColumns - 1 - index
                let y = top + (simpleChain ? 0 : (height - heights[index]) / 2)
                for (const id of layer) {
                    positions.set(id, {x: column * (tableWidth + columnGap), y: Math.round(y)})
                    y += tableHeight(tables.get(id)!) + rowGap
                }
            })
            top += height + groupGap
        }
        // Reserve the right gutter for same-column relationships and self references.
        groups.push({positions, width: Math.min(maxColumns, layers.length) * (tableWidth + columnGap) - columnGap + 120,
            height: top - groupGap, key: [...ids].sort(compare)[0]})
    }
    groups.sort((a, b) => b.positions.size - a.positions.size || compare(a.key, b.key))
    const area = groups.reduce((sum, group) => sum + (group.width + groupGap) * (group.height + groupGap), 0)
    const shelfWidth = Math.max(...groups.map(group => group.width), Math.sqrt(area * 1.5))
    const positions = new Map<string, {x: number; y: number}>()
    let x = 80, y = 80, shelfHeight = 0
    for (const group of groups) {
        if (x > 80 && x - 80 + group.width > shelfWidth) {x = 80; y += shelfHeight + groupGap; shelfHeight = 0}
        for (const [id, position] of group.positions) positions.set(id, {x: x + position.x, y: y + position.y})
        x += group.width + groupGap; shelfHeight = Math.max(shelfHeight, group.height)
    }
    const nextTables = document.tables.map(table => {
        const position = positions.get(table.id)!
        return table.x === position.x && table.y === position.y ? table : {...table, ...position}
    })
    // Manual edge pins would retain detours from the old arrangement. Restore column-row ports.
    const relationships = document.relationships.map(relation => {
        if (!relation.fromAnchor && !relation.toAnchor) return relation
        const {fromAnchor: _from, toAnchor: _to, ...automatic} = relation
        return automatic
    })
    return nextTables.every((table, index) => table === document.tables[index]) && relationships.every((relation, index) => relation === document.relationships[index])
        ? document : {...document, tables: nextTables, relationships}
}
