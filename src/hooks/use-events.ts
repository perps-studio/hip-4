"use client";

import { useState, useEffect } from "react";
import { usePredictionsAdapter } from "../adapter/context";
import type { PredictionEvent } from "../types/event";

export interface UseEventsParams {
  category?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
  query?: string;
}

export function useEvents(params: UseEventsParams = {}) {
  const adapter = usePredictionsAdapter();
  const [events, setEvents] = useState<PredictionEvent[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const paramKey = `${params.category ?? ""}|${String(params.active ?? "")}|${String(params.limit ?? "")}|${String(params.offset ?? "")}|${params.query ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    adapter.events
      .fetchEvents(params)
      .then((result) => {
        if (!cancelled) {
          setEvents(result);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, paramKey]);

  return { events, isLoading, error };
}
