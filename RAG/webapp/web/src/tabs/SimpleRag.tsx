import { useState } from "react";
import { Answer } from "../components/Answer";
import { ChunkCard } from "../components/ChunkCard";
import { AskPanel } from "../components/AskPanel";
import { ErrorBox, Flow, Lesson, Section, Stat } from "../components/ui";
import { useRun } from "../hooks/useRun";
import { useApp } from "../lib/app";
import { flowStates, fmtMs, lastOf, stageOf, tokensOf } from "../lib/events";
import type { Chunk, Source } from "../types";

export function PromptView({ prompt }: { prompt: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="promptview">
      <div className="prompt-part">
        <div className="kicker">System message</div>
        <pre>{prompt.system}</pre>
      </div>
      <div className="prompt-part">
        <div className="kicker">User message with the numbered evidence ({prompt.evidence_count} chunks)</div>
        <pre className={open ? "" : "clamp"}>{prompt.human}</pre>
        <button className="link" onClick={() => setOpen(!open)}>
          {open ? "Collapse" : "Show everything"}
        </button>
      </div>
    </div>
  );
}

export function SimpleRag() {
  const { examples } = useApp();
  const { events, running, error, start, stop } = useRun("simple");
  const retrieve = stageOf(events, "retrieve");
  const prompt = stageOf(events, "prompt");
  const generate = stageOf(events, "generate");
  const final = lastOf(events, "final");
  const answer: string = final?.answer ?? tokensOf(events);
  const replay = lastOf(events, "start")?.replay;

  const done = new Set<string>();
  if (events.length) done.add("question");
  if (retrieve) done.add("retrieve");
  if (prompt) done.add("prompt");
  if (final) ["generate", "answer"].forEach((id) => done.add(id));
  const ids = ["question", "retrieve", "prompt", "generate", "answer"];
  const states = flowStates(ids, done, running);

  return (
    <div className="tab-grid">
      <aside>
        <AskPanel examples={examples.simple ?? []} running={running} onRun={start} onStop={stop} />
        <Lesson
          title="Simple RAG"
          summary="Retrieval-augmented generation gives a language model the right text before it answers. Instead of relying on memory, the model reads evidence you retrieved and cites it."
          points={[
            "Embed the question and find the 5 closest chunks by meaning (vector search).",
            "An access filter drops chunks the role may not read, before the model sees anything.",
            "The model must answer only from the numbered evidence and cite it as [1], [2].",
            "If the evidence does not answer the question, it must reply that it could not find it.",
          ]}
          tryThis={[
            "Ask the break-glass question as a guest, then as a security admin.",
            "Ask about parental leave: the answer should be a refusal, not an invention.",
            "Ask the policy version question and check which policy it cites. Compare with the Hybrid tab.",
          ]}
          calls={["step07_simple_rag.get_retriever(vectorstore, role)", "step07_simple_rag.format_evidence(docs)", "step07_simple_rag.PROMPT | llm | StrOutputParser()", "step07_simple_rag.cited_sources(answer, docs)"]}
        />
      </aside>

      <main>
        <ErrorBox message={error} />
        <Flow
          states={states}
          nodes={[
            { label: "Question" },
            { label: "Retrieve", sub: "vector + access filter", ms: retrieve?.ms },
            { label: "Prompt", sub: "numbered evidence" },
            { label: "Generate", sub: "Gemini", ms: final?.timings?.stages?.generate },
            { label: "Answer", sub: "with citations" },
          ]}
        />

        {final && (
          <div className="stats rise">
            <Stat label="Time to first token" value={fmtMs(final.timings.ttft_ms)} hint="From the start of the request until the first word of the answer appears." tone="accent" />
            <Stat label="Total" value={fmtMs(final.timings.total_ms)} />
            <Stat label="Citations" value={final.sources.length} />
            <Stat label="Source of data" value={replay ? "recorded run" : "live run"} />
          </div>
        )}

        {retrieve && (
          <Section
            title="1. Retrieved chunks"
            hint={`Only chunks with access level ${retrieve.allowed.join(" or ")} can appear. These five chunks are everything the model gets to see.`}
          >
            <div className="chunk-list">
              {(retrieve.chunks as Chunk[]).map((chunk) => (
                <ChunkCard key={chunk.chunk_id} chunk={chunk} badge={chunk.rank} />
              ))}
            </div>
          </Section>
        )}

        {prompt && (
          <Section title="2. The prompt" hint="The model receives these rules and this evidence. Everything it says should come from here.">
            <PromptView prompt={prompt} />
          </Section>
        )}

        {(generate || final) && (
          <Section
            title="3. The answer"
            hint={generate ? `The first token arrived after ${fmtMs(generate.ttft_ms)}.` : undefined}
          >
            <Answer text={answer} sources={(final?.sources ?? []) as Source[]} refused={final?.refused} streaming={running && !final} />
          </Section>
        )}

        {!events.length && <p className="empty">Pick an example or ask your own question to watch each stage run.</p>}
      </main>
    </div>
  );
}
