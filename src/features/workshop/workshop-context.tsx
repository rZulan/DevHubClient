import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { useAppSelector } from "@/app/hooks"
import {
  createWorkshopOrganization,
  seedOrganizations,
} from "@/features/workshop/workshop-data"
import type {
  ApiOrganization,
  WorkshopOrganization,
  WorkshopProject,
  WorkshopRole,
  WorkshopTask,
  WorkshopTaskStatus,
  WorkshopTeam,
} from "@/features/workshop/workshop-types"
import { useListOrganizationsQuery } from "@/services/api"

type WorkshopContextValue = {
  organizations: WorkshopOrganization[]
  isLoading: boolean
  addLocalOrganization: (organization: ApiOrganization) => WorkshopOrganization
  organizationById: (organizationId: string) => WorkshopOrganization | undefined
  moveTask: (organizationId: string, taskId: string, status: WorkshopTaskStatus) => void
  addTask: (organizationId: string, task: WorkshopTask) => void
  addTeam: (organizationId: string, team: WorkshopTeam) => void
  addProject: (organizationId: string, project: WorkshopProject) => void
  updateProject: (organizationId: string, project: WorkshopProject) => void
  saveRoles: (organizationId: string, roles: WorkshopRole[]) => void
}

const WorkshopContext = createContext<WorkshopContextValue | null>(null)

function getLocalOrganizationsKey(userId: string | undefined) {
  return `devhub.workshop.local-organizations.${userId ?? "anonymous"}`
}

export function WorkshopProvider({ children }: { children: ReactNode }) {
  const user = useAppSelector((state) => state.auth.user)
  const { data, isLoading } = useListOrganizationsQuery()
  const [localOrganizations, setLocalOrganizations] = useState<WorkshopOrganization[]>(
    () => readLocalOrganizations(user?.id),
  )
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

    for (const organization of [...localOrganizations, ...apiOrganizations]) {
      merged.set(organization.id, organization)
    }

    return [...merged.values()].map((organization) => ({
      ...organization,
      tasks: taskOverrides[organization.id] ?? organization.tasks,
      teams: teamOverrides[organization.id] ?? organization.teams,
      projects: projectOverrides[organization.id] ?? organization.projects,
      roles: roleOverrides[organization.id] ?? organization.roles,
    }))
  }, [apiOrganizations, localOrganizations, projectOverrides, roleOverrides, taskOverrides, teamOverrides])

  const addLocalOrganization = useCallback((organization: ApiOrganization) => {
    const created = createWorkshopOrganization(organization, user)
    setLocalOrganizations((current) => {
      const next = [...current.filter((candidate) => candidate.id !== created.id), created]
      localStorage.setItem(getLocalOrganizationsKey(user?.id), JSON.stringify(next))
      return next
    })
    return created
  }, [user])

  const organizationById = useCallback((organizationId: string) => {
    const organization = organizations.find((candidate) => candidate.id === organizationId)
      ?? seedOrganizations.find((candidate) => candidate.id === organizationId)

    if (!organization) return undefined

    return {
      ...organization,
      tasks: taskOverrides[organization.id] ?? organization.tasks,
      teams: teamOverrides[organization.id] ?? organization.teams,
      projects: projectOverrides[organization.id] ?? organization.projects,
      roles: roleOverrides[organization.id] ?? organization.roles,
    }
  }, [organizations, projectOverrides, roleOverrides, taskOverrides, teamOverrides])

  const moveTask = useCallback((organizationId: string, taskId: string, status: WorkshopTaskStatus) => {
    const organization = organizationById(organizationId)
    if (!organization) return

    setTaskOverrides((current) => ({
      ...current,
      [organizationId]: (current[organizationId] ?? organization.tasks).map((task) =>
        task.id === taskId ? { ...task, status } : task,
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
    organizationById,
    moveTask,
    addTask,
    addTeam,
    addProject,
    updateProject,
    saveRoles,
  }), [addLocalOrganization, addProject, addTask, addTeam, isLoading, moveTask, organizationById, organizations, saveRoles, updateProject])

  return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- colocated with its provider intentionally.
export function useWorkshop() {
  const context = useContext(WorkshopContext)
  if (!context) throw new Error("useWorkshop must be used within WorkshopProvider")
  return context
}

function readLocalOrganizations(userId: string | undefined): WorkshopOrganization[] {
  try {
    const value = localStorage.getItem(getLocalOrganizationsKey(userId))
    if (!value) return []

    return (JSON.parse(value) as WorkshopOrganization[]).map((organization) => ({
      ...organization,
      ownerUserId: organization.ownerUserId
        ?? organization.members.find((member) => member.roleId === "owner")?.id
        ?? "",
    }))
  } catch {
    return []
  }
}
