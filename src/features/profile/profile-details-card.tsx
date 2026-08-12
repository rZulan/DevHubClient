import { memo, useState, type FormEvent, type ReactNode } from "react"
import {
  AlertCircle,
  AtSign,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  Mail,
  Pencil,
  UserRound,
} from "lucide-react"

import { useAppDispatch } from "@/app/hooks"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getApiErrorMessage } from "@/features/auth/api-error"
import { setUser } from "@/features/auth/auth-slice"
import type { AuthUser } from "@/features/auth/auth-types"
import { getUserHandle } from "@/features/auth/user-display"
import {
  getUsernameValidationError,
  USERNAME_HELP_TEXT,
  USERNAME_INPUT_PATTERN,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/features/auth/username-policy"
import { useUpdateCurrentUserMutation } from "@/services/api"

export const ProfileDetailsCard = memo(function ProfileDetailsCard({
  user,
}: {
  user: AuthUser
}) {
  const dispatch = useAppDispatch()
  const [isEditing, setIsEditing] = useState(false)
  const [message, setMessage] = useState<{
    kind: "error" | "success"
    text: string
  } | null>(null)
  const [updateProfile, { isLoading }] = useUpdateCurrentUserMutation()
  const fullName = `${user.firstName} ${user.lastName}`.trim()
  const handle = getUserHandle(user)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    const formData = new FormData(event.currentTarget)
    const username = String(formData.get("username")).trim()
    const firstName = String(formData.get("firstName")).trim()
    const lastName = String(formData.get("lastName")).trim()
    const dateOfBirth = String(formData.get("dateOfBirth")).trim() || null
    const usernameError = getUsernameValidationError(username)

    if (usernameError) {
      setMessage({ kind: "error", text: usernameError })
      return
    }

    if (!firstName || !lastName) {
      setMessage({ kind: "error", text: "First name and last name are required." })
      return
    }

    if (dateOfBirth && dateOfBirth > getTodayDate()) {
      setMessage({ kind: "error", text: "Birthday cannot be in the future." })
      return
    }

    try {
      const updatedUser = await updateProfile({
        username,
        firstName,
        lastName,
        dateOfBirth,
      }).unwrap()

      dispatch(setUser(updatedUser))
      setIsEditing(false)
      setMessage({ kind: "success", text: "Profile updated successfully." })
    } catch (error) {
      setMessage({ kind: "error", text: getApiErrorMessage(error) })
    }
  }

  return (
    <Card className="bg-card/85 backdrop-blur-xl dark:bg-card/80">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle>Profile details</CardTitle>
        {!isEditing && (
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => {
              setMessage(null)
              setIsEditing(true)
            }}
          >
            <Pencil />
            Edit profile
          </Button>
        )}
      </CardHeader>
      {isEditing ? (
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            {message?.kind === "error" && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-medium">Full name</legend>
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  defaultValue={user.firstName}
                  id="firstName"
                  maxLength={100}
                  name="firstName"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  defaultValue={user.lastName}
                  id="lastName"
                  maxLength={100}
                  name="lastName"
                  required
                />
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                    @
                  </span>
                  <Input
                    aria-describedby="profile-username-help"
                    autoCapitalize="none"
                    autoComplete="username"
                    className="pl-8"
                    defaultValue={user.username}
                    id="username"
                    maxLength={USERNAME_MAX_LENGTH}
                    minLength={USERNAME_MIN_LENGTH}
                    name="username"
                    pattern={USERNAME_INPUT_PATTERN}
                    required
                    spellCheck={false}
                  />
                </div>
                <p className="text-xs text-muted-foreground" id="profile-username-help">
                  {USERNAME_HELP_TEXT}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Birthday</Label>
                <Input
                  defaultValue={user.dateOfBirth ?? ""}
                  id="dateOfBirth"
                  max={getTodayDate()}
                  name="dateOfBirth"
                  type="date"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Your birthday is not displayed publicly.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                disabled={isLoading}
                type="button"
                variant="ghost"
                onClick={() => {
                  setMessage(null)
                  setIsEditing(false)
                }}
              >
                Cancel
              </Button>
              <Button disabled={isLoading} type="submit">
                {isLoading && <LoaderCircle className="animate-spin" />}
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      ) : (
        <CardContent className="space-y-5">
          {message?.kind === "success" && (
            <Alert>
              <CheckCircle2 />
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <ProfileDetail icon={<UserRound />} label="Full name" value={fullName} />
            <ProfileDetail icon={<AtSign />} label="Username" value={handle} />
            <ProfileDetail icon={<Mail />} label="Email" value={user.email} />
            <ProfileDetail
              icon={<CalendarDays />}
              label="Birthday"
              value={formatBirthday(user.dateOfBirth)}
            />
            <ProfileDetail
              icon={<CalendarDays />}
              label="Member since"
              value={
                user.createdAtUtc
                  ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
                      new Date(user.createdAtUtc),
                    )
                  : "Unavailable"
              }
            />
          </div>
        </CardContent>
      )}
    </Card>
  )
})

function getTodayDate() {
  const today = new Date()
  const timezoneOffset = today.getTimezoneOffset() * 60_000
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function formatBirthday(dateOfBirth?: string | null) {
  if (!dateOfBirth) return "Not set"

  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
    new Date(`${dateOfBirth}T00:00:00`),
  )
}

const ProfileDetail = memo(function ProfileDetail({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-lg border bg-background/50 p-4">
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium" title={value}>
          {value}
        </p>
      </div>
    </div>
  )
})
