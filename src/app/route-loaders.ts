import { redirect, type LoaderFunctionArgs } from "react-router-dom"

import { store } from "@/app/store"
import { clearSession, setUser } from "@/features/auth/auth-slice"
import type { AuthUser } from "@/features/auth/auth-types"
import { getWorkshopResumePath } from "@/features/workshop/workshop-storage"
import { api } from "@/services/api"

let sessionRestoration: Promise<void> | undefined

export async function rootLoader({ request }: LoaderFunctionArgs) {
  await ensureSessionRestored()

  const user = store.getState().auth.user
  const url = new URL(request.url)
  if (user && url.pathname === "/" && !url.search) {
    const workshopPath = getWorkshopResumePath(user.id)
    if (workshopPath) throw redirect(workshopPath)
  }

  return null
}

export async function anonymousOnlyLoader() {
  await ensureSessionRestored()

  if (store.getState().auth.user) {
    throw redirect("/account/profile")
  }

  return null
}

export async function protectedLoader({ request }: LoaderFunctionArgs) {
  await requireUser(request)
  return null
}

export async function accountLoader({ request }: LoaderFunctionArgs) {
  const sessionUser = await requireUser(request)
  const currentUser = store.dispatch(
    api.endpoints.getCurrentUser.initiate(undefined, {
      forceRefetch: true,
      subscribe: false,
    }),
  )

  try {
    const profile = await currentUser.unwrap()
    store.dispatch(setUser(profile))
    return profile
  } catch {
    return sessionUser
  } finally {
    currentUser.unsubscribe()
  }
}

async function ensureSessionRestored() {
  sessionRestoration ??= restoreSession()
  await sessionRestoration
}

async function restoreSession() {
  const currentUser = store.dispatch(
    api.endpoints.getCurrentUser.initiate(undefined, {
      forceRefetch: true,
      subscribe: false,
    }),
  )

  try {
    store.dispatch(setUser(await currentUser.unwrap()))
  } catch {
    store.dispatch(clearSession())
  } finally {
    currentUser.unsubscribe()
  }
}

async function requireUser(request: Request): Promise<AuthUser> {
  await ensureSessionRestored()

  const user = store.getState().auth.user

  if (!user) {
    const url = new URL(request.url)
    const loginSearch = new URLSearchParams({ redirectTo: url.pathname })
    const oauthError = url.searchParams.get("oauthError")

    if (oauthError) {
      loginSearch.set("oauthError", oauthError)
    } else {
      loginSearch.set("redirectTo", `${url.pathname}${url.search}`)
    }

    throw redirect(`/login?${loginSearch}`)
  }

  return user
}
