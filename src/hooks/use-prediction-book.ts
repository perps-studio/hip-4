"use client";

import { useState, useEffect } from "react";
import { usePredictionsAdapter } from "../adapter/context";
import type { PredictionOrderBook } from "../types/market";

const THROTTLE_MS = 200;

export function usePredictionBook(marketId: string) {
  const adapter = usePredictionsAdapter();
  const [data, setData] = useState<PredictionOrderBook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!marketId) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    adapter.marketData
      .fetchOrderBook(marketId)
      .then((book) => {
        if (!cancelled) {
          setData(book);
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
  }, [adapter, marketId]);

  useEffect(() => {
    if (!marketId) return;
    let lastUpdate = 0;
    let pendingTimer: ReturnType<typeof setTimeout> | undefined;

    const unsub = adapter.marketData.subscribeOrderBook(marketId, (book) => {
      const now = Date.now();
      if (now - lastUpdate >= THROTTLE_MS) {
        setData(book);
        lastUpdate = now;
      } else if (!pendingTimer) {
        pendingTimer = setTimeout(
          () => {
            setData(book);
            lastUpdate = Date.now();
            pendingTimer = undefined;
          },
          THROTTLE_MS - (now - lastUpdate),
        );
      }
    });

    return () => {
      unsub();
      if (pendingTimer) clearTimeout(pendingTimer);
    };
  }, [adapter, marketId]);

  return { data, isLoading, error };
}
