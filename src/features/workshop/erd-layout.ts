import {tableHeight, type ErdDocument} from "./tool-documents.ts"

const tableWidth = 300, columnGap = 200, rowGap = 80, groupGap = 140
type Space = {x: number; y: number; width: number; height: number}

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
    const groups: {positions: Map<string, {x: number; y: number}>; width: number; height: number; key: string; spaces: Space[]}[] = []
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
        // Broad layers need several columns, rather than a tower of siblings beside one hub.
        const area = ids.reduce((sum, id) => sum + (tableWidth + columnGap) * (tableHeight(tables.get(id)!) + rowGap), 0)
        const targetHeight = Math.max(...ids.map(id => tableHeight(tables.get(id)!)), Math.sqrt(area / 1.5))
        const expanded = layers.flatMap(layer => {
            const height = layer.reduce((sum, id) => sum + tableHeight(tables.get(id)!) + rowGap, -rowGap)
            if (height <= targetHeight * 1.4) return [layer]
            const count = Math.ceil(height / targetHeight), limit = (height + rowGap) / count
            const columns: string[][] = [[]]
            let used = 0, remainingHeight = height + rowGap
            for (const id of layer) {
                const size = tableHeight(tables.get(id)!) + rowGap
                if (columns.at(-1)!.length && columns.length < count && used + size / 2 > limit) {columns.push([]); used = 0}
                columns.at(-1)!.push(id); used += size; remainingHeight -= size
                // Keep the last column from absorbing a disproportionate remainder.
                if (columns.length < count && used >= limit && remainingHeight > 0) {columns.push([]); used = 0}
            }
            return columns.filter(column => column.length)
        })
        const maxColumns = expanded.length === layers.length ? 4 : Math.max(4, Math.ceil(Math.sqrt(area * 1.5) / (tableWidth + columnGap)) + layers.length)
        const positions = new Map<string, {x: number; y: number}>(), spaces: Space[] = []
        let top = 0
        for (let band = 0; band * maxColumns < expanded.length; band++) {
            const columns = expanded.slice(band * maxColumns, (band + 1) * maxColumns)
            const heights = columns.map(layer => layer.reduce((sum, id) => sum + tableHeight(tables.get(id)!), 0) + (layer.length - 1) * rowGap)
            const height = Math.max(...heights)
            const simpleChain = columns.every(layer => layer.length === 1)
            columns.forEach((layer, index) => {
                const column = band % 2 === 0 ? index : maxColumns - 1 - index
                let y = top + (simpleChain ? 0 : (height - heights[index]) / 2)
                if (y - top > rowGap) spaces.push({x: column * (tableWidth + columnGap), y: top, width: tableWidth + 120, height: y - top - rowGap})
                for (const id of layer) {
                    positions.set(id, {x: column * (tableWidth + columnGap), y: Math.round(y)})
                    y += tableHeight(tables.get(id)!) + rowGap
                }
                if (top + height - y > 0) spaces.push({x: column * (tableWidth + columnGap), y, width: tableWidth + 120, height: top + height - y})
            })
            top += height + groupGap
        }
        // Reserve the right gutter for same-column relationships and self references.
        groups.push({positions, width: Math.min(maxColumns, expanded.length) * (tableWidth + columnGap) - columnGap + 120,
            height: top - groupGap, key: [...ids].sort(compare)[0], spaces})
    }
    groups.sort((a, b) => b.positions.size - a.positions.size || compare(a.key, b.key))
    const area = groups.reduce((sum, group) => sum + (group.width + groupGap) * (group.height + groupGap), 0)
    const shelfWidth = Math.max(...groups.map(group => group.width), Math.sqrt(area * 1.5))
    const positions = new Map<string, {x: number; y: number}>()
    const spaces: Space[] = []
    let x = 80, y = 80, shelfHeight = 0
    for (const group of groups) {
        // Reuse holes beside short columns before adding another shelf below the diagram.
        const available = spaces.filter(space => space.width >= group.width && space.height >= group.height)
            .sort((a, b) => a.width * a.height - b.width * b.height || a.y - b.y || a.x - b.x)[0]
        if (available) {
            for (const [id, position] of group.positions) positions.set(id, {x: available.x + position.x, y: available.y + position.y})
            spaces.push(...group.spaces.map(space => ({...space, x: space.x + available.x, y: space.y + available.y})))
            available.y += group.height + groupGap; available.height -= group.height + groupGap
            continue
        }
        if (x > 80 && x - 80 + group.width > shelfWidth) {x = 80; y += shelfHeight + groupGap; shelfHeight = 0}
        for (const [id, position] of group.positions) positions.set(id, {x: x + position.x, y: y + position.y})
        spaces.push(...group.spaces.map(space => ({...space, x: x + space.x, y: y + space.y})))
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
