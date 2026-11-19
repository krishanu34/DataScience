import { Answer } from "../components/Answer";
import { AskPanel } from "../components/AskPanel";
import { ChunkCard } from "../components/ChunkCard";
import { Movement, RankTable } from "../components/RankTable";
import { ErrorBox, Flow, Lesson, Section, Stat, Waterfall } from "../components/ui";
import { useRun } from "../hooks/useRun";
import { useApp } from "../lib/app";
import { flowStates, fmtMs, lastOf, stageOf, tokensOf } from "../lib/events";
import type { Chunk, Source } from "../types";
import { PromptView } from "./SimpleRag";

function ChunkColumn({ title, chunks, hint }: { title: string; chunks: Chunk[]; hint: string }) {
  return (
    <div className="column">
      <h4>{title}</h4>
      <p className="hint">{hint}</p>
      {chunks.map((chunk) => (
        <ChunkCard key={chunk.chunk_id} chunk={chunk} badge={chunk.rank} />
      ))}
    </div>
  );
}

export function HybridRag() {
  const { examples } = useApp();
  const { events, running, error, start, stop } = useRun("hybrid");
  const bm25 = stageOf(events, "bm25");
  const vector = stageOf(events, "vector");
  const fuse = stageOf(events, "fuse");
  const rerank = stageOf(events, "rerank");
  const gate = stageOf(events, "gate");
  const prompt = stageOf(events, "prompt");
  const generate = stageOf(events, "generate");
  const final = lastOf(events, "final");
  const answer: string = final?.answer ?? tokensOf(events);
  const replay = lastOf(events, "start")?.replay;

  const done = new Set<string>();
  if (events.length) done.add("question");
  if (bm25 && vector) done.add("search");
  if (fuse) done.add("fuse");
  if (rerank) done.add("rerank");
  if (gate) done.add("gate");
  if (final) done.add("answer");
  const ids = ["question", "search", "fuse", "rerank", "gate", "answer"];
  const states = flowStates(ids, done, running);

  const pool = (fuse?.pool ?? []) as Chunk[];
  const reranked = (rerank?.chunks ?? []) as Chunk[];
  const stages = final?.timings?.stages as Record<string, number> | undefined;

  return (
    <div className="tab-grid">
      <aside>
        <AskPanel examples={examples.hybrid ?? []} running={running} onRun={start} onStop={stop} />
        <Lesson
          title="Hybrid RAG"
          summary="Keyword search and meaning search fail in different ways. Hybrid RAG runs both, merges the rankings, lets a language model re-read the best candidates, and refuses when even the best one is weak."
          points={[
            "BM25 finds exact words such as INC-48213 or an error code. Vectors find paraphrases.",
            "Reciprocal Rank Fusion rewards chunks that rank well in either list: weight / (c + rank).",
            "The reranker reads the question with each of 30 candidates and scores them 0 to 10. The top 5 are kept.",
            "A relevance gate refuses before the model writes anything if the best score is under 6.",
          ]}
          tryThis={[
            "Run the policy version question and watch the reranker order the two lifecycle policies.",
            "Run the hidden-instruction example: the reranker has been told to distrust passages that give it orders.",
            "Compare the latency bar here with Simple RAG. The reranker is the slowest stage.",
          ]}
          calls={[
            "ensemble = step08_hybrid_rag.build_ensemble_for_role(vectorstore, chunks, role)",
            "bm25.invoke(q) and vector.invoke(q), k = 50 each",
            "weighted RRF (same arithmetic as step05_ensemble.build_ensemble)",
            "step06_reranker.rerank(q, pool, llm, top_n)",
            "step06_reranker.MIN_RELEVANCE gate, then step07_simple_rag.PROMPT",
          ]}
        />
      </aside>

      <main>
        <ErrorBox message={error} />
        <Flow
          states={states}
          nodes={[
            { label: "Question" },
            { label: "BM25 + Vector", sub: "50 each", ms: bm25 && vector ? bm25.ms + vector.ms : null },
            { label: "Fuse", sub: "RRF, top 30", ms: fuse?.ms },
            { label: "Rerank", sub: "Gemini 0-10", ms: rerank?.ms },
            { label: "Gate", sub: `score >= ${gate?.threshold ?? 6}` },
            { label: "Answer", sub: "streamed" },
          ]}
        />

        {final && (
          <div className="stats rise">
            <Stat label="Time to first token" value={fmtMs(final.timings.ttft_ms)} hint="Everything before the answer starts counts: both searches, fusion and the rerank call." tone="accent" />
            <Stat label="Total" value={fmtMs(final.timings.total_ms)} />
            <Stat label="Best relevance" value={gate?.best_score ?? "n/a"} />
            <Stat label="Source of data" value={replay ? "recorded run" : "live run"} />
          </div>
        )}

        {stages && (
          <Section title="Where the time went" hint="Time to first token is the sum of the stages before the answer starts.">
            <Waterfall
              segments={[
                { label: "BM25", ms: stages.bm25 ?? 0, tone: "bm25" },
                { label: "Vector", ms: stages.vector ?? 0, tone: "vector" },
                { label: "Fuse", ms: stages.fuse ?? 0, tone: "fuse" },
                { label: "Rerank", ms: stages.rerank ?? 0, tone: "rerank" },
                { label: "Generate", ms: stages.generate ?? 0, tone: "llm" },
              ]}
            />
          </Section>
        )}

        {(bm25 || vector) && (
          <Section title="1. Two searches" hint={`Each retrieves 50 chunks. The top 8 are shown. Only chunks the role may read are searched.`}>
            <div className="columns two">
              {bm25 && <ChunkColumn title={`BM25 keyword search (${fmtMs(bm25.ms)})`} chunks={bm25.chunks} hint="Counts matching words, weighted by rarity." />}
              {vector && <ChunkColumn title={`Vector search (${fmtMs(vector.ms)})`} chunks={vector.chunks} hint="Compares the meaning of the question with each chunk." />}
            </div>
          </Section>
        )}

        {fuse && (
          <Section title="2. Merge with Reciprocal Rank Fusion" hint={`score = ${fuse.weights[0]} / (${fuse.c} + BM25 rank) + ${fuse.weights[1]} / (${fuse.c} + vector rank). A chunk missing from a list gets nothing from it.`}>
            <RankTable
              rows={pool.map((chunk) => ({ rank: chunk.rank ?? 0, chunk, bm25Rank: chunk.bm25_rank, vectorRank: chunk.vector_rank, score: chunk.rrf ?? 0 }))}
              limit={10}
            />
          </Section>
        )}

        {rerank && (
          <Section
            title="3. Gemini reranks the 30 candidates"
            hint={rerank.failed ? "The reranker failed, so the fusion order was kept." : `Each candidate gets 0-10. The best ${rerank.keep} are kept for the prompt. Arrows show the move from the fusion order.`}
          >
            <div className="chunk-list">
              {reranked.slice(0, 10).map((chunk) => (
                <div key={chunk.chunk_id} className={`kept ${(chunk.rank ?? 99) <= rerank.keep ? "kept-yes" : "kept-no"}`}>
                  <ChunkCard chunk={chunk} badge={chunk.rank} showScore threshold={gate?.threshold} pills={<Movement from={chunk.ensemble_rank} to={chunk.rank ?? 0} />} />
                  {chunk.rank === rerank.keep && <div className="cutline">Cut line: only the chunks above go into the prompt</div>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {gate && (
          <Section title="4. Relevance gate">
            <div className={`gate ${gate.passed ? "gate-pass" : "gate-stop"}`}>
              <b>{gate.passed ? "Pass" : "Refuse"}</b>
              <span>
                Best score {gate.best_score ?? "n/a"} {gate.passed ? "is at least" : "is below"} the threshold {gate.threshold}.
                {!gate.passed && " No language model call is made, so a weak match can never turn into a confident answer."}
              </span>
            </div>
          </Section>
        )}

        {prompt && (
          <Section title="5. The prompt" hint="The same prompt as Simple RAG, with the reranked top 5.">
            <PromptView prompt={prompt} />
          </Section>
        )}

        {(generate || final) && (
          <Section title="6. The answer" hint={generate ? `The first token arrived at ${fmtMs(generate.ttft_ms)}.` : undefined}>
            <Answer text={answer} sources={(final?.sources ?? []) as Source[]} refused={final?.refused} streaming={running && !final} />
          </Section>
        )}

        {!events.length && <p className="empty">Pick an example to watch the hybrid pipeline run, stage by stage.</p>}
      </main>
    </div>
  );
}
