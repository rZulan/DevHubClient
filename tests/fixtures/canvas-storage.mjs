export function canvasStorage(t) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const values = new Map()
    const storage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)}
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: storage})
    t.after(() => {
        if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
        else delete globalThis.localStorage
    })
    return storage
}
