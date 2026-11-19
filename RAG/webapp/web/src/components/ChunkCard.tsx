import { Fragment, type ReactNode, useState } from "react";
import { INJECTION, prettyDoc } from "../lib/events";
import type { Chunk } from "../types";
import { Pill, ScoreBar } from "./ui";

const COMMON = new Set(["the", "and", "was", "what", "how", "why", "who", "when", "which", "that", "this", "with", "for", "are", "can", "does", "did", "our", "you", "your", "from", "into", "about", "after", "under", "have", "has", "its"]);

function highlight(text: string, terms: string[]): ReactNode {
  const usable = [...new Set(terms.filter((term) => term.length >= 3 && !COMMON.has(term)))];
  if (usable.length === 0) return text;
  const pattern = new RegExp(`(${usable.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(pattern).map((part, index) => (index % 2 === 1 ? <mark key={index}>{part}</mark> : <Fragment key={index}>{part}</Fragment>));
}

interface Props {
  chunk: Chunk;
  terms?: string[];
  badge?: ReactNode;
  pills?: ReactNode;
  highlighted?: boolean;
  defaultOpen?: boolean;
  threshold?: number;
  showScore?: boolean;
  footer?: ReactNode;
}

export function ChunkCard({ chunk, terms = [], badge, pills, highlighted, defaultOpen, threshold, showScore, footer }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);
  const text = open || chunk.text.length <= 240 ? chunk.text : `${chunk.text.slice(0, 240)}...`;
  const injected = INJECTION.test(chunk.text);
  return (
    <article className={`chunk rise ${highlighted ? "chunk-hot" : ""} ${injected ? "chunk-injected" : ""}`}>
      <header>
        {badge != null && <span className="chunk-badge">{badge}</span>}
        <div className="chunk-title">
          <b>{prettyDoc(chunk.doc_id)}</b>
          <span className="muted">{chunk.chunk_id.split("#")[1] ? `chunk ${chunk.chunk_id.split("#")[1]}` : ""}</span>
        </div>
        <Pill tone={`acl-${chunk.acl}`} title="Access level of the document">
          {chunk.acl}
        </Pill>
        <Pill tone="plain">{chunk.product}</Pill>
        {pills}
      </header>
      {showScore && (
        <div className="chunk-score">
          <span>Gemini relevance</span>
          <ScoreBar value={chunk.rerank_score} threshold={threshold} />
        </div>
      )}
      {injected && <div className="warn-ribbon">Hidden instruction aimed at AI assistants found in this chunk. This is the prompt-injection test document.</div>}
      <p className="chunk-text" onClick={() => setOpen(!open)}>
        {highlight(text, terms)}
      </p>
      <footer>
        <button className="link" onClick={() => setOpen(!open)}>
          {open ? "Show less" : chunk.text.length > 240 ? "Show full chunk" : ""}
        </button>
        <a href={chunk.url} target="_blank" rel="noreferrer" className="link">
          Source
        </a>
        {footer}
      </footer>
    </article>
  );
}
