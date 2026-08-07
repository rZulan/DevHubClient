import { useState, type FormEvent } from "react"
import { AlertCircle, LoaderCircle } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

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
import { useRegisterMutation } from "@/services/api"

export function RegisterPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [register, { isLoading }] = useRegisterMutation()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    const formData = new FormData(event.currentTarget)

    try {
      const response = await register({
        email: String(formData.get("email")),
        firstName: String(formData.get("firstName")),
        lastName: String(formData.get("lastName")),
        password: String(formData.get("password")),
      }).unwrap()

      acceptAuthentication(dispatch, response)
      navigate("/account/profile", { replace: true })
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error))
    }
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>
          Join DevHub with your name, email, and a secure password.
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
            <Link className="font-medium text-foreground underline underline-offset-4" to="/login">
              Log in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
