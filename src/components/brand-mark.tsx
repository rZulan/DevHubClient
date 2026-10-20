import {cn} from "@/lib/utils"

type BrandMarkProps = {
    className?: string
}

export function BrandMark({className}: BrandMarkProps) {
    return (
        <img
            alt=""
            aria-hidden="true"
            className={cn("shrink-0 object-contain", className)}
            height="64"
            src="/brand/devhub-mark-64.png"
            width="64"
        />
    )
}
