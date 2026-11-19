import {api} from "@/services/api"

export type DiscoveryProfile = {
    id: string
    username: string
    firstName: string
    lastName: string
    avatarUrl: string | null
}

type DiscoveryProfilePage = {
    items: DiscoveryProfile[]
    nextCursor: string | null
}

const discoveryApi = api.injectEndpoints({
    endpoints: (builder) => ({
        discoveryProfiles: builder.infiniteQuery<DiscoveryProfilePage, string, string | null>({
            keepUnusedDataFor: 0,
            infiniteQueryOptions: {
                initialPageParam: null,
                getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
            },
            query: ({pageParam}) => ({
                url: "/users/discovery",
                params: pageParam === null ? undefined : {after: pageParam},
            }),
        }),
        discoveryProfile: builder.query<DiscoveryProfile, {viewerId: string; username: string}>({
            query: ({username}) => `/users/profiles/${encodeURIComponent(username)}`,
        }),
    }),
})

export const {useDiscoveryProfileQuery, useDiscoveryProfilesInfiniteQuery} = discoveryApi
