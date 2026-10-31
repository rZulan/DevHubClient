import {useEffect, useState} from "react"

export function useRetryCountdown(until: number) {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        if (!until) return
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [until])
    return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0
}
