import { useCallback, useEffect, useState } from "react";
import api, { type PredictionPayload } from "../services/api";
import type { FuelComparison, PredictionResult } from "../types";

export function usePrediction() {
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [comparison, setComparison] = useState<FuelComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predict = useCallback(async (payload: PredictionPayload) => {
    setLoading(true);
    setError(null);
    try {
      // Both calls describe the same voyage, so run them together rather than
      // making the operator wait through two round trips.
      const [prediction, fuels] = await Promise.all([
        api.predict(payload),
        api.compareFuels(payload),
      ]);
      setResult(prediction);
      setComparison(fuels);
      return prediction;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
      setResult(null);
      setComparison(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setComparison(null);
    setError(null);
  }, []);

  return { predict, reset, result, comparison, loading, error };
}

/**
 * Fetch-on-mount helper for the read-only pages.
 *
 * `deps` controls refetching exactly as it would in a raw effect. The in-flight
 * request is cancelled on unmount or dependency change so a slow response can
 * never overwrite fresher state.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: React.DependencyList = [],
): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loader()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Request failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload };
}
