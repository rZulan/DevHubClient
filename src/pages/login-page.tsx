import { useState, type FormEvent } from "react"
import { AlertCircle, LoaderCircle } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { useAppDispatch } from "@/app/hooks"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OAuthProviderButtons } from "@/components/oauth-provider-buttons"
import { getApiErrorMessage } from "@/features/auth/api-error"
import { acceptAuthentication } from "@/features/auth/auth-session"
import { useLoginMutation } from "@/services/api"

export function LoginPage() {
  const dispatch = useAppDispatch()
  const location = useLocation()
  const navigate = useNavigate()
  const [login, { isLoading }] = useLoginMutation()
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    getOAuthErrorMessage(location.search),
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    const formData = new FormData(event.currentTarget)

    try {
      const response = await login({
        email: String(formData.get("email")),
        password: String(formData.get("password")),
      }).unwrap()

      acceptAuthentication(dispatch, response)
      const destination = getSafeRedirectPath(location.search)
      navigate(destination, { replace: true })
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>
          Enter your DevHub credentials to continue.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              autoComplete="email"
              id="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              autoComplete="current-password"
              id="password"
              name="password"
              required
              type="password"
            />
          </div>
          <OAuthProviderButtons intent="login" />
        </CardContent>
        <CardFooter className="mt-6 flex-col gap-4">
          <Button className="w-full" disabled={isLoading} type="submit">
            {isLoading && <LoaderCircle className="animate-spin" />}
            Log in
          </Button>
          <p className="text-sm text-muted-foreground">
            New to DevHub?{" "}
            <Link className="font-medium text-foreground underline underline-offset-4" to="/register">
              Create an account
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

function getOAuthErrorMessage(search: string) {
  const error = new URLSearchParams(search).get("oauthError")

  switch (error) {
    case "Authentication.ExistingAccountMustBeLinked":
      return "An account already uses this email. Log in with your password, then connect this provider from Account settings."
    case "Authentication.ExternalAccountAlreadyLinked":
      return "This provider account is already linked to another DevHub account."
    case "provider_rejected":
      return "The provider canceled or rejected the sign-in request."
    case "verified_email_required":
      return "DevHub requires a verified email address from the provider."
    case "external_authentication_failed":
      return "The provider sign-in could not be completed. Please try again."
    case "linking_session_expired":
      return "Your DevHub session expired while linking the provider. Log in and try again."
    case null:
      return null
    default:
      return "The provider sign-in could not be completed. Please try again or use your password."
  }
}
