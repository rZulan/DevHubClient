import { useState, type FormEvent } from "react"
import { AlertCircle, LoaderCircle } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { useAppDispatch } from "@/app/hooks"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OAuthProviderButtons } from "@/components/oauth-provider-buttons"
import { getApiErrorMessage } from "@/features/auth/api-error"
import { acceptAuthentication } from "@/features/auth/auth-session"
import {
  getUsernameValidationError,
  USERNAME_HELP_TEXT,
  USERNAME_INPUT_PATTERN,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/features/auth/username-policy"
import { useRegisterMutation } from "@/services/api"

export function RegisterPage() {
  const dispatch = useAppDispatch()
  const location = useLocation()
  const navigate = useNavigate()
  const [register, { isLoading }] = useRegisterMutation()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    const formData = new FormData(event.currentTarget)
    const username = String(formData.get("username")).trim()
    const usernameError = getUsernameValidationError(username)

    if (usernameError) {
      setErrorMessage(usernameError)
      return
    }

    try {
      const response = await register({
        email: String(formData.get("email")),
        firstName: String(formData.get("firstName")),
        lastName: String(formData.get("lastName")),
        password: String(formData.get("password")),
        username,
      }).unwrap()

      acceptAuthentication(dispatch, response)
      navigate(getSafeRedirectPath(location.search), { replace: true })
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                autoComplete="given-name"
                id="firstName"
                maxLength={100}
                name="firstName"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                autoComplete="family-name"
                id="lastName"
                maxLength={100}
                name="lastName"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                @
              </span>
              <Input
                aria-describedby="username-help"
                autoCapitalize="none"
                autoComplete="username"
                className="pl-8"
                id="username"
                maxLength={USERNAME_MAX_LENGTH}
                minLength={USERNAME_MIN_LENGTH}
                name="username"
                pattern={USERNAME_INPUT_PATTERN}
                placeholder="developer_01"
                required
                spellCheck={false}
                title={USERNAME_HELP_TEXT}
              />
            </div>
            <p className="text-xs text-muted-foreground" id="username-help">
              {USERNAME_HELP_TEXT}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              autoComplete="email"
              id="email"
              maxLength={320}
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              aria-describedby="password-help"
              autoComplete="new-password"
              id="password"
              maxLength={128}
              minLength={8}
              name="password"
              required
              type="password"
            />
            <p className="text-xs text-muted-foreground" id="password-help">
              Use between 8 and 128 characters.
            </p>
          </div>
          <OAuthProviderButtons intent="register" />
        </CardContent>
        <CardFooter className="mt-6 flex-col gap-4">
          <Button className="w-full" disabled={isLoading} type="submit">
            {isLoading && <LoaderCircle className="animate-spin" />}
            Create account
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="font-medium text-foreground underline underline-offset-4" to={`/login${location.search}`}>
              Log in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}

function getSafeRedirectPath(search: string) {
  const redirectTo = new URLSearchParams(search).get("redirectTo")

  return redirectTo?.startsWith("/") && !redirectTo.startsWith("//")
    ? redirectTo
    : "/account/profile"
}
