import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"

import { useAppDispatch, useAppSelector } from "@/app/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DeveloperFeatures } from "@/components/developer-features"
import { ScrollAssemble } from "@/components/scroll-assemble"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { decrement, increment } from "@/features/counter/counter-slice"

const stack = ["shadcn/ui", "Redux Toolkit", "RTK Query", "React Router"]

export function HomePage() {
  const count = useAppSelector((state) => state.counter.value)
  const user = useAppSelector((state) => state.auth.user)
  const dispatch = useAppDispatch()

  return (
    <div>
      <div className="grid items-start gap-10 md:grid-cols-[1.3fr_0.7fr]">
        <ScrollAssemble>
          <section className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {stack.map((item) => (
                <Badge key={item} variant="secondary">
                  {item}
                </Badge>
              ))}
            </div>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                {user ? `Welcome back, ${user.firstName}.` : "Your frontend stack is ready."}
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Secure cookie sessions, bearer JWTs, and rotating refresh tokens are
                now connected to the DevHub .NET API.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to={user ? "/account/profile" : "/register"}>
                {user ? "View your account" : "Create your account"}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </section>
        </ScrollAssemble>

        <ScrollAssemble delay={70}>
          <Card>
            <CardHeader>
              <CardTitle>Redux is connected</CardTitle>
              <CardDescription>
                This counter reads from and dispatches to the typed store.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-5xl font-semibold tabular-nums">{count}</p>
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => dispatch(decrement())}>
                Decrement
              </Button>
              <Button onClick={() => dispatch(increment())}>Increment</Button>
            </CardFooter>
          </Card>
        </ScrollAssemble>
      </div>

      <DeveloperFeatures />
    </div>
  )
}
