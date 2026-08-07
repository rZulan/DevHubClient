import { Provider } from "react-redux"
import { RouterProvider } from "react-router-dom"

import { router } from "@/app/router"
import { store } from "@/app/store"
import { ThemeProvider } from "@/components/theme-provider"

export default function App() {
  return (
    <ThemeProvider>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </ThemeProvider>
  )
}
