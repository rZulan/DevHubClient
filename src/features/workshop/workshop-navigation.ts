export type WorkshopNavigationItem = {label: string; path: string; underConstruction?: boolean}

export const organizationNavigation: readonly WorkshopNavigationItem[] = [
    {label: "Dashboard", path: "dashboard", underConstruction: true},
    {label: "Teams", path: "teams", underConstruction: true},
    {label: "Org chart", path: "org-chart", underConstruction: true},
]
export const projectResourcesNavigation: readonly WorkshopNavigationItem[] = [
    {label: "Project Wiki", path: "project-wiki", underConstruction: true},
    {label: "Bug Reports", path: "bug-reports", underConstruction: true},
]
