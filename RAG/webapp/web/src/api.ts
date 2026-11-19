import type { Mode, Role, RunEvent } from "./types";

const headers = { "Content-Type": "application/json" };

async function check(response: Response) {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      detail = (await response.json()).detail ?? detail;
    } catch {
      // keep the status text
    }
    throw new Error(String(detail));
  }
  return response;
}

export async function getJSON<T>(url: string): Promise<T> {
  return (await check(await fetch(url))).json();
}

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  return (await check(await fetch(url, { method: "POST", headers, body: JSON.stringify(body) }))).json();
}

export interface AskBody {
  question: string;
  role: Role;
  mode: Mode;
}

// EventSource cannot POST, so the event stream is read by hand.
export async function streamPost(url: string, body: unknown, onEvent: (event: RunEvent) => void, signal: AbortSignal) {
  const response = await check(await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal }));
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (data) onEvent({ event, data: JSON.parse(data) });
    }
  }
}

export const streamRun = (pipeline: string, body: AskBody, onEvent: (event: RunEvent) => void, signal: AbortSignal) =>
  streamPost(`/api/run/${pipeline}`, body, onEvent, signal);
