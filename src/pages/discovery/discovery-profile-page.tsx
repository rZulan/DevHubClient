import {ArrowLeft} from "lucide-react"
import {Link, useParams} from "react-router-dom"

import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {Card, CardContent} from "@/components/ui/card"
import {UserAvatar} from "@/components/user-avatar"
import {useDiscoveryProfileQuery} from "@/features/discovery/discovery-api"

export function DiscoveryProfilePage() {
    const viewerId = useAppSelector((state) => state.auth.user?.id)
    const {username} = useParams()
    const {currentData: profile, error, isFetching, refetch} = useDiscoveryProfileQuery(
        {viewerId: viewerId ?? "", username: username ?? ""},
        {skip: !viewerId || !username, refetchOnMountOrArgChange: true},
    )
    const notFound = error && "status" in error && error.status === 404

    return (
        <div className="mx-auto min-h-svh max-w-xl space-y-6 px-5 py-8 sm:py-16">
            <Link className="inline-flex items-center gap-2 text-sm hover:underline" to="/discovery">
                <ArrowLeft className="size-4"/> Back to Discovery
            </Link>
            <Card>
                <CardContent className="flex min-h-28 items-center gap-5">
                    {isFetching && !profile ? (
                        <p role="status">Loading profile…</p>
                    ) : notFound ? (
                        <p role="status">This profile is no longer available.</p>
                    ) : profile ? (
                        <>
                            <UserAvatar className="size-20" user={profile}/>
                            <div className="min-w-0 break-words">
                                <h1 className="text-2xl font-semibold">{`${profile.firstName} ${profile.lastName}`.trim() || profile.username}</h1>
                                <p className="text-muted-foreground">@{profile.username}</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <p role="status">Couldn’t load this profile.</p>
                            <Button onClick={() => void refetch()} variant="outline">Try again</Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
