import { Answer } from "../components/Answer";
import { AskPanel } from "../components/AskPanel";
import { ChunkCard } from "../components/ChunkCard";
import { ErrorBox, Lesson, Pill, ScoreBar, Section, Stat } from "../components/ui";
import { useRun } from "../hooks/useRun";
import { useApp } from "../lib/app";
import { allOf, fmtMs, lastOf } from "../lib/events";
import type { Chunk, Source } from "../types";

const TOOL_INFO: Record<string, { tone: string; label: string; why: string }> = {
  search_hybrid: { tone: "fuse", label: "Hybrid search", why: "Keywords and meaning together, then Gemini scores each result 0-10. The default, and the slowest." },
  search_keyword: { tone: "bm25", label: "Keyword search", why: "BM25 only. Fast, and best for identifiers such as incident IDs and error codes. No relevance score." },
  search_semantic: { tone: "vector", label: "Semantic search", why: "Vectors only. Best when the question shares no words with the documents. No relevance score." },
};

interface Turn {
  index: number;
  text: string;
  ended: boolean;
  calls: { id: string; name: string; args: Record<string, string> }[];
}

export function AgenticRag() {
  const { examples } = useApp();
  const { events, running, error, start, stop } = useRun("agentic");
  const init = lastOf(events, "agent_init");
  const final = lastOf(events, "final");
  const replay = lastOf(events, "start")?.replay;
  const fallback = lastOf(events, "fallback");
  const results = new Map<string, any>(allOf(events, "tool_result").map((r) => [r.id, r]));

  const turns: Turn[] = [];
  for (const { event, data } of events) {
    if (event === "model_token") {
      turns[data.turn] ??= { index: data.turn, text: "", ended: false, calls: [] };
      turns[data.turn].text += data.text;
    } else if (event === "model_end") {
      turns[data.turn] ??= { index: data.turn, text: "", ended: false, calls: [] };
      turns[data.turn].text = data.text || turns[data.turn].text;
      turns[data.turn].ended = true;
      turns[data.turn].calls = data.tool_calls;
    }
  }
  const searches = turns.reduce((sum, turn) => sum + turn.calls.length, 0);
  const lastTurnIndex = turns.length - 1;
  const threshold = init?.min_relevance ?? 6;

  return (
    <div className="tab-grid">
      <aside>
        <AskPanel examples={examples.agentic ?? []} running={running} onRun={start} onStop={stop} />
        <Lesson
          title="Agentic RAG"
          summary="Instead of a fixed pipeline, a language model decides what to do next. It can pick a search tool, read the results, reword its query, search again, and stop when it has enough evidence."
          points={[
            "The agent has three tools: hybrid, keyword and semantic search. It chooses by reading their descriptions.",
            "The system prompt gives it rules: reword and retry when the best score is below 6, stop as soon as a result scores 6 or more.",
            "The role is fixed outside the model. No tool lets the agent choose what it may read.",
            "A step limit and a search budget stop runaway loops. The tools enforce them in code: after 4 searches, or when a search finds nothing new, the tool tells the agent to answer.",
          ]}
          tryThis={[
            "Run the two-hop question: the agent must search twice, once for the runbook and once for the Azure article.",
            "Run the vague question and look for a low score followed by a reworded query.",
            "Run the break-glass question as a guest. The agent cannot find what its role cannot read.",
          ]}
          calls={[
            "tools = step09_agentic_rag.make_tools(ensemble, llm, book)",
            "langchain.agents.create_agent(model=llm, tools=tools, system_prompt=SYSTEM_PROMPT)",
            "agent.stream(..., stream_mode=['updates', 'messages']) turns each step into an event",
            "step07_simple_rag.cited_sources(answer, book['docs'])",
          ]}
        />
      </aside>

      <main>
        <ErrorBox message={error} />

        {(running || final) && (
          <div className="stats rise">
            <Stat label="LLM turns" value={turns.length} hint="Each model call is one turn." />
            <Stat label="Searches" value={searches} />
            <Stat label="Time to first token" value={fmtMs(final?.timings?.ttft_ms)} hint="First token of the final answer. Every search before it adds to the wait." tone="accent" />
            <Stat label="Total" value={final ? fmtMs(final.timings.total_ms) : running ? "running" : "n/a"} />
            {final && <Stat label="Source of data" value={replay ? "recorded run" : "live run"} />}
          </div>
        )}

        {init && (
          <details className="card setup rise">
            <summary>
              <b>What the agent starts with</b> <span className="muted">system prompt, {init.tools.length} tools, limit of {init.max_steps} steps</span>
            </summary>
            <div className="toolgrid">
              {init.tools.map((tool: any) => (
                <div key={tool.name} className="tool">
                  <Pill tone={TOOL_INFO[tool.name]?.tone ?? "plain"}>{tool.name}</Pill>
                  <p>{tool.description}</p>
                </div>
              ))}
            </div>
            <pre>{init.system_prompt}</pre>
          </details>
        )}

        <div className="timeline">
          {turns.map((turn, index) => {
            const isFinal = turn.ended && turn.calls.length === 0;
            return (
              <div key={turn.index} className="step">
                <div className="step-card llm rise">
                  <div className="kicker">LLM turn {turn.index + 1}</div>
                  {isFinal ? (
                    <p>The model has enough evidence and writes the final answer.</p>
                  ) : turn.text ? (
                    <p className="thought">{turn.text}</p>
                  ) : turn.ended ? (
                    <p>The model chose to call a tool.</p>
                  ) : (
                    <p className="muted">
                      Thinking <span className="cursor" />
                    </p>
                  )}
                </div>

                {turn.calls.map((call) => {
                  const result = results.get(call.id);
                  const info = TOOL_INFO[call.name];
                  return (
                    <div key={call.id} className="tool-run">
                      <div className="step-card call rise">
                        <div className="kicker">Tool call</div>
                        <Pill tone={info?.tone ?? "plain"}>{info?.label ?? call.name}</Pill>
                        <code className="query">{call.args.query}</code>
                        <p className="hint">{info?.why}</p>
                      </div>
                      {result ? (
                        <div className="step-card result rise">
                          <div className="kicker">
                            Results in {fmtMs(result.ms)}
                            {result.best_score != null && (
                              <>
                                {" "}
                                <ScoreBar value={result.best_score} threshold={threshold} />
                              </>
                            )}
                          </div>
                          {result.best_score != null && result.best_score < threshold && (
                            <p className="decision bad">Best score is below {threshold}. The prompt rule says: reword the query and try again.</p>
                          )}
                          {result.best_score != null && result.best_score >= threshold && (
                            <p className="decision good">Best score is {threshold} or more. The prompt rule says: stop searching if it answers the question.</p>
                          )}
                          {result.best_score == null && <p className="hint">This tool does not score results, so the agent judges them by reading.</p>}
                          <div className="chunk-list">
                            {(result.chunks as Chunk[]).map((chunk) => (
                              <ChunkCard key={chunk.chunk_id} chunk={chunk} badge={chunk.n} showScore={chunk.rerank_score != null} threshold={threshold} />
                            ))}
                            {result.chunks.length === 0 && <p className={result.message && result.message !== "No results." ? "decision bad" : "muted"}>{result.message || "No results for this role."}</p>}
                          </div>
                        </div>
                      ) : (
                        running && index === lastTurnIndex && (
                          <div className="step-card result pending">
                            <span className="spinner" /> Searching
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {fallback && <p className="decision bad">{fallback.reason} The agent answers with the evidence it has.</p>}

        {(final || turns.some((t) => t.ended && t.calls.length === 0)) && (
          <Section title="Final answer">
            <Answer
              text={final?.answer ?? turns[lastTurnIndex]?.text ?? ""}
              sources={(final?.sources ?? []) as Source[]}
              refused={final?.refused}
            />
          </Section>
        )}

        {!events.length && <p className="empty">Pick an example to watch the agent decide, search, read and answer.</p>}
      </main>
    </div>
  );
}
