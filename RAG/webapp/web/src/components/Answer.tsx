import { Fragment, type ReactNode, useState } from "react";
import type { Chunk, Source } from "../types";
import { ChunkCard } from "./ChunkCard";

function inline(text: string, onCite: (n: number | null) => void, active: number | null): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g).map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={index}>{part.slice(1, -1)}</code>;
    const cite = /^\[(\d+)\]$/.exec(part);
    if (cite) {
      const n = Number(cite[1]);
      return (
        <button key={index} className={`cite ${active === n ? "cite-on" : ""}`} onMouseEnter={() => onCite(n)} onMouseLeave={() => onCite(null)}>
          {n}
        </button>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

interface Props {
  text: string;
  sources: Source[];
  refused?: boolean;
  streaming?: boolean;
}

// The answer text with clickable citation chips. Hovering a chip highlights its source below.
export function Answer({ text, sources, refused, streaming }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const lines = text.split("\n").filter((line) => line.trim());
  return (
    <div className="answer-wrap">
      <div className={`answer ${refused ? "answer-refused" : ""}`}>
        {refused && <div className="kicker">Refused: the knowledge base does not contain this</div>}
        {lines.map((line, index) => {
          const bullet = /^\s*([-*]|\d+\.)\s+/.test(line);
          const body = line.replace(/^\s*([-*]|\d+\.)\s+/, "");
          return (
            <p key={index} className={bullet ? "bullet" : ""}>
              {inline(body, setActive, active)}
            </p>
          );
        })}
        {streaming && <span className="cursor" />}
      </div>
      {sources.length > 0 && (
        <div className="sources">
          <div className="kicker">Cited sources</div>
          {sources.map((source) => (
            <ChunkCard key={source.n} chunk={source.chunk} badge={source.n} highlighted={active === source.n} />
          ))}
        </div>
      )}
    </div>
  );
}

export function chunksOf(sources: Source[]): Chunk[] {
  return sources.map((source) => source.chunk);
}
