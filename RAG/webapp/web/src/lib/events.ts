import type { RunEvent } from "../types";

export const stageOf = (events: RunEvent[], id: string) => events.find((e) => e.event === "stage" && e.data.id === id)?.data;
export const lastOf = (events: RunEvent[], name: string) => [...events].reverse().find((e) => e.event === name)?.data;
export const allOf = (events: RunEvent[], name: string) => events.filter((e) => e.event === name).map((e) => e.data);
export const tokensOf = (events: RunEvent[], name = "token") =>
  events
    .filter((e) => e.event === name)
    .map((e) => e.data.text)
    .join("");

export type FlowState = "idle" | "active" | "done";

// A stage is done when its event has arrived; the first stage that has not arrived is the active one.
export function flowStates(ids: string[], done: Set<string>, running: boolean): FlowState[] {
  let activeGiven = false;
  return ids.map((id) => {
    if (done.has(id)) return "done";
    if (running && !activeGiven) {
      activeGiven = true;
      return "active";
    }
    return "idle";
  });
}

export function prettyDoc(docId: string) {
  const name = docId.split("/").pop() ?? docId;
  return name.replace(/[-_]/g, " ");
}

export const INJECTION = /ignore all previous instructions|SYSTEM NOTE TO AI/i;

export function fmtMs(ms: number | null | undefined) {
  if (ms == null) return "n/a";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}
