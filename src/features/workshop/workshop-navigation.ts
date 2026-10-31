export type WorkshopNavigationItem = {label: string; path: string; underConstruction?: boolean}

export const organizationNavigation: readonly WorkshopNavigationItem[] = [
    {label: "Dashboard", path: "dashboard", underConstruction: true},
    {label: "Teams", path: "teams"},
    {label: "Org chart", path: "org-chart"},
]
