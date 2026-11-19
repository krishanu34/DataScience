import { Answer } from "../components/Answer";
import { AskPanel } from "../components/AskPanel";
import { ChunkCard } from "../components/ChunkCard";
import { ErrorBox, Lesson, Pill, ScoreBar, Section, Stat } from "../components/ui";
import { useRun } from "../hooks/useRun";
import { useApp } from "../lib/app";
import { allOf, fmtMs, lastOf, tokensOf } from "../lib/events";
import type { Chunk, RunEvent, Source } from "../types";

type NodeState = "idle" | "active" | "done";

interface Attempt {
  kind: "search" | "rewrite";
  attempt: number;
  query: string;
  running: boolean;
  score?: number;
  newQuery?: string;
  ms?: number;
}

function nodeStates(events: RunEvent[]): Record<string, NodeState> {
  const states: Record<string, NodeState> = { plan: "idle", research: "idle", answer: "idle" };
  for (const { event, data } of events) {
    if (event === "node") states[data.node] = data.status === "start" ? "active" : "done";
  }
  return states;
}

function Graph({ states, lanes, active }: { states: Record<string, NodeState>; lanes: string[]; active: boolean }) {
  const count = Math.max(lanes.length, 1);
  const height = Math.max(150, count * 62 + 30);
  const mid = height / 2;
  const laneY = (index: number) => mid + (index - (count - 1) / 2) * 62;
  const edge = (from: NodeState, to: NodeState) => (from === "done" && to !== "idle" ? "edge on" : from === "active" ? "edge flow" : "edge");
  const box = (x: number, y: number, label: string, state: NodeState, width = 96) => (
    <g key={label + y} className={`gnode gnode-${state}`}>
      <rect x={x} y={y - 20} width={width} height={40} rx={12} />
      <text x={x + width / 2} y={y + 5} textAnchor="middle">
        {label}
      </text>
    </g>
  );
  const first: NodeState = active || states.plan !== "idle" ? "done" : "idle";
  return (
    <svg className="graph" viewBox={`0 0 760 ${height}`} role="img" aria-label="LangGraph workflow">
      <path className={edge(first, states.plan)} d={`M 70 ${mid} H 120`} />
      <path className={edge(states.plan, states.research)} d={`M 216 ${mid} H 270`} />
      {Array.from({ length: count }).map((_, index) => (
        <g key={index}>
          <path className={edge(states.plan, states.research)} d={`M 270 ${mid} C 300 ${mid}, 300 ${laneY(index)}, 330 ${laneY(index)}`} />
          <path className={edge(states.research, states.answer)} d={`M 450 ${laneY(index)} C 480 ${laneY(index)}, 480 ${mid}, 510 ${mid}`} />
        </g>
      ))}
      <path className={edge(states.answer, states.answer === "done" ? "done" : "idle")} d={`M 606 ${mid} H 660`} />
      <circle className={`gdot ${first === "done" ? "gdot-on" : ""}`} cx={50} cy={mid} r={20} />
      <text x={50} y={mid + 4} textAnchor="middle" className="gsmall">
        START
      </text>
      {box(120, mid, "plan", states.plan)}
      {Array.from({ length: count }).map((_, index) => box(330, laneY(index), lanes[index] ? `research ${index + 1}` : "research", states.research, 120))}
      {box(510, mid, "answer", states.answer)}
      <circle className={`gdot ${states.answer === "done" ? "gdot-on" : ""}`} cx={690} cy={mid} r={20} />
      <text x={690} y={mid + 4} textAnchor="middle" className="gsmall">
        END
      </text>
    </svg>
  );
}

export function LangGraphRag() {
  const { examples } = useApp();
  const { events, running, error, start, stop } = useRun("langgraph");
  const init = lastOf(events, "graph_init");
  const plan = lastOf(events, "plan");
  const final = lastOf(events, "final");
  const replay = lastOf(events, "start")?.replay;
  const states = nodeStates(events);
  const lanes: string[] = plan?.sub_questions ?? [];
  const minScore = init?.min_score ?? 6;
  const findings = new Map<string, any>(allOf(events, "research_done").map((f) => [f.sub_question, f]));

  const attempts = new Map<string, Attempt[]>();
  for (const { event, data } of events) {
    if (event !== "research_step") continue;
    const list = attempts.get(data.sub_question) ?? [];
    if (data.status === "start") list.push({ kind: data.kind, attempt: data.attempt, query: data.query, running: true });
    else {
      const item = list.find((a) => a.kind === data.kind && a.attempt === data.attempt && a.running);
      if (item) Object.assign(item, { running: false, score: data.score, newQuery: data.new_query, ms: data.ms });
    }
    attempts.set(data.sub_question, list);
  }
  const allAttempts = [...attempts.values()].flat();
  const answer: string = final?.answer ?? tokensOf(events);

  return (
    <div className="tab-grid">
      <aside>
        <AskPanel examples={examples.langgraph ?? []} running={running} onRun={start} onStop={stop} />
        <Lesson
          title="LangGraph RAG"
          summary="The same agentic idea as an explicit workflow. You decide the steps and the loops; the model only fills in each step. That makes behaviour predictable, testable and easy to draw."
          points={[
            "plan: split the message into sub-questions, only when it asks about different subjects.",
            "research: one copy runs per sub-question, in parallel. Each one searches, and if the best score is under 6 it rewrites the query and searches again, at most twice.",
            "answer: combine the good evidence, say which parts were not found, and cite sources.",
            "State is a typed dictionary. Findings from parallel branches are joined with operator.add.",
          ]}
          tryThis={[
            "Run the three-questions-in-one example and watch three research lanes work in parallel.",
            "Run the half-answerable example: one lane succeeds, the other exhausts its rewrites.",
            "Compare with the Agentic tab: there the model decides when to loop, here the graph does.",
          ]}
          calls={[
            "graph = step10_langgraph_rag.build_graph(ensemble, llm)",
            "graph.stream({'question': q}, stream_mode=['updates', 'messages'])",
            "a callback reports each search and rewrite of build_research_graph while it runs",
          ]}
        />
      </aside>

      <main>
        <ErrorBox message={error} />

        {(running || final) && (
          <div className="stats rise">
            <Stat label="Sub-questions" value={lanes.length || "..."} />
            <Stat label="Searches" value={allAttempts.filter((a) => a.kind === "search").length} />
            <Stat label="Rewrites" value={allAttempts.filter((a) => a.kind === "rewrite").length} hint="A weak first search makes the graph reword the query." />
            <Stat label="Time to first token" value={fmtMs(final?.timings?.ttft_ms)} hint="Plan, all research and the start of the answer." tone="accent" />
            <Stat label="Total" value={final ? fmtMs(final.timings.total_ms) : running ? "running" : "n/a"} />
            {final && <Stat label="Source of data" value={replay ? "recorded run" : "live run"} />}
          </div>
        )}

        {init && (
          <Section title="The workflow" hint="Nodes light up as the backend runs them. The research node fans out into one parallel lane per sub-question.">
            <Graph states={states} lanes={lanes} active={running || !!final} />
          </Section>
        )}

        {plan && (
          <Section title="1. Plan" hint="The planner splits the message only when it covers different subjects.">
            <ol className="plan">
              {lanes.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </Section>
        )}

        {lanes.length > 0 && (
          <Section title="2. Research, in parallel" hint={`A search scoring under ${minScore} triggers a rewrite. After 2 rewrites the lane gives up and the part is reported as not found.`}>
            <div className="lanes">
              {lanes.map((question, index) => {
                const finding = findings.get(question);
                const list = attempts.get(question) ?? [];
                return (
                  <div key={question} className="lane rise">
                    <header>
                      <span className="chunk-badge">{index + 1}</span>
                      <b>{question}</b>
                      {finding ? <Pill tone={finding.accepted ? "up" : "down"}>{finding.accepted ? "evidence found" : "not found"}</Pill> : <Pill tone="warn">working</Pill>}
                    </header>
                    <ol className="attempts">
                      {list.map((item, position) => (
                        <li key={position} className={`attempt attempt-${item.kind}`}>
                          {item.kind === "search" ? (
                            <>
                              <span className="kicker">Search {item.attempt}</span>
                              <code className="query">{item.query}</code>
                              {item.running ? (
                                <span className="spinner" />
                              ) : (
                                <>
                                  <ScoreBar value={item.score ?? null} threshold={minScore} />
                                  <small>{fmtMs(item.ms)}</small>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="kicker">Rewrite</span>
                              {item.running ? <span className="spinner" /> : <code className="query">{item.newQuery}</code>}
                            </>
                          )}
                        </li>
                      ))}
                    </ol>
                    {finding && finding.accepted && (
                      <details>
                        <summary>Best evidence found ({finding.chunks.length} chunks)</summary>
                        <div className="chunk-list">
                          {(finding.chunks as Chunk[]).map((chunk) => (
                            <ChunkCard key={chunk.chunk_id} chunk={chunk} showScore threshold={minScore} />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {(answer || states.answer !== "idle") && (
          <Section title="3. Answer" hint="Only evidence from lanes that scored high enough is used. Missing parts are reported honestly.">
            <Answer text={answer} sources={(final?.sources ?? []) as Source[]} refused={final?.refused} streaming={running && !final} />
          </Section>
        )}

        {!events.length && <p className="empty">Pick an example to watch the graph plan, research and answer.</p>}
      </main>
    </div>
  );
}
