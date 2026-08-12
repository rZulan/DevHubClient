import { configureStore } from "@reduxjs/toolkit"
import { Provider, useDispatch, useSelector } from "react-redux"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import counterReducer, { decrement, increment } from "@/features/counter/counter-slice"

const counterStore = configureStore({ reducer: counterReducer })
const useCounterDispatch = useDispatch.withTypes<typeof counterStore.dispatch>()
const useCounterSelector = useSelector.withTypes<ReturnType<typeof counterStore.getState>>()

export function ReduxCounterCard() {
  return (
    <Provider store={counterStore}>
      <CounterCardContent />
    </Provider>
  )
}

function CounterCardContent() {
  const count = useCounterSelector((state) => state.value)
  const dispatch = useCounterDispatch()

  return (
    <Card className="counter-card">
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
  )
}
