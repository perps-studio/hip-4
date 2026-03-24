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

export function usePredictionsAdapter(): PredictionsAdapter {
  const adapter = useContext(PredictionsAdapterContext);
  if (!adapter) {
    throw new Error(
      "usePredictionsAdapter must be used within a PredictionsAdapterProvider",
    );
  }
  return adapter;
}
