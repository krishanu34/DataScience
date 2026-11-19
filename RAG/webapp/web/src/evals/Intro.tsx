import { METRIC_GROUPS } from "../data/content";
import { CHECKS_TEXT, PLAIN_METRICS } from "../data/evalcopy";
import { Pill, Section } from "../components/ui";

const STEPS = [
  { n: 1, title: "A test question", text: "Written in advance, with the documents that really answer it marked as right. 83 of these form the golden set." },
  { n: 2, title: "Run the system", text: "The same question goes through each retrieval pipeline: BM25, vector, both merged, and merged plus Gemini reranking." },
  { n: 3, title: "Compare", text: "Look at which documents came back, and in what order, next to the documents marked as right." },
  { n: 4, title: "Score", text: "Turn the comparison into numbers from 0 to 1. Do this for every question and average, to compare pipelines fairly." },
];

export function Intro({ go }: { go: (view: string) => void }) {
  return (
    <div className="intro">
      <Section title="What is an evaluation?" hint="You change a chunk size, a prompt or a model, and the answers look different. Is that better? An evaluation replaces opinion with numbers.">
        <ol className="four">
          {STEPS.map((step) => (
            <li key={step.n} className="rise">
              <span className="step-no">{step.n}</span>
              <b>{step.title}</b>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="hero-actions">
          <button className="btn" onClick={() => go("one")}>
            Score one question yourself
          </button>
          <button className="btn btn-ghost" onClick={() => go("results")}>
            See the results for all questions
          </button>
        </div>
      </Section>

      <Section title="The four scores you will see" hint="Each one answers a different question about a ranked list of results. All run from 0 (bad) to 1 (perfect).">
        <div className="metriccards">
          {PLAIN_METRICS.map((metric) => (
            <article key={metric.key} className="metriccard">
              <Pill tone="vector">{metric.name}</Pill>
              <h4>{metric.asks}</h4>
              <p>{metric.how}</p>
              <p className="hint">Example: {metric.example}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Two checks that are not about ranking" hint="Some questions have no right document: they should be refused. These checks cover them.">
        <div className="metriccards">
          {CHECKS_TEXT.map((check) => (
            <article key={check.name} className="metriccard">
              <Pill tone="warn">{check.name}</Pill>
              <p>{check.text}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Why four pipelines?" hint="Comparing them shows what each added.">
        <ul className="explain">
          <li>
            <b>BM25</b> is fast and finds exact words, but misses rephrased questions.
          </li>
          <li>
            <b>Vector</b> finds meaning, but can blur exact identifiers.
          </li>
          <li>
            <b>Ensemble</b> merges both rankings. It should help when each one alone fails sometimes.
          </li>
          <li>
            <b>Ensemble + rerank</b> lets Gemini re-read the top 30 candidates. It usually improves the order, at the cost of seconds of latency.
          </li>
        </ul>
      </Section>

      <Section title="Everything we plan to measure" hint="Only group A is measured today. The rest is the roadmap.">
        <div className="catalog">
          {METRIC_GROUPS.map((group) => (
            <details key={group.id} className="card">
              <summary>
                <b>
                  {group.id}. {group.title}
                </b>{" "}
                <Pill tone={group.status === "built" ? "up" : "warn"}>{group.status === "built" ? "measured" : "planned"}</Pill>
              </summary>
              <p className="hint">{group.blurb}</p>
              <dl>
                {group.metrics.map((metric) => (
                  <div key={metric.name}>
                    <dt>{metric.name}</dt>
                    <dd>{metric.meaning}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
      </Section>
    </div>
  );
}
