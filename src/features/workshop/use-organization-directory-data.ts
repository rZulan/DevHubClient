import {useListOrganizationMembersQuery, useListOrganizationRolesQuery, useListTeamsQuery} from "@/services/api"

// These subscribe to the layout's existing cache entries; they do not fetch each team's roster.
export function useOrganizationDirectoryData(organizationId: string, persisted: boolean) {
    const options = {skip: !persisted}
    const teams = useListTeamsQuery(organizationId, options)
    const members = useListOrganizationMembersQuery(organizationId, options)
    const roles = useListOrganizationRolesQuery(organizationId, options)
    return {
        isLoading: teams.isLoading || members.isLoading || roles.isLoading,
        isError: teams.isError || members.isError || roles.isError,
        retry: () => {
            if (!persisted) return
            void teams.refetch(); void members.refetch(); void roles.refetch()
        },
    }
}
