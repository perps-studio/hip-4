"use client";

import { useState, useEffect } from "react";
import { usePredictionsAdapter } from "../adapter/context";
import type { PredictionPosition } from "../types/account";

const THROTTLE_MS = 200;

export function usePredictionPositions(address: string) {
  const adapter = usePredictionsAdapter();
  const [data, setData] = useState<PredictionPosition[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    adapter.account
      .fetchPositions(address)
      .then((positions) => {
        if (!cancelled) {
          setData(positions);
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
  }, [adapter, address]);

  useEffect(() => {
    if (!address) return;
    let lastUpdate = 0;
    let pendingTimer: ReturnType<typeof setTimeout> | undefined;

    const unsub = adapter.account.subscribePositions(
      address,
      (positions) => {
        const now = Date.now();
        if (now - lastUpdate >= THROTTLE_MS) {
          setData(positions);
          lastUpdate = now;
        } else if (!pendingTimer) {
          pendingTimer = setTimeout(
            () => {
              setData(positions);
              lastUpdate = Date.now();
              pendingTimer = undefined;
            },
            THROTTLE_MS - (now - lastUpdate),
          );
        }
      },
    );

    return () => {
      unsub();
      if (pendingTimer) clearTimeout(pendingTimer);
    };
  }, [adapter, address]);

  return { data, isLoading, error };
}
