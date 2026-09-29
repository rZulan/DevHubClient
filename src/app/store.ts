import {setupListeners} from "@reduxjs/toolkit/query"
import {configureStore} from "@reduxjs/toolkit"

import authReducer from "@/features/auth/auth-slice"
import {api} from "@/services/api"

export const store = configureStore({
    reducer: {
        auth: authReducer,
        [api.reducerPath]: api.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(api.middleware),
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
