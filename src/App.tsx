import {Provider} from "react-redux"
import {RouterProvider} from "react-router-dom"

import {router} from "@/app/router"
import {store} from "@/app/store"
import {ThemeProvider} from "@/components/theme-provider"
import {GlobalWorkshopPresence} from "@/features/workshop/global-workshop-presence"
import {ExportProgressPanel} from "@/features/exports/export-progress-panel"
import {WorkshopToaster} from "@/features/workshop/workshop-toaster"

export default function App() {
    return (
        <ThemeProvider>
            <Provider store={store}>
                <GlobalWorkshopPresence>
                    <RouterProvider router={router}/>
                    <ExportProgressPanel/>
                    <WorkshopToaster/>
                </GlobalWorkshopPresence>
            </Provider>
        </ThemeProvider>
    )
}
