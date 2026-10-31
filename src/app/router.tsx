import {createBrowserRouter, redirect} from "react-router-dom"

import {accountLoader, anonymousOnlyLoader, protectedLoader, rootLoader,} from "@/app/route-loaders"
import {RouterFallback} from "@/components/router-fallback"
import {ProtectedLayout} from "@/features/auth/protected-layout"
import {AccountRootLayout} from "@/layouts/account-root-layout"
import {DiscoveryLayout} from "@/layouts/discovery-layout"
import {RootLayout} from "@/layouts/root-layout"
import {AccountLayout} from "@/pages/account/account-layout"

export const router = createBrowserRouter([
    {
        id: "root",
        path: "/",
        loader: rootLoader,
        HydrateFallback: RouterFallback,
        children: [
            {
                path: "b/:token",
                lazy: async () => ({Component: (await import("@/pages/general/public-bug-report-page")).PublicBugReportPage}),
            },
            {
                path: "report-bug/:token",
                lazy: async () => ({Component: (await import("@/pages/general/public-bug-report-page")).PublicBugReportPage}),
            },
            {
                element: <RootLayout/>,
                children: [
                    {
                        index: true,
                        lazy: async () => ({
                            Component: (await import("@/pages/general/home-page")).HomePage,
                        }),
                    },
                    {
                        path: "changelogs",
                        lazy: async () => ({
                            Component: (await import("@/pages/general/changelogs-page")).ChangelogsPage,
                        }),
                    },
                    {
                        loader: anonymousOnlyLoader,
                        children: [
                            {
                                path: "login",
                                lazy: async () => ({
                                    Component: (await import("@/pages/auth/login-page")).LoginPage,
                                }),
                            },
                            {
                                path: "register",
                                lazy: async () => ({
                                    Component: (await import("@/pages/auth/register-page")).RegisterPage,
                                }),
                            },
                        ],
                    },
                    {
                        path: "*",
                        lazy: async () => ({
                            Component: (await import("@/pages/general/not-found-page")).NotFoundPage,
                        }),
                    },
                ],
            },
            {
                id: "protected",
                loader: protectedLoader,
                element: <ProtectedLayout/>,
                children: [
                    {
                        path: "discovery",
                        element: <DiscoveryLayout/>,
                        children: [
                            {
                                index: true,
                                lazy: async () => ({
                                    Component: (await import("@/pages/discovery/discovery-page")).DiscoveryPage,
                                }),
                            },
                        ],
                    },
                    {
                        path: "workshop",
                        lazy: async () => ({Component: (await import("@/layouts/workshop-provider-layout")).WorkshopProviderLayout}),
                        children: [
                            {
                                index: true,
                                lazy: async () => ({
                                    Component: (await import("@/pages/workshop/workshop-page")).WorkshopPage,
                                }),
                            },
                            {
                                path: ":organizationId",
                                lazy: async () => ({Component: (await import("@/layouts/workshop-layout")).WorkshopLayout}),
                                children: [
                                    {index: true, loader: () => redirect("dashboard")},
                                    {
                                        path: "dashboard",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/workshop-lobby-page")).WorkshopLobbyPage,
                                        }),
                                    },
                                    {path: "lobby", loader: () => redirect("../dashboard")},
                                    {
                                        path: "project-wiki",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/workshop-project-wiki-page")).WorkshopProjectWikiPage,
                                        }),
                                    },
                                    {
                                        path: "bug-reports",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/workshop-bug-reports-page")).WorkshopBugReportsPage,
                                        }),
                                    },
                                    {
                                        path: "todo",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/workshop-todo-page")).WorkshopTodoPage,
                                        }),
                                    },
                                    {
                                        path: "calendar",
                                        lazy: async () => ({Component: (await import("@/pages/workshop/workshop-calendar-page")).WorkshopCalendarPage}),
                                    },
                                    // Archived Playground links lead to the active Notes tool.
                                    {path: "ideation", loader: () => redirect("../notes")},
                                    {
                                        path: "erd",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/workshop-erd-page")).WorkshopErdPage,
                                        }),
                                    },
                                    {
                                        path: "ui-editor",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/workshop-ui-editor-page")).WorkshopUiEditorPage,
                                        }),
                                    },
                                    {
                                        path: "notes",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/workshop-notes-page")).WorkshopNotesPage,
                                        }),
                                    },
                                    {
                                        path: "sdlc",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/workshop-sdlc-page")).WorkshopSdlcPage,
                                        }),
                                    },
                                    {
                                        path: "state-machine",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/workshop-state-machine-page")).WorkshopStateMachinePage,
                                        }),
                                    },
                                    {
                                        path: "projects",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/projects/workshop-projects-page")).WorkshopProjectsPage,
                                        }),
                                    },
                                    {
                                        path: "projects/:projectId",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/projects/workshop-project-detail-page")).WorkshopProjectDetailPage,
                                        }),
                                    },
                                    {
                                        path: "teams",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/organization/workshop-teams-page")).WorkshopTeamsPage,
                                        }),
                                    },
                                    {
                                        path: "org-chart",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/organization/workshop-org-chart-page")).WorkshopOrgChartPage,
                                        }),
                                    },
                                    {path: "roles", loader: () => redirect("../settings/roles")},
                                    {
                                        path: "settings",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/workshop/settings/workshop-settings-layout")).WorkshopSettingsLayout,
                                        }),
                                        children: [
                                            {index: true, loader: () => redirect("general")},
                                            {
                                                path: "general",
                                                lazy: async () => ({
                                                    Component: (await import("@/pages/workshop/settings/general-settings-page")).GeneralSettingsPage,
                                                }),
                                            },
                                            {
                                                path: "appearance",
                                                lazy: async () => ({
                                                    Component: (await import("@/pages/workshop/settings/appearance-settings-page")).AppearanceSettingsPage,
                                                }),
                                            },
                                            {
                                                path: "members",
                                                lazy: async () => ({
                                                    Component: (await import("@/pages/workshop/settings/members-settings-page")).MembersSettingsPage,
                                                }),
                                            },
                                            {
                                                path: "invites",
                                                lazy: async () => ({
                                                    Component: (await import("@/pages/workshop/settings/invites-settings-page")).InvitesSettingsPage,
                                                }),
                                            },
                                            {
                                                path: "roles",
                                                lazy: async () => ({
                                                    Component: (await import("@/pages/workshop/organization/workshop-roles-page")).WorkshopRolesPage,
                                                }),
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        element: <AccountRootLayout/>,
                        children: [
                            {
                                id: "account",
                                path: "account",
                                loader: accountLoader,
                                element: <AccountLayout/>,
                                children: [
                                    {index: true, loader: () => redirect("/account/profile")},
                                    {
                                        path: "profile",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/account/profile-page")).ProfilePage,
                                        }),
                                    },
                                    {
                                        path: "account",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/account/account-page")).AccountPage,
                                        }),
                                    },
                                    {
                                        path: "display",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/account/display-page")).DisplayPage,
                                        }),
                                    },
                                    {
                                        path: "billing",
                                        lazy: async () => ({
                                            Component: (await import("@/pages/account/billing-page")).BillingPage,
                                        }),
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
])
