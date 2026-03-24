"use client";

import { useState, useEffect } from "react";
import { usePredictionsAdapter } from "../adapter/context";
import type { PredictionEvent } from "../types/event";

export function useEventDetail(eventId: string) {
  const adapter = usePredictionsAdapter();
  const [event, setEvent] = useState<PredictionEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    adapter.events
      .fetchEvent(eventId)
      .then((result) => {
        if (!cancelled) {
          setEvent(result);
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
  }, [adapter, eventId]);

  return { event, isLoading, error };
}
