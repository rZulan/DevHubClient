/** Column names use 13px type: below 50% they are smaller than 6.5 screen pixels. */
export function isErdTableOverview(zoom: number, selected: boolean) {
    return zoom < .5 && !selected
}
