import { createBrowserRouter, redirect } from "react-router-dom"

import {
  accountLoader,
  anonymousOnlyLoader,
  protectedLoader,
  rootLoader,
} from "@/app/route-loaders"
import { RouterFallback } from "@/components/router-fallback"
import { ProtectedLayout } from "@/features/auth/protected-layout"
import { AccountRootLayout } from "@/layouts/account-root-layout"
import { DiscoveryLayout } from "@/layouts/discovery-layout"
import { RootLayout } from "@/layouts/root-layout"
import { WorkshopLayout } from "@/layouts/workshop-layout"
import { WorkshopProviderLayout } from "@/layouts/workshop-provider-layout"
import { AccountLayout } from "@/pages/account-layout"

export const router = createBrowserRouter([
  {
    id: "root",
    path: "/",
    loader: rootLoader,
    HydrateFallback: RouterFallback,
    children: [
      {
        element: <RootLayout />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import("@/pages/home-page")).HomePage,
            }),
          },
          {
            loader: anonymousOnlyLoader,
            children: [
              {
                path: "login",
                lazy: async () => ({
                  Component: (await import("@/pages/login-page")).LoginPage,
                }),
              },
              {
                path: "register",
                lazy: async () => ({
                  Component: (await import("@/pages/register-page")).RegisterPage,
                }),
              },
            ],
          },
          {
            path: "*",
            lazy: async () => ({
              Component: (await import("@/pages/not-found-page")).NotFoundPage,
            }),
          },
        ],
      },
      {
        id: "protected",
        loader: protectedLoader,
        element: <ProtectedLayout />,
        children: [
          {
            path: "discovery",
            element: <DiscoveryLayout />,
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import("@/pages/discovery-page")).DiscoveryPage,
                }),
              },
            ],
          },
          {
            path: "workshop",
            element: <WorkshopProviderLayout />,
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import("@/pages/workshop-page")).WorkshopPage,
                }),
              },
              {
                path: ":organizationId",
                element: <WorkshopLayout />,
                children: [
                  { index: true, loader: () => redirect("dashboard") },
                  {
                    path: "dashboard",
                    lazy: async () => ({
                      Component: (await import("@/pages/workshop-lobby-page")).WorkshopLobbyPage,
                    }),
                  },
                  { path: "lobby", loader: () => redirect("../dashboard") },
                  {
                    path: "todo",
                    lazy: async () => ({
                      Component: (await import("@/pages/workshop-todo-page")).WorkshopTodoPage,
                    }),
                  },
                  {
                    path: "ideation",
                    lazy: async () => ({
                      Component: (await import("@/pages/workshop-ideation-page")).WorkshopIdeationPage,
                    }),
                  },
                  {
                    path: "projects",
                    lazy: async () => ({
                      Component: (await import("@/pages/workshop-projects-page")).WorkshopProjectsPage,
                    }),
                  },
                  {
                    path: "projects/:projectId",
                    lazy: async () => ({
                      Component: (await import("@/pages/workshop-project-detail-page")).WorkshopProjectDetailPage,
                    }),
                  },
                  {
                    path: "teams",
                    lazy: async () => ({
                      Component: (await import("@/pages/workshop-teams-page")).WorkshopTeamsPage,
                    }),
                  },
                  {
                    path: "org-chart",
                    lazy: async () => ({
                      Component: (await import("@/pages/workshop-org-chart-page")).WorkshopOrgChartPage,
                    }),
                  },
                  {
                    path: "roles",
                    lazy: async () => ({
                      Component: (await import("@/pages/workshop-roles-page")).WorkshopRolesPage,
                    }),
                  },
                ],
              },
            ],
          },
          {
            element: <AccountRootLayout />,
            children: [
              {
                id: "account",
                path: "account",
                loader: accountLoader,
                element: <AccountLayout />,
                children: [
                  { index: true, loader: () => redirect("/account/profile") },
                  {
                    path: "profile",
                    lazy: async () => ({
                      Component: (await import("@/pages/profile-page")).ProfilePage,
                    }),
                  },
                  {
                    path: "account",
                    lazy: async () => ({
                      Component: (await import("@/pages/account-page")).AccountPage,
                    }),
                  },
                  {
                    path: "display",
                    lazy: async () => ({
                      Component: (await import("@/pages/display-page")).DisplayPage,
                    }),
                  },
                  {
                    path: "billing",
                    lazy: async () => ({
                      Component: (await import("@/pages/billing-page")).BillingPage,
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
