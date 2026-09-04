import { useCallback, useEffect, useRef, useState } from "react";
import type { OptimizationProgressEvent, OptimizationResult } from "../types";

interface UseOptimizationSocket {
  events: OptimizationProgressEvent[];
  latest: OptimizationProgressEvent | null;
  result: OptimizationResult | null;
  status: "idle" | "connecting" | "open" | "closed" | "error";
  error: string | null;
  progress: number;
}

/**
 * Streams optimiser telemetry over a WebSocket.
 *
 * The socket carries an opening snapshot (so a late subscriber still renders a
 * complete convergence curve), then live progress, then a final frame with the
 * full result. Reconnection is deliberately not attempted: a dropped socket
 * mid-run means the caller should fall back to polling rather than risk
 * replaying a partial trace.
 */
export function useOptimizationSocket(taskId: string | null): UseOptimizationSocket {
  const [events, setEvents] = useState<OptimizationProgressEvent[]>([]);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [status, setStatus] = useState<UseOptimizationSocket["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!taskId) {
      setEvents([]);
      setResult(null);
      setStatus("idle");
      setError(null);
      return;
    }

    setEvents([]);
    setResult(null);
    setError(null);
    setStatus("connecting");

    // In local dev, no VITE_API_URL is set, so the socket falls back to the
    // current origin, which Vite proxies to the backend (see vite.config.ts).
    // In production, VITE_API_URL points at the deployed backend and its
    // scheme/host stand in for the page's own.
    const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
    let url: string;
    if (apiUrl) {
      const parsed = new URL(apiUrl);
      const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      url = `${wsProtocol}//${parsed.host}/ws/optimization/${taskId}`;
    } else {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      url = `${protocol}//${window.location.host}/ws/optimization/${taskId}`;
    }
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => setStatus("open");

    socket.onmessage = (message) => {
      try {
        const payload: OptimizationProgressEvent = JSON.parse(message.data);

        if (payload.type === "ping") return;

        if (payload.type === "snapshot" && payload.events?.length) {
          setEvents(payload.events);
          return;
        }

        if (payload.type === "progress") {
          setEvents((previous) => [...previous, payload]);
          return;
        }

        if (payload.type === "final") {
          if (payload.result) setResult(payload.result);
          if (payload.status === "failed") setError(payload.error ?? "Optimisation failed");
          setStatus("closed");
          return;
        }

        if (payload.type === "error") {
          setError(payload.message ?? payload.error ?? "Stream error");
          setStatus("error");
        }
      } catch {
        setError("Received malformed telemetry from the optimiser");
      }
    };

    socket.onerror = () => {
      setStatus("error");
      setError("Lost the connection to the optimiser");
    };

    socket.onclose = () => {
      setStatus((current) => (current === "error" ? current : "closed"));
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [taskId]);

  const latest = events.length > 0 ? events[events.length - 1] : null;
  const progress = latest?.progress ?? 0;

  return { events, latest, result, status, error, progress };
}

/** Extracts the annealing trace from the streamed events, for live plotting. */
export function useAnnealingSeries(events: OptimizationProgressEvent[]) {
  return useCallback(() => {
    const qubo = events.filter((e) => e.phase === "qubo" && e.temperature !== undefined);
    const qpso = events.filter((e) => e.phase === "qpso" && e.best_fitness !== undefined);
    return {
      temperature: qubo.map((e) => e.temperature ?? 0),
      transverseField: qubo.map((e) => e.transverse_field ?? 0),
      quboEnergy: qubo.map((e) => e.best_energy ?? 0),
      acceptance: qubo.map((e) => e.acceptance_rate ?? 0),
      tunneling: qubo.map((e) => e.tunneling_events ?? 0),
      qpsoFitness: qpso.map((e) => e.best_fitness ?? 0),
      qpsoDiversity: qpso.map((e) => e.swarm_diversity ?? 0),
      qpsoAlpha: qpso.map((e) => e.alpha ?? 0),
    };
  }, [events])();
}
