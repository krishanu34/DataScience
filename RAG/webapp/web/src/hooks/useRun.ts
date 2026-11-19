import { useCallback, useEffect, useRef, useState } from "react";
import { streamRun } from "../api";
import type { Mode, Role, RunEvent } from "../types";

export function useRun(pipeline: string) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const start = useCallback(
    async (question: string, role: Role, mode: Mode) => {
      controller.current?.abort();
      const own = new AbortController();
      controller.current = own;
      setEvents([]);
      setError(null);
      setRunning(true);
      try {
        await streamRun(
          pipeline,
          { question, role, mode },
          (event) => {
            if (own.signal.aborted) return;
            if (event.event === "error") setError(event.data.message);
            setEvents((previous) => [...previous, event]);
          },
          own.signal,
        );
      } catch (problem) {
        if (!own.signal.aborted) setError(problem instanceof Error ? problem.message : String(problem));
      } finally {
        if (controller.current === own) setRunning(false);
      }
    },
    [pipeline],
  );

  const stop = useCallback(() => {
    controller.current?.abort();
    setRunning(false);
  }, []);

  useEffect(() => () => controller.current?.abort(), []);
  return { events, running, error, start, stop };
}
