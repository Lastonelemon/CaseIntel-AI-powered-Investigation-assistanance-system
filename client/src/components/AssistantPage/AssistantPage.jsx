import * as Shared from "../shared.js";
import PageHead from "../PageHead/PageHead.jsx";
const {
  useEffect,
  useRef,
  useState,
  AlertCircle,
  ArrowUpRight,
  BrainCircuit,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  asJSON,
  api,
} = Shared;

function AssistantPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);
  async function send(text = question) {
    if (!text.trim() || busy) return;
    setMessages((current) => [...current, { role: "user", text }]);
    setQuestion("");
    setBusy(true);
    try {
      const result = await api("/chat", {
        method: "POST",
        body: asJSON({ question: text }),
      });
      setMessages((current) => [...current, { role: "assistant", ...result }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: "assistant", error: error.message },
      ]);
    } finally {
      setBusy(false);
    }
  }
  const prompts = [
    "Show me all high urgency phishing cases.",
    "Which inspector has the highest workload?",
    "Summarize the most common reported categories.",
    "Which cases need immediate attention?",
  ];
  return (
    <>
      <PageHead
        kicker="INVESTIGATION COPILOT"
        title="AI Assistant"
        subtitle="Ask questions across your case database. Answers include traceable source case IDs."
        action={
          <span className="ai-mode-badge">
            <Sparkles size={14} /> DATABASE GROUNDED
          </span>
        }
      />
      <div className="assistant-layout">
        <section className="panel assistant-chat">
          <div className="assistant-chat-head">
            <div className="assistant-chat-icon">
              <BrainCircuit size={18} />
            </div>
            <div>
              <b>CaseIntel Assistant</b>
              <small>
                <span className="pulse-dot" /> Case context retrieval active
              </small>
            </div>
            <span className="ai-disclaimer-mini">
              <ShieldCheck size={13} /> Human verification required
            </span>
          </div>
          <div className="assistant-messages">
            {!messages.length && (
              <div className="assistant-welcome">
                <div className="assistant-welcome-icon">
                  <Sparkles size={20} />
                </div>
                <h3>What would you like to investigate?</h3>
                <p>
                  Responses are grounded in relevant records retrieved from your
                  database.
                </p>
                <div className="prompt-grid">
                  {prompts.map((prompt) => (
                    <button key={prompt} onClick={() => send(prompt)}>
                      <span>{prompt}</span>
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, i) => (
              <div key={i} className={`message-row message-${message.role}`}>
                <div className="message-avatar">
                  {message.role === "assistant" ? (
                    <Sparkles size={14} />
                  ) : (
                    <UserRound size={14} />
                  )}
                </div>
                <div
                  className={`message-bubble ${message.error ? "message-error" : ""}`}
                >
                  {message.text || message.answer || message.error}
                  {message.source_case_ids?.length > 0 && (
                    <div className="message-sources">
                      <span>SOURCES</span>
                      {message.source_case_ids.map((id) => (
                        <span className="source-chip" key={id}>
                          {id}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="message-row message-assistant">
                <div className="message-avatar">
                  <Sparkles size={14} />
                </div>
                <div className="message-bubble typing-bubble">
                  <i />
                  <i />
                  <i />
                  <span>Checking relevant case records…</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            className="assistant-input"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask a question about the case database…"
              rows={2}
            />
            <div>
              <span>
                Answers use a limited set of relevant records <span>·</span>{" "}
                Enter to send
              </span>
              <button
                className="button button-primary button-sm"
                disabled={busy || !question.trim()}
              >
                <Send size={14} /> Send
              </button>
            </div>
          </form>
        </section>
        <aside className="assistant-context">
          <div className="panel context-panel">
            <div className="panel-heading">
              <div>
                <h3>
                  <Radio size={15} /> Retrieval controls
                </h3>
                <p>How your question is handled</p>
              </div>
            </div>
            <div className="context-steps">
              {[
                [
                  "01",
                  "Relevant case search",
                  "Matches query terms against case fields and records.",
                ],
                [
                  "02",
                  "Bounded context",
                  "A maximum of 12 relevant cases are shared with Gemini.",
                ],
                [
                  "03",
                  "Traceable answer",
                  "The assistant returns source IDs for investigator review.",
                ],
              ].map(([n, title, detail]) => (
                <div key={n}>
                  <span>{n}</span>
                  <div>
                    <b>{title}</b>
                    <p>{detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="context-note">
              <ShieldCheck size={15} /> Gemini does not execute SQL or receive
              the full database.
            </div>
          </div>
          <div className="assistant-caution">
            <AlertCircle size={15} />
            <p>
              AI responses may be incomplete. Verify important findings against
              the original case record.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

export default AssistantPage;
