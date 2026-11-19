import { useEffect, useState } from "react";
import { getJSON } from "../api";
import { ErrorBox, Pill, Section, Stat } from "../components/ui";
import { PLAIN_METRICS } from "../data/evalcopy";

const PIPELINE_LABEL: Record<string, string> = { bm25: "BM25", vector: "Vector", ensemble: "Ensemble (RRF)", rerank: "Ensemble + rerank" };
const PIPELINE_TONE: Record<string, string> = { bm25: "bm25", vector: "vector", ensemble: "fuse", rerank: "rerank" };

interface Summary {
  available: boolean;
  pipelines: string[];
  metrics: string[];
  n_answerable: number;
  overall: Record<string, Record<string, number>>;
  by_category: Record<string, { n: number } & Record<string, any>>;
  reranker_gain: { improved: number; same: number; regressed: number; changes: { id: string; question: string; before: number; after: number }[] };
  separation: { answerable: Sep[]; refuse: Sep[]; threshold: number };
  acl: Record<string, { above_role: number; blocked_retrieved: number }>;
  golden: { total: number; category: Record<string, number>; expected_behavior: Record<string, number>; role: Record<string, number>; origin: Record<string, number> };
}

interface Sep {
  id: string;
  question: string;
  score: number;
  category: string;
}

const heat = (value: number) => ({ background: `rgba(52, 211, 153, ${0.08 + value * 0.5})` });

function Bars({ data, label }: { data: Record<string, number>; label: string }) {
  const max = Math.max(...Object.values(data), 1);
  return (
    <div className="bars">
      <div className="kicker">{label}</div>
      {Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => (
          <div key={name} className="bar-row">
            <span>{name.replace(/_/g, " ")}</span>
            <span className="scorebar-track">
              <span className="scorebar-fill tone-good" style={{ width: `${(value / max) * 100}%` }} />
            </span>
            <b>{value}</b>
          </div>
        ))}
    </div>
  );
}

function Strip({ separation }: { separation: Summary["separation"] }) {
  const rows: [string, Sep[], string][] = [
    ["Answerable", separation.answerable, "#34d399"],
    ["Should refuse", separation.refuse, "#f472b6"],
  ];
  const x = (score: number) => 90 + (score / 10) * 560;
  return (
    <svg className="strip" viewBox="0 0 700 200" role="img" aria-label="Best rerank score for answerable and refuse questions">
      {[0, 2, 4, 6, 8, 10].map((tick) => (
        <g key={tick}>
          <line x1={x(tick)} x2={x(tick)} y1={20} y2={150} className="gridline" />
          <text x={x(tick)} y={170} textAnchor="middle" className="gsmall">
            {tick}
          </text>
        </g>
      ))}
      <line x1={x(separation.threshold)} x2={x(separation.threshold)} y1={10} y2={155} className="thresholdline" />
      <text x={x(separation.threshold) + 6} y={16} className="gsmall">
        threshold {separation.threshold}
      </text>
      {rows.map(([label, items, color], rowIndex) => {
        const y = 55 + rowIndex * 65;
        const seen = new Map<number, number>();
        return (
          <g key={label}>
            <text x={10} y={y + 4} className="glabel">
              {label}
            </text>
            {items.map((item) => {
              const stack = seen.get(item.score) ?? 0;
              seen.set(item.score, stack + 1);
              return (
                <circle key={item.id} cx={x(item.score)} cy={y - 18 + (stack % 8) * 5} r={3.4} fill={color} opacity={0.85}>
                  <title>{`${item.id} (${item.category}): ${item.score}  ${item.question}`}</title>
                </circle>
              );
            })}
          </g>
        );
      })}
      <text x={x(5)} y={192} textAnchor="middle" className="gsmall">
        best Gemini relevance score for the question
      </text>
    </svg>
  );
}

export function Results() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState("MRR");

  useEffect(() => {
    getJSON<Summary>("/api/evals/summary").then(setSummary, (problem) => setError(String(problem.message ?? problem)));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!summary) return <p className="empty">Loading results...</p>;
  if (!summary.available) return <p className="empty">No retrieval results yet. Run <code>python eval01_retrieval.py</code> in the RAG folder, then reload.</p>;

  const lowAnswerable = summary.separation.answerable.filter((item) => item.score < summary.separation.threshold);
  const highRefuse = summary.separation.refuse.filter((item) => item.score >= summary.separation.threshold);
  const gain = summary.reranker_gain;
  const best = (name: string) => Math.max(...summary.pipelines.map((p) => summary.overall[p][name]));

  return (
    <div className="results">
      <section className="card guide">
        <div className="kicker">How to read this page</div>
        <p>
          Every test question was run through four retrieval pipelines and scored against the documents known to be right. This page averages those scores. <b>Higher is better, and 1.0 is perfect.</b> Green cells are the best in
          their column. New to the scores? Open <b>Start here</b> for a two-minute explanation, or <b>Score one question</b> to watch a single question being scored.
        </p>
      </section>

      <div className="stats">
        <Stat label="Questions in the golden set" value={summary.golden.total} />
        <Stat label="With relevant documents" value={summary.n_answerable} />
        <Stat label="Pipelines compared" value={summary.pipelines.length} />
        <Stat label="Access control leaks" value={Object.values(summary.acl).reduce((sum, a) => sum + a.above_role + a.blocked_retrieved, 0)} tone="accent" hint="Target: 0" />
      </div>

      <Section title="Overall scores: did the right documents come back?" hint="Averages over the questions that have right documents. R@k means recall in the top k results; for example R@5 asks whether the right documents were in the top 5.">
        <div className="table-scroll">
          <table className="ranktable heat">
            <thead>
              <tr>
                <th>Pipeline</th>
                {summary.metrics.map((name) => (
                  <th key={name} title={PLAIN_METRICS.find((m) => m.key === name)?.asks ?? ""}>
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.pipelines.map((pipeline) => (
                <tr key={pipeline}>
                  <td>
                    <Pill tone={PIPELINE_TONE[pipeline]}>{PIPELINE_LABEL[pipeline]}</Pill>
                  </td>
                  {summary.metrics.map((name) => {
                    const value = summary.overall[pipeline][name];
                    return (
                      <td key={name} style={heat(value)} className={value === best(name) ? "best" : ""}>
                        {value.toFixed(3)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="explain">
          <li>
            <b>Read it left to right:</b> a higher recall at small k means the right document is found early. MRR and nDCG reward finding it first.
          </li>
          <li>
            <b>Precision@5 is low for every pipeline</b> because most questions have only one or two relevant documents. Five results can never all be relevant.
          </li>
          <li>
            <b>Recall@50 for the reranker</b> can be a little lower than the ensemble, because it only reorders the top 30 candidates.
          </li>
        </ul>
      </Section>

      <Section
        title="Which kinds of question are hard?"
        hint="The same scores, split by question type. Pick a score on the right. A short bar means that pipeline struggles with that type."
        right={
          <div className="toggle">
            {["MRR", "R@5", "nDCG@5"].map((name) => (
              <button key={name} className={metric === name ? "on" : ""} onClick={() => setMetric(name)}>
                {name}
              </button>
            ))}
          </div>
        }
      >
        <div className="catbars">
          {Object.entries(summary.by_category).map(([category, data]) => (
            <div key={category} className="catrow">
              <b>
                {category.replace(/_/g, " ")} <small>({data.n})</small>
              </b>
              <div>
                {summary.pipelines.map((pipeline) => (
                  <div key={pipeline} className="bar-row">
                    <span>{PIPELINE_LABEL[pipeline]}</span>
                    <span className="scorebar-track">
                      <span className={`scorebar-fill tone-${PIPELINE_TONE[pipeline]}`} style={{ width: `${data[metric][pipeline] * 100}%` }} />
                    </span>
                    <b>{data[metric][pipeline].toFixed(2)}</b>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Did reranking help?" hint="For each question, the position of the first right document before and after Gemini reranked the candidates. Closer to 1.00 is better.">
        <div className="stats">
          <Stat label="Improved" value={gain.improved} />
          <Stat label="Unchanged" value={gain.same} />
          <Stat label="Regressed" value={gain.regressed} />
        </div>
        <ul className="changes">
          {gain.changes.map((change) => (
            <li key={change.id} className={change.after > change.before ? "up" : "down"}>
              <code>{change.id}</code>
              <span>
                {change.before.toFixed(2)} to {change.after.toFixed(2)}
              </span>
              <em>{change.question}</em>
            </li>
          ))}
        </ul>
        <p className="hint">A drop does not always mean an error: a correct document that the labels do not list may now rank first. Check the labels before blaming the reranker.</p>
      </Section>

      <Section title="Would the refusal gate work?" hint="The system refuses when the best Gemini score is below the threshold. Each dot is one question: green ones should be answered, pink ones should be refused. A good threshold has green on the right and pink on the left.">
        <Strip separation={summary.separation} />
        <ul className="explain">
          <li>
            <b>{lowAnswerable.length} answerable questions</b> score below the threshold and would be wrongly refused:{" "}
            {lowAnswerable.map((item) => item.id).join(", ") || "none"}.
          </li>
          <li>
            <b>{highRefuse.length} questions that should be refused</b> score at or above it and would reach the model: {highRefuse.map((item) => item.id).join(", ") || "none"}.
          </li>
        </ul>
      </Section>

      <Section title="Access control" hint="Chunks above the role's access level, and documents that were explicitly blocked for the role, that were retrieved anyway. Both must be zero.">
        <table className="ranktable">
          <thead>
            <tr>
              <th>Pipeline</th>
              <th>Above the role's level</th>
              <th>Blocked documents retrieved</th>
            </tr>
          </thead>
          <tbody>
            {summary.pipelines.map((pipeline) => (
              <tr key={pipeline}>
                <td>{PIPELINE_LABEL[pipeline]}</td>
                <td className={summary.acl[pipeline].above_role === 0 ? "best" : "bad"}>{summary.acl[pipeline].above_role}</td>
                <td className={summary.acl[pipeline].blocked_retrieved === 0 ? "best" : "bad"}>{summary.acl[pipeline].blocked_retrieved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="What the test questions look like" hint="The golden set. No human has reviewed it yet, so treat small differences between pipelines as noise.">
        <div className="barsgrid">
          <Bars data={summary.golden.category} label="Question category" />
          <Bars data={summary.golden.expected_behavior} label="Expected behaviour" />
          <Bars data={summary.golden.role} label="Role" />
          <Bars data={summary.golden.origin} label="Written by" />
        </div>
      </Section>
    </div>
  );
}
