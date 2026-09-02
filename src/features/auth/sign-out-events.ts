export const beforeSignOutEvent = "devhub-before-sign-out"

export type BeforeSignOutDetail = {
  pending: Promise<unknown>[]
}

export async function announceBeforeSignOut() {
  const detail: BeforeSignOutDetail = { pending: [] }
  window.dispatchEvent(new CustomEvent(beforeSignOutEvent, { detail }))
  await Promise.race([
    Promise.allSettled(detail.pending),
    new Promise((resolve) => setTimeout(resolve, 1_500)),
  ])
}
