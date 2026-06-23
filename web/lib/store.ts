import { configureStore } from "@reduxjs/toolkit"
import { bastionApi } from "./api-slice"

export const store = configureStore({
  reducer: {
    [bastionApi.reducerPath]: bastionApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(bastionApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
