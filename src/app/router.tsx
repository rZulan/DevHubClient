import { createBrowserRouter, redirect } from "react-router-dom"

import {
  accountLoader,
  anonymousOnlyLoader,
  protectedLoader,
  rootLoader,
} from "@/app/route-loaders"
import { RouterFallback } from "@/components/router-fallback"
import { ProtectedLayout } from "@/features/auth/protected-layout"
import { RootLayout } from "@/layouts/root-layout"
import { AccountLayout } from "@/pages/account-layout"
import { AccountPage } from "@/pages/account-page"
import { BillingPage } from "@/pages/billing-page"
import { DisplayPage } from "@/pages/display-page"
import { DiscoveryPage } from "@/pages/discovery-page"
import { HomePage } from "@/pages/home-page"
import { LoginPage } from "@/pages/login-page"
import { NotFoundPage } from "@/pages/not-found-page"
import { ProfilePage } from "@/pages/profile-page"
import { RegisterPage } from "@/pages/register-page"

export const router = createBrowserRouter([
  {
    id: "root",
    path: "/",
    loader: rootLoader,
    Component: RootLayout,
    HydrateFallback: RouterFallback,
    children: [
      { index: true, Component: HomePage },
      { path: "discovery", Component: DiscoveryPage },
      {
        loader: anonymousOnlyLoader,
        children: [
          { path: "login", Component: LoginPage },
          { path: "register", Component: RegisterPage },
        ],
      },
      {
        id: "protected",
        loader: protectedLoader,
        Component: ProtectedLayout,
        children: [
          {
            id: "account",
            path: "account",
            loader: accountLoader,
            Component: AccountLayout,
            children: [
              { index: true, loader: () => redirect("/account/profile") },
              { path: "profile", Component: ProfilePage },
              { path: "account", Component: AccountPage },
              { path: "display", Component: DisplayPage },
              { path: "billing", Component: BillingPage },
            ],
          },
        ],
      },
      { path: "*", Component: NotFoundPage },
    ],
  },
])
