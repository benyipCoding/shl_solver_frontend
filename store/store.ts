// store/store.ts
import { configureStore } from "@reduxjs/toolkit";
import shlReducer from "./features/shlSlice";

export const store = configureStore({
  reducer: {
    shl: shlReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Turn off check because images might be large strings, though they are technically serializable.
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
