import {api} from "@/services/api"

export type WorkshopLimits = {
    storage: {usedBytes: number; limitBytes: number; warning: boolean; full: boolean}
    canvasWarningObjects: number; canvasMaximumObjects: number; savesPerMinute: number
    createsPerMinute: number; invitesPerUserPerDay: number; invitesPerWorkshopPerDay: number
    maximumMentions: number; chatMessagesPerMinute: number; notificationsPerMinute: number
}
export const workshopLimitsApi = api.injectEndpoints({endpoints: builder => ({
    getWorkshopLimits: builder.query<WorkshopLimits, string>({query: id => `/organizations/${id}/limits`, keepUnusedDataFor: 60}),
})})
export const {useGetWorkshopLimitsQuery} = workshopLimitsApi
