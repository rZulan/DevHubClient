import {api} from "@/services/api"
import type {NotificationPage} from "./notifications"

type Scope = {organizationId: string; userId: string}
export const notificationsApi = api.enhanceEndpoints({addTagTypes: ["Notifications"]}).injectEndpoints({endpoints: builder => ({
    notifications: builder.infiniteQuery<NotificationPage, Scope & {unreadOnly: boolean}, number | null>({
        infiniteQueryOptions: {initialPageParam: null, getNextPageParam: last => last.nextCursor ?? undefined},
        query: ({queryArg, pageParam}) => {
            const params = new URLSearchParams({unreadOnly: String(queryArg.unreadOnly)})
            if (pageParam !== null) params.set("before", String(pageParam))
            return `/organizations/${queryArg.organizationId}/notifications?${params}`
        },
        providesTags: (_data, _error, scope) => [{type: "Notifications", id: scope.organizationId}],
    }),
    readNotification: builder.mutation<void, Scope & {id: number}>({
        query: ({organizationId, id}) => ({url: `/organizations/${organizationId}/notifications/${id}/read`, method: "PUT"}),
        invalidatesTags: (_data, _error, scope) => [{type: "Notifications", id: scope.organizationId}],
    }),
    readAllNotifications: builder.mutation<void, Scope & {throughId: number}>({
        query: ({organizationId, throughId}) => ({url: `/organizations/${organizationId}/notifications/read-all`, method: "PUT", body: {throughId}}),
        invalidatesTags: (_data, _error, scope) => [{type: "Notifications", id: scope.organizationId}],
    }),
})})
export const {useNotificationsInfiniteQuery, useReadNotificationMutation, useReadAllNotificationsMutation} = notificationsApi
