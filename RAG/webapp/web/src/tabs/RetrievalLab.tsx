import { useMemo, useRef, useState } from "react";
import { AskPanel } from "../components/AskPanel";
import { ChunkCard } from "../components/ChunkCard";
import { Movement, RankTable } from "../components/RankTable";
import { ErrorBox, Lesson, Pill, Section, Stat } from "../components/ui";
import { postJSON } from "../api";
import { useApp } from "../lib/app";
import { fmtMs } from "../lib/events";
import { fuse } from "../lib/rrf";
import type { Chunk, Mode, RerankResult, Role, SearchResult } from "../types";

interface Request {
  question: string;
  role: Role;
  mode: Mode;
}

function Slider({ label, hint, value, min, max, step, onChange, format }: { label: string; hint: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="slider" title={hint}>
      <span>
        {label} <b>{format ? format(value) : value}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <small>{hint}</small>
    </label>
  );
}

export function RetrievalLab() {
  const { examples } = useApp();
  const [result, setResult] = useState<SearchResult | null>(null);
  const [rerank, setRerank] = useState<RerankResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [reranking, setReranking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bm25Weight, setBm25Weight] = useState(0.5);
  const [c, setC] = useState(60);
  const [pool, setPool] = useState(30);
  const [shown, setShown] = useState(6);
  const request = useRef<Request | null>(null);

  const search = async (question: string, role: Role, mode: Mode) => {
    request.current = { question, role, mode };
    setLoading(true);
    setError(null);
    setRerank(null);
    try {
      const data = await postJSON<SearchResult>("/api/retrieval/search", request.current);
      setResult(data);
      setBm25Weight(data.weights[0]);
      setC(data.c);
      setPool(data.pool);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setLoading(false);
    }
  };

  const fused = useMemo(() => (result ? fuse(result.bm25, result.vector, bm25Weight, c) : []), [result, bm25Weight, c]);
  const candidates = fused.slice(0, pool);

  const runRerank = async () => {
    if (!request.current) return;
    setReranking(true);
    setError(null);
    try {
      setRerank(await postJSON<RerankResult>("/api/retrieval/rerank", { ...request.current, chunk_ids: candidates.map((item) => item.chunk.chunk_id) }));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setReranking(false);
    }
  };

  const byId = useMemo(() => {
    const map = new Map<string, Chunk>();
    result?.bm25.forEach((chunk) => map.set(chunk.chunk_id, chunk));
    result?.vector.forEach((chunk) => map.set(chunk.chunk_id, chunk));
    return map;
  }, [result]);

  const top10Bm25 = new Set(result?.bm25.slice(0, 10).map((chunk) => chunk.chunk_id));
  const overlap = result ? result.vector.slice(0, 10).filter((chunk) => top10Bm25.has(chunk.chunk_id)).length : 0;
  const fusedRank = new Map(fused.map((item) => [item.chunk.chunk_id, item.rank]));
  const reranked = rerank ? rerank.scores.map((item, index) => ({ chunk: byId.get(item.chunk_id)!, score: item.score, rank: index + 1 })).filter((item) => item.chunk) : [];
  const terms = result?.query_tokens ?? [];

  return (
    <div className="tab-grid">
      <aside>
        <AskPanel examples={examples.retrieval ?? []} running={loading} runLabel="Search" onRun={search} />
        <Lesson
          title="Retrieval lab"
          summary="Retrieval decides which few chunks the model will ever see, so everything downstream is limited by it. Two kinds of search see different things, and a reranker sorts out the disagreement."
          points={[
            "BM25 scores chunks by the words they share with the question, favouring rare words. It misses paraphrases.",
            "Vector search compares meaning, so it finds paraphrases but can blur exact identifiers.",
            "Reciprocal Rank Fusion merges the two rankings. You can change the weights and watch the order change instantly.",
            "A reranker reads the question and each candidate together. It is slower but judges relevance directly.",
          ]}
          tryThis={[
            "Search the incident ID example, then slide the BM25 weight to 0. Does the runbook drop?",
            "Search the paraphrase example and look at what BM25 returns.",
            "Switch between guest and security admin on the break-glass example.",
            "Click Rerank and see which chunks move.",
          ]}
          calls={["ensemble.retrievers -> (bm25, vector), k = 50 each", "step04_bm25.tokenize(question)", "fusion is computed in your browser from the two lists", "step06_reranker.rerank(question, pool, llm)"]}
        />
      </aside>

      <main>
        <ErrorBox message={error} />
        {!result && !loading && <p className="empty">Pick an example to retrieve chunks with both searches.</p>}
        {loading && <p className="empty"><span className="spinner" /> Searching</p>}

        {result && (
          <>
            <div className="stats rise">
              <Stat label="BM25 search" value={fmtMs(result.ms.bm25)} />
              <Stat label="Vector search" value={fmtMs(result.ms.vector)} hint="Includes the call that embeds the question." />
              <Stat label="Top 10 in both lists" value={`${overlap} of 10`} hint="How much the two searches agree." />
              <Stat label="Data" value={result.mode === "cached" ? "recorded" : "live"} />
            </div>

            <Section title="How the question is tokenized for BM25" hint="Identifiers stay whole and their parts are added too, so INC-48213 matches both INC-48213 and 48213.">
              <div className="tokens">
                {result.query_tokens.map((token, index) => (
                  <Pill key={`${token}${index}`} tone={/[-_.]/.test(token) ? "bm25" : "plain"}>
                    {token}
                  </Pill>
                ))}
              </div>
            </Section>

            <Section title="Tune the fusion" hint="The merged ranking is recomputed in your browser as you move the sliders.">
              <div className="sliders">
                <Slider label="BM25 weight" hint={`Vector weight is ${(1 - bm25Weight).toFixed(2)}`} value={bm25Weight} min={0} max={1} step={0.05} onChange={setBm25Weight} format={(v) => v.toFixed(2)} />
                <Slider label="c" hint="Small c makes the top ranks count much more." value={c} min={1} max={100} step={1} onChange={setC} />
                <Slider label="Pool size" hint="How many fused chunks go to the reranker." value={pool} min={5} max={50} step={5} onChange={setPool} />
                <Slider label="Chunks shown" hint="Per column." value={shown} min={3} max={12} step={1} onChange={setShown} />
              </div>
            </Section>

            <div className="columns four">
              <div className="column">
                <h4><i className="dot seg-bm25" /> BM25</h4>
                <p className="hint">Matching words are highlighted.</p>
                {result.bm25.slice(0, shown).map((chunk) => (
                  <ChunkCard key={chunk.chunk_id} chunk={chunk} badge={chunk.rank} terms={terms} />
                ))}
              </div>
              <div className="column">
                <h4><i className="dot seg-vector" /> Vector</h4>
                <p className="hint">Closest by meaning.</p>
                {result.vector.slice(0, shown).map((chunk) => (
                  <ChunkCard key={chunk.chunk_id} chunk={chunk} badge={chunk.rank} />
                ))}
              </div>
              <div className="column">
                <h4><i className="dot seg-fuse" /> Fused (RRF)</h4>
                <p className="hint">Open a card to see the arithmetic.</p>
                {fused.slice(0, shown).map((item) => (
                  <ChunkCard
                    key={item.chunk.chunk_id}
                    chunk={item.chunk}
                    badge={item.rank}
                    pills={
                      <>
                        {item.bm25Rank && <Pill tone="bm25">BM25 #{item.bm25Rank}</Pill>}
                        {item.vectorRank && <Pill tone="vector">Vec #{item.vectorRank}</Pill>}
                      </>
                    }
                    footer={
                      <span className="formula" title="weight / (c + rank), summed over the lists">
                        {item.parts.map((part) => `${part.weight.toFixed(2)}/(${c}+${part.rank})`).join(" + ")} = {item.score.toFixed(4)}
                      </span>
                    }
                  />
                ))}
              </div>
              <div className="column">
                <h4><i className="dot seg-rerank" /> Reranked</h4>
                {!rerank && (
                  <>
                    <p className="hint">Gemini will read the top {candidates.length} fused chunks and score each 0-10.</p>
                    <button className="btn" onClick={runRerank} disabled={reranking}>
                      {reranking ? "Scoring..." : `Rerank top ${candidates.length}`}
                    </button>
                  </>
                )}
                {rerank && (
                  <>
                    <p className="hint">
                      Scored in {fmtMs(rerank.ms)}.{rerank.failed && " The reranker failed, so the fusion order was kept."}
                      {rerank.unscored > 0 && ` ${rerank.unscored} chunks were not scored in the recorded run.`}
                    </p>
                    {reranked.slice(0, shown).map((item) => (
                      <ChunkCard
                        key={item.chunk.chunk_id}
                        chunk={{ ...item.chunk, rerank_score: item.score }}
                        badge={item.rank}
                        showScore
                        threshold={6}
                        pills={<Movement from={fusedRank.get(item.chunk.chunk_id)} to={item.rank} />}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>

            <Section title="Why the fused order looks like this" hint="Chunks near the top of both lists win. A chunk in only one list can still place well when it ranks very high there.">
              <RankTable rows={fused.map((item) => ({ rank: item.rank, chunk: item.chunk, bm25Rank: item.bm25Rank, vectorRank: item.vectorRank, score: item.score }))} limit={10} />
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
