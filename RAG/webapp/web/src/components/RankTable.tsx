import type { Chunk } from "../types";
import { prettyDoc } from "../lib/events";
import { Pill } from "./ui";

export interface RankRow {
  rank: number;
  chunk: Chunk;
  bm25Rank?: number | null;
  vectorRank?: number | null;
  score: number;
}

// A compact table showing why a chunk landed at its fused rank.
export function RankTable({ rows, limit = 10 }: { rows: RankRow[]; limit?: number }) {
  const shown = rows.slice(0, limit);
  const max = Math.max(...shown.map((row) => row.score), 1e-9);
  return (
    <table className="ranktable">
      <thead>
        <tr>
          <th>#</th>
          <th>Document</th>
          <th>BM25 rank</th>
          <th>Vector rank</th>
          <th>RRF score</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((row) => (
          <tr key={row.chunk.chunk_id}>
            <td>{row.rank}</td>
            <td>
              <b>{prettyDoc(row.chunk.doc_id)}</b> <Pill tone={`acl-${row.chunk.acl}`}>{row.chunk.acl}</Pill>
            </td>
            <td>{row.bm25Rank ? <Pill tone="bm25">#{row.bm25Rank}</Pill> : <span className="muted">not in top 50</span>}</td>
            <td>{row.vectorRank ? <Pill tone="vector">#{row.vectorRank}</Pill> : <span className="muted">not in top 50</span>}</td>
            <td>
              <span className="scorebar-track slim">
                <span className="scorebar-fill tone-fuse" style={{ width: `${(row.score / max) * 100}%` }} />
              </span>
              <small>{row.score.toFixed(4)}</small>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Movement({ from, to }: { from: number | null | undefined; to: number }) {
  if (from == null) return null;
  const delta = from - to;
  if (delta === 0) return <Pill tone="plain" title="Same position as before reranking">same</Pill>;
  return delta > 0 ? (
    <Pill tone="up" title={`Moved up from #${from}`}>
      up {delta}
    </Pill>
  ) : (
    <Pill tone="down" title={`Moved down from #${from}`}>
      down {-delta}
    </Pill>
  );
}
