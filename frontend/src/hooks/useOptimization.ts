import { useCallback, useEffect, useRef, useState } from "react";
import api, { type OptimizePayload } from "../services/api";
import type { OptimizationResult } from "../types";
import { useOptimizationSocket } from "./useWebSocket";

/**
 * Drives an optimisation run: submit, follow telemetry, collect the result.
 *
 * The WebSocket is the primary channel, but a poll runs alongside it as a
 * safety net. If the socket drops on a proxy or the browser suspends the tab,
 * the run still completes and the result still arrives.
 */
export function useOptimization() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const socket = useOptimizationSocket(taskId);

  // Prefer whichever channel produced a result first.
  useEffect(() => {
    if (socket.result && !result) setResult(socket.result);
  }, [socket.result, result]);

  useEffect(() => {
    if (socket.error) setError(socket.error);
  }, [socket.error]);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!taskId || result) {
      stopPolling();
      return;
    }

    pollRef.current = window.setInterval(async () => {
      try {
        const status = await api.getOptimization(taskId);
        if (status.status === "completed" && status.result) {
          setResult(status.result);
          stopPolling();
        } else if (status.status === "failed") {
          setError(status.error ?? "Optimisation failed");
          stopPolling();
        }
      } catch {
        // A transient poll failure is not fatal; the socket may still deliver.
      }
    }, 2500);

    return stopPolling;
  }, [taskId, result, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  const run = useCallback(async (payload: OptimizePayload) => {
    setSubmitting(true);
    setError(null);
    setResult(null);
    setTaskId(null);
    try {
      const response = await api.startOptimization(payload);
      setTaskId(response.task_id);
      return response.task_id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the optimisation");
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setTaskId(null);
    setResult(null);
    setError(null);
  }, [stopPolling]);

  const running = Boolean(taskId) && !result && !error;

  return {
    run,
    reset,
    taskId,
    submitting,
    running,
    result,
    error,
    events: socket.events,
    latest: socket.latest,
    progress: result ? 1 : socket.progress,
    connectionStatus: socket.status,
  };
}
