import type { ReactNode } from "react";
import { type FlowState, fmtMs } from "../lib/events";

export function Pill({ children, tone = "plain", title }: { children: ReactNode; tone?: string; title?: string }) {
  return (
    <span className={`pill pill-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: string }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`} title={hint}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function ScoreBar({ value, max = 10, threshold }: { value: number | null; max?: number; threshold?: number }) {
  if (value == null) return <span className="muted">not scored</span>;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const tone = threshold == null ? "good" : value >= threshold ? "good" : value >= threshold - 2 ? "warn" : "bad";
  return (
    <span className="scorebar" title={`${value} out of ${max}`}>
      <span className="scorebar-track">
        <span className={`scorebar-fill tone-${tone}`} style={{ width: `${pct}%` }} />
        {threshold != null && <span className="scorebar-mark" style={{ left: `${(threshold / max) * 100}%` }} />}
      </span>
      <b>{value}</b>
    </span>
  );
}

export function Flow({ nodes, states }: { nodes: { label: string; sub?: string; ms?: number | null }[]; states: FlowState[] }) {
  return (
    <div className="flow">
      {nodes.map((node, index) => (
        <div key={node.label} className="flow-item">
          <div className={`flow-node flow-${states[index]}`}>
            <b>{node.label}</b>
            {node.sub && <span>{node.sub}</span>}
            {node.ms != null && <em>{fmtMs(node.ms)}</em>}
          </div>
          {index < nodes.length - 1 && <div className={`flow-link ${states[index] === "done" ? "flow-link-on" : ""}`} />}
        </div>
      ))}
    </div>
  );
}

export interface Segment {
  label: string;
  ms: number;
  tone: string;
}

// A latency waterfall: each stage's share of the total time.
export function Waterfall({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, s) => sum + s.ms, 0) || 1;
  return (
    <div className="waterfall">
      <div className="waterfall-bar">
        {segments.map((s) => (
          <span key={s.label} className={`seg seg-${s.tone}`} style={{ width: `${Math.max((s.ms / total) * 100, 0.8)}%` }} title={`${s.label}: ${fmtMs(s.ms)}`} />
        ))}
      </div>
      <div className="waterfall-legend">
        {segments.map((s) => (
          <span key={s.label}>
            <i className={`dot seg-${s.tone}`} />
            {s.label} <b>{fmtMs(s.ms)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Lesson({
  title,
  summary,
  points,
  calls,
  tryThis,
}: {
  title: string;
  summary: ReactNode;
  points?: string[];
  calls?: string[];
  tryThis?: string[];
}) {
  return (
    <section className="card lesson">
      <div className="kicker">Concept</div>
      <h2>{title}</h2>
      <p>{summary}</p>
      {points && (
        <ul>
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
      {tryThis && (
        <>
          <div className="kicker">Try this</div>
          <ul className="try">
            {tryThis.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {calls && (
        <details className="hood">
          <summary>Under the hood: what the backend calls</summary>
          <ul>
            {calls.map((call) => (
              <li key={call}>
                <code>{call}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function Section({ title, hint, right, children }: { title: string; hint?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="card section rise">
      <header>
        <div>
          <h3>{title}</h3>
          {hint && <p className="hint">{hint}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  return message ? <div className="error">Something went wrong: {message}</div> : null;
}
