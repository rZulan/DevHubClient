export const USERNAME_MIN_LENGTH = 5
export const USERNAME_MAX_LENGTH = 15
export const USERNAME_INPUT_PATTERN = "[A-Za-z0-9_]{5,15}"
export const USERNAME_HELP_TEXT =
  "Use 5-15 letters, numbers, or underscores. Do not include the @ symbol."

const usernamePattern = /^[A-Za-z0-9_]{5,15}$/
const reservedUsernames = new Set(["admin", "api", "settings", "support"])

export function getUsernameValidationError(username: string) {
  const candidate = username.trim()

  if (!usernamePattern.test(candidate)) {
    return USERNAME_HELP_TEXT
  }

  return reservedUsernames.has(candidate.toLowerCase())
    ? "This username is reserved."
    : null
}

export function createUsernameFallback(value: string) {
  let candidate = value
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/_+$/g, "")

  if (candidate.length < USERNAME_MIN_LENGTH) {
    candidate = `user_${candidate}`.slice(0, USERNAME_MAX_LENGTH)
  }

  return candidate || "user_"
}
