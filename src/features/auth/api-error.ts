import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"

import type { ApiProblemDetails } from "@/features/auth/auth-types"

export function getApiErrorMessage(error: unknown) {
  if (!isFetchBaseQueryError(error)) {
    return "Something went wrong. Please try again."
  }

  if (typeof error.data === "string") {
    return error.data
  }

  const problem = error.data as ApiProblemDetails | undefined

  if (problem?.errors) {
    const validationMessage = Object.values(problem.errors).flat()[0]
    if (validationMessage) return validationMessage
  }

  return problem?.detail ?? problem?.title ?? "The request could not be completed."
}

function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === "object" && error !== null && "status" in error
}
