import {createContext, type ReactNode, useCallback, useContext, useMemo, useState,} from "react"

import {useAppDispatch, useAppSelector} from "@/app/hooks"
import {createWorkshopOrganization, seedOrganizations,} from "@/features/workshop/workshop-data"
import type {
    ApiOrganization,
    WorkshopOrganization,
    WorkshopProject,
    WorkshopRole,
    WorkshopTask,
    WorkshopTaskStatus,
    WorkshopTeam,
} from "@/features/workshop/workshop-types"
import {api, useListOrganizationsQuery} from "@/services/api"

type WorkshopContextValue = {
    organizations: WorkshopOrganization[]
    isLoading: boolean
    addLocalOrganization: (organization: ApiOrganization) => WorkshopOrganization
    removeLocalOrganization: (organizationId: string) => void
    organizationById: (organizationId: string) => WorkshopOrganization | undefined
    moveTask: (organizationId: string, taskId: string, status: WorkshopTaskStatus) => void
    addTask: (organizationId: string, task: WorkshopTask) => void
    addTeam: (organizationId: string, team: WorkshopTeam) => void
    addProject: (organizationId: string, project: WorkshopProject) => void
    updateProject: (organizationId: string, project: WorkshopProject) => void
    saveRoles: (organizationId: string, roles: WorkshopRole[]) => void
}

const WorkshopContext = createContext<WorkshopContextValue | null>(null)

export function WorkshopProvider({children}: { children: ReactNode }) {
    const dispatch = useAppDispatch()
    const user = useAppSelector((state) => state.auth.user)
    const {data, isLoading} = useListOrganizationsQuery(undefined, {refetchOnMountOrArgChange: true})
    const [taskOverrides, setTaskOverrides] = useState<Record<string, WorkshopTask[]>>({})
    const [teamOverrides, setTeamOverrides] = useState<Record<string, WorkshopTeam[]>>({})
    const [projectOverrides, setProjectOverrides] = useState<Record<string, WorkshopProject[]>>({})
    const [roleOverrides, setRoleOverrides] = useState<Record<string, WorkshopRole[]>>({})

    const apiOrganizations = useMemo(
        () => (data ?? []).map((organization) => createWorkshopOrganization(organization, user)),
        [data, user],
    )

    const organizations = useMemo(() => {
        const merged = new Map<string, WorkshopOrganization>()

        for (const organization of apiOrganizations) {
            merged.set(organization.id, organization)
        }

        return [...merged.values()].map((organization) => ({
            ...organization,
            tasks: taskOverrides[organization.id] ?? organization.tasks,
            teams: teamOverrides[organization.id] ?? organization.teams,
            projects: projectOverrides[organization.id] ?? organization.projects,
            roles: roleOverrides[organization.id] ?? organization.roles,
        }))
    }, [apiOrganizations, projectOverrides, roleOverrides, taskOverrides, teamOverrides])

    // Successful create/join responses may update the cache, but local storage must never grant access.
    const addLocalOrganization = useCallback((organization: ApiOrganization) => {
        dispatch(api.util.updateQueryData("listOrganizations", undefined, (draft) => {
            const index = draft.findIndex(candidate => candidate.id === organization.id)
            if (index < 0) draft.push(organization)
            else draft[index] = organization
        }))
        return createWorkshopOrganization(organization, user)
    }, [dispatch, user])

    const removeLocalOrganization = useCallback((organizationId: string) => {
        dispatch(api.util.updateQueryData("listOrganizations", undefined, draft =>
            draft.filter(organization => organization.id !== organizationId)))
    }, [dispatch])

    const organizationsById = useMemo(() => {
        const result = new Map(organizations.map(organization => [organization.id, organization]))
        for (const organization of seedOrganizations) {
            if (!result.has(organization.id)) result.set(organization.id, {
                ...organization,
                tasks: taskOverrides[organization.id] ?? organization.tasks,
                teams: teamOverrides[organization.id] ?? organization.teams,
                projects: projectOverrides[organization.id] ?? organization.projects,
                roles: roleOverrides[organization.id] ?? organization.roles,
            })
        }
        return result
    }, [organizations, projectOverrides, roleOverrides, taskOverrides, teamOverrides])

    const organizationById = useCallback((organizationId: string) =>
        organizationsById.get(organizationId), [organizationsById])

    const moveTask = useCallback((organizationId: string, taskId: string, status: WorkshopTaskStatus) => {
        const organization = organizationById(organizationId)
        if (!organization) return

        setTaskOverrides((current) => ({
            ...current,
            [organizationId]: (current[organizationId] ?? organization.tasks).map((task) =>
                task.id === taskId ? {...task, status} : task,
            ),
        }))
    }, [organizationById])

    const addTask = useCallback((organizationId: string, task: WorkshopTask) => {
        const organization = organizationById(organizationId)
        if (!organization) return

        setTaskOverrides((current) => ({
            ...current,
            [organizationId]: [...(current[organizationId] ?? organization.tasks), task],
        }))
    }, [organizationById])

    const addTeam = useCallback((organizationId: string, team: WorkshopTeam) => {
        const organization = organizationById(organizationId)
        if (!organization) return

        setTeamOverrides((current) => ({
            ...current,
            [organizationId]: [...(current[organizationId] ?? organization.teams), team],
        }))
    }, [organizationById])

    const addProject = useCallback((organizationId: string, project: WorkshopProject) => {
        const organization = organizationById(organizationId)
        if (!organization) return

        setProjectOverrides((current) => ({
            ...current,
            [organizationId]: [...(current[organizationId] ?? organization.projects), project],
        }))
    }, [organizationById])

    const updateProject = useCallback((organizationId: string, project: WorkshopProject) => {
        const organization = organizationById(organizationId)
        if (!organization) return

        setProjectOverrides((current) => ({
            ...current,
            [organizationId]: (current[organizationId] ?? organization.projects).map((candidate) =>
                candidate.id === project.id ? project : candidate,
            ),
        }))
    }, [organizationById])

    const saveRoles = useCallback((organizationId: string, roles: WorkshopRole[]) => {
        setRoleOverrides((current) => ({
            ...current,
            [organizationId]: roles,
        }))
    }, [])

    const value = useMemo<WorkshopContextValue>(() => ({
        organizations,
        isLoading,
        addLocalOrganization,
        removeLocalOrganization,
        organizationById,
        moveTask,
        addTask,
        addTeam,
        addProject,
        updateProject,
        saveRoles,
    }), [addLocalOrganization, addProject, removeLocalOrganization, addTask, addTeam, isLoading, moveTask, organizationById, organizations, saveRoles, updateProject])

    return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- colocated with its provider intentionally.
export function useWorkshop() {
    const context = useContext(WorkshopContext)
    if (!context) throw new Error("useWorkshop must be used within WorkshopProvider")
    return context
}
