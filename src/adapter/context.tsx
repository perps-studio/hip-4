"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { PredictionsAdapter } from "./types";

const PredictionsAdapterContext = createContext<PredictionsAdapter | null>(
  null,
);

export interface PredictionsAdapterProviderProps {
  adapter: PredictionsAdapter;
  children: ReactNode;
}

/** React provider that initializes a PredictionsAdapter and makes it available via context. */
export function PredictionsAdapterProvider({
  adapter,
  children,
}: PredictionsAdapterProviderProps) {
  useEffect(() => {
    adapter.initialize().catch((err: unknown) => {
      console.error(
        "[PredictionsAdapterProvider] initialization failed:",
        err,
      );
    });
    return () => adapter.destroy();
  }, [adapter]);

  return (
    <PredictionsAdapterContext.Provider value={adapter}>
      {children}
    </PredictionsAdapterContext.Provider>
  );
}

/** Return the PredictionsAdapter from the nearest PredictionsAdapterProvider. Throws if none exists. */
export function usePredictionsAdapter(): PredictionsAdapter {
  const adapter = useContext(PredictionsAdapterContext);
  if (!adapter) {
    throw new Error(
      "usePredictionsAdapter must be used within a PredictionsAdapterProvider",
    );
  }
  return adapter;
}
