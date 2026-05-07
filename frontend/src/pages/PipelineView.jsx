import { useState, useEffect, useRef } from "react";
import { getTransactions, analyzeTransaction, getPipelineStatus, getCases, getCase } from "../api";
import { statusBadgeClass } from "../components/RiskBadge";
import { Agent1Card, Agent2Card, Agent3Card } from "../components/AgentStep";

/* ── New keyframes injected once (can't touch globals.css) ──────────────── */
const INJECTED_STYLES = `
  @keyframes scan-dot {
    0%, 20% { opacity: 0; }
    50%      { opacity: 1; }
    80%,100% { opacity: 0; }
  }
  @keyframes pulse-node {
    from { box-shadow: 4px 4px 0 #0A0A0A; }
    to   { box-shadow: 6px 6px 0 #0A0A0A; }
  }
  @keyframes dash-flow {
    from { background-position: 0 0; }
    to   { background-position: 20px 0; }
  }
  .run-btn-wrap:hover .run-arrow { transform: translateX(4px) !important; }
`;

/* ── Constants ──────────────────────────────────────────────────────────── */
const HIGH_RISK_COUNTRIES = ["RU", "IR", "KP", "SY", "BY"];
const DIAG_BG = "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 5px)";

const COUNTRY_FLAGS = {
  US:"🇺🇸", GB:"🇬🇧", DE:"🇩🇪", FR:"🇫🇷", CN:"🇨🇳", RU:"🇷🇺",
  JP:"🇯🇵", AU:"🇦🇺", CA:"🇨🇦", SG:"🇸🇬", NL:"🇳🇱", NG:"🇳🇬",
  IR:"🇮🇷", KP:"🇰🇵", KR:"🇰🇷", BY:"🇧🇾", SY:"🇸🇾",
};

/* ── Helpers ────────────────────────────────────────────────────────────── */
function fmtAmount(amount, currency) {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}
function fmtTime(ts) {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function amountColor(amount) {
  if (amount > 20000) return "var(--coral)";
  if (amount >= 10000) return "var(--yellow)";
  return "var(--ink)";
}
function leftBorderStyle(tx) {
  if (tx.status === "cleared") return { borderLeft: "4px solid var(--green)" };
  if (tx.amount > 20000)       return { borderLeft: "4px solid var(--coral)" };
  if (tx.amount >= 10000)      return { borderLeft: "4px solid var(--yellow)" };
  return {};
}

/* ── Safe JSON parser — handles already-parsed objects and raw strings ───── */
function safeParse(val) {
  if (!val) return null;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch (e) { return null; }
}

/* ── Derive per-agent status from polled pipeline state ─────────────────── */
function inferStatus(pipeline, key) {
  if (!pipeline || pipeline.pipeline_status === "not_started") return "idle";
  const isRunning = pipeline.pipeline_status === "running";
  const agent = pipeline[key];
  if (!agent) {
    if (!isRunning) return "idle";
    if (key === "agent1") return "running";
    if (key === "agent2" && pipeline.agent1?.status === "completed") return "running";
    if (key === "agent3" && pipeline.agent2?.status === "completed") return "running";
    return "idle";
  }
  if (agent.status === "skipped") return "idle";
  return agent.status; // completed | failed
}

/* ── Pipeline node — 4 distinct visual states ───────────────────────────── */
function PipeNode({ number, label, status }) {
  const num = String(number).padStart(2, "0");
  const base = {
    width: 120, minHeight: 84, flexShrink: 0,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "10px 8px", position: "relative",
  };

  if (status === "idle") return (
    <div style={{ ...base, background: DIAG_BG, border: "2px dashed var(--border)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", marginBottom: 3 }}>{num}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--ink-muted)", letterSpacing: "0.04em", lineHeight: 1, textAlign: "center" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-muted)", marginTop: 5, letterSpacing: "0.08em" }}>WAITING</div>
    </div>
  );

  if (status === "running") return (
    <div style={{ ...base, background: "var(--yellow)", border: "2px solid var(--border)", animation: "pulse-node 0.8s ease-in-out infinite alternate" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink)", marginBottom: 3, opacity: 0.6 }}>{num}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--ink)", letterSpacing: "0.04em", lineHeight: 1, textAlign: "center" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink)", marginTop: 5, letterSpacing: "0.06em" }}>
        SCANNING
        <span style={{ animation: "scan-dot 1.2s infinite", display: "inline-block" }}>.</span>
        <span style={{ animation: "scan-dot 1.2s 0.3s infinite", display: "inline-block" }}>.</span>
        <span style={{ animation: "scan-dot 1.2s 0.6s infinite", display: "inline-block" }}>.</span>
      </div>
    </div>
  );

  if (status === "completed") return (
    <div style={{ ...base, background: "var(--ink)", border: "2px solid var(--border)", boxShadow: "4px 4px 0 var(--border)" }}>
      <span style={{ position: "absolute", top: 5, right: 7, fontFamily: "var(--font-display)", fontSize: 20, color: "var(--green)", lineHeight: 1 }}>✓</span>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>{num}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "#fff", letterSpacing: "0.04em", lineHeight: 1, textAlign: "center" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--green)", marginTop: 5, letterSpacing: "0.08em" }}>DONE</div>
    </div>
  );

  // failed
  return (
    <div style={{ ...base, background: "var(--coral)", border: "2px solid var(--border)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 3 }}>{num}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "#fff", letterSpacing: "0.04em", lineHeight: 1, textAlign: "center" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#fff", marginTop: 5, letterSpacing: "0.08em" }}>✗ FAILED</div>
    </div>
  );
}

/* ── Connector — 3 states ───────────────────────────────────────────────── */
function Connector({ prevStatus, nextStatus }) {
  // Incoming line to running node → animated yellow dashes flowing right
  if (nextStatus === "running") return (
    <div style={{
      flex: 1, height: 3, alignSelf: "center", minWidth: 20,
      background: "repeating-linear-gradient(90deg, var(--yellow) 0, var(--yellow) 8px, transparent 8px, transparent 14px)",
      backgroundSize: "20px 100%",
      animation: "dash-flow 0.4s linear infinite",
    }} />
  );

  // After a completed step → thick 3px solid black + arrow
  if (prevStatus === "completed") return (
    <div style={{
      flex: 1, height: 3, background: "var(--ink)", alignSelf: "center", minWidth: 20,
      display: "flex", alignItems: "center", justifyContent: "flex-end",
    }}>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink)", lineHeight: 1, marginRight: -3 }}>›</span>
    </div>
  );

  // Idle → thin 1px dashed
  return (
    <div style={{
      flex: 1, height: 0, alignSelf: "center", minWidth: 20,
      borderTop: "1px dashed rgba(10,10,10,0.18)",
    }} />
  );
}

/* ── Transaction list card ──────────────────────────────────────────────── */
function TxCard({ tx, selected, onClick, idx }) {
  const flag = COUNTRY_FLAGS[tx.country] ?? "";
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "var(--yellow)" : "var(--surface)",
        border: "2px solid var(--border)",
        ...leftBorderStyle(tx),
        borderRadius: 0,
        boxShadow: selected ? "6px 6px 0 var(--border)" : "4px 4px 0 var(--border)",
        padding: "12px 14px",
        cursor: "pointer",
        marginBottom: 10,
        animation: `slideInLeft 0.3s ease ${idx * 0.04}s both`,
      }}
    >
      {/* Row 1 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 11, color: "var(--ink)" }}>TX-{tx.id}</span>
        <span className={`badge ${statusBadgeClass(tx.status)}`}>{tx.status.toUpperCase()}</span>
      </div>
      {/* Row 2 */}
      <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink)", lineHeight: 1 }}>
        {tx.asset} · {tx.trade_type.toUpperCase()}
      </div>
      {/* Row 3 */}
      <div style={{ fontFamily: "var(--font-display)", fontSize: 28, color: amountColor(tx.amount), lineHeight: 1.1 }}>
        {tx.currency} {Number(tx.amount).toLocaleString()}
      </div>
      {/* Row 4: flag + timestamp */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", marginTop: 4 }}>
        {flag && <span style={{ marginRight: 4 }}>{flag}</span>}{fmtTime(tx.timestamp)}
      </div>
    </div>
  );
}

/* ── Pre-analysis card ──────────────────────────────────────────────────── */
function PreAnalysisCard({ tx, onRun, running }) {
  const isFirstTime = tx.status === "pending";
  const chips = [
    { label: "AMOUNT",     value: `${tx.currency} ${Number(tx.amount).toLocaleString()}`, danger: tx.amount > 20000 },
    { label: "ASSET",      value: tx.asset },
    { label: "TYPE",       value: tx.trade_type.toUpperCase() },
    { label: "COUNTRY",    value: `${COUNTRY_FLAGS[tx.country] ?? ""} ${tx.country}`, danger: HIGH_RISK_COUNTRIES.includes(tx.country) },
    { label: "IP ADDRESS", value: tx.ip_address },
    { label: "TIME",       value: fmtTime(tx.timestamp) },
  ];

  return (
    <div style={{
      background: "var(--surface)",
      border: "3px solid var(--border)",
      boxShadow: "6px 6px 0 var(--border)",
      marginBottom: 16,
    }}>
      {/* coral warning stripe */}
      <div style={{ height: 8, background: "var(--coral)" }} />

      {/* header */}
      <div style={{ padding: "20px 24px 16px", display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 72, color: "var(--coral)", lineHeight: 1, flexShrink: 0 }}>
          ⚠
        </div>
        <div style={{ paddingTop: 8 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "0.04em", color: "var(--ink)" }}>
            {isFirstTime ? "UNANALYZED TRANSACTION" : "RE-RUN COMPLIANCE ANALYSIS"}
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 14, color: "var(--ink-muted)", marginTop: 4, lineHeight: 1.5 }}>
            {isFirstTime
              ? "This transaction has not been screened for compliance violations."
              : "Re-run the 3-agent pipeline to generate a fresh compliance report."}
          </div>
        </div>
      </div>

      {/* detail chips */}
      <div style={{ padding: "0 24px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {chips.map(({ label, value, danger }) => (
          <div key={label} style={{
            background: "var(--surface)",
            border: "2px solid var(--border)",
            boxShadow: "2px 2px 0 var(--border)",
            padding: "8px 12px",
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-muted)", letterSpacing: "0.1em", marginBottom: 3 }}>
              {label}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: danger ? "var(--coral)" : "var(--ink)", fontWeight: 500 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* hint + run button */}
      <div style={{ padding: "0 24px 24px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", marginBottom: 8 }}>
          Initiates 3-agent AI pipeline • Takes ~15 seconds
        </div>
        <button
          className="btn btn-black run-btn-wrap"
          onClick={onRun}
          disabled={running}
          style={{ width: "100%", fontSize: 20, padding: "16px", gap: 10 }}
        >
          <span className="run-arrow" style={{ display: "inline-block", transition: "transform 0.15s ease" }}>→</span>
          RUN COMPLIANCE ANALYSIS
        </button>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function PipelineView() {
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected]         = useState(null);
  const [pipeline, setPipeline]         = useState(null);
  const [existingCase, setExistingCase] = useState(null); // case already in DB on select
  const [running, setRunning]           = useState(false);
  const [caseId, setCaseId]             = useState(null);
  const pollRef    = useRef(null);
  const pipelineRef = useRef(null); // mirror of pipeline state for closure access

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Update both React state and the ref so async callbacks see current value
  function syncPipeline(state) {
    pipelineRef.current = state;
    setPipeline(state);
  }

  useEffect(() => { getTransactions().then(setTransactions); }, []);
  useEffect(() => () => clearInterval(pollRef.current), []);

  // On select: reset live state then fetch any existing compliance case from DB
  async function selectTx(tx) {
    clearInterval(pollRef.current);
    setSelected(tx);
    syncPipeline(null);
    setRunning(false);
    setExistingCase(null);
    setCaseId(null);

    try {
      const allCases = await getCases();
      const found = allCases.find((c) => c.transaction_id === tx.id);
      if (found) {
        const full = await getCase(found.id);
        setExistingCase(full);
        setCaseId(full.id);
      }
    } catch (e) {
      // fail silently — user can still run analysis
    }
  }

  async function runAnalysis() {
    if (!selected || running) return;
    setRunning(true);
    setCaseId(null);
    setExistingCase(null);
    syncPipeline({ pipeline_status: "running" });
    await analyzeTransaction(selected.id);

    pollRef.current = setInterval(async () => {
      const status = await getPipelineStatus(selected.id);

      if (status.pipeline_status !== "running") {
        // Pipeline finished — stop polling and animate any skipped stages
        clearInterval(pollRef.current);

        const prev = pipelineRef.current || {};
        const prevA2Done = prev.agent2?.status === "completed";
        const prevA3Done = prev.agent3?.status === "completed";
        const newA2Done  = status.agent2?.status === "completed";
        const newA3Done  = status.agent3?.status === "completed";

        // If we jumped over agent2 running stage, show it briefly
        if (!prevA2Done && newA2Done) {
          syncPipeline({ pipeline_status: "running", agent1: status.agent1 });
          await sleep(700);
        }
        // If we jumped over agent3 running stage, show it briefly
        if (!prevA3Done && newA3Done) {
          syncPipeline({ pipeline_status: "running", agent1: status.agent1, agent2: status.agent2 });
          await sleep(700);
        }

        if (status.case_id) setCaseId(status.case_id);
        syncPipeline(status);
        setRunning(false);
        const updated = await getTransactions();
        setTransactions(updated);
        const fresh = updated.find((t) => t.id === selected.id);
        if (fresh) setSelected(fresh);
      } else {
        if (status.case_id) setCaseId(status.case_id);
        syncPipeline(status);
      }
    }, 500);
  }

  // ── Parsed outputs from existing DB case (null if none) ─────────────────
  // Discard outputs that are error objects (failed pipeline runs)
  const _rawA1 = safeParse(existingCase?.agent1_output);
  const caseA1 = _rawA1 && !_rawA1.error && _rawA1.risk_score !== undefined ? _rawA1 : null;
  const _rawA2 = safeParse(existingCase?.agent2_output);
  const caseA2 = _rawA2 && !_rawA2.error ? _rawA2 : null;
  const caseA3 = existingCase?.agent3_report ?? null;

  // ── Agent states: live pipeline takes priority, fall back to existing case
  const liveS1 = inferStatus(pipeline, "agent1");
  const liveS2 = inferStatus(pipeline, "agent2");
  const liveS3 = inferStatus(pipeline, "agent3");
  const s1 = pipeline ? liveS1 : (caseA1 ? "completed" : "idle");
  const s2 = pipeline ? liveS2 : (caseA2 ? "completed" : "idle");
  const s3 = pipeline ? liveS3 : (caseA3 ? "completed" : "idle");

  // ── Effective outputs ────────────────────────────────────────────────────
  const a1Out = pipeline?.agent1?.output ?? caseA1;
  const a2Out = pipeline?.agent2?.output ?? caseA2;
  const a3Out = pipeline?.agent3?.output ?? caseA3;

  // ── Display flags ────────────────────────────────────────────────────────
  const hasExistingCase = !!existingCase;
  const liveRunning     = !!pipeline && pipeline.pipeline_status !== "not_started";
  const hasPipeline     = liveRunning || hasExistingCase;

  // Only show CLEARED when Agent 1 explicitly said is_suspicious: false
  const isCleared =
    pipeline?.final_status === "cleared" ||
    (hasExistingCase && caseA1 && caseA1.is_suspicious === false);

  // Only show pre-analysis card when there is genuinely no case yet
  const notYetRun = !hasExistingCase && !pipeline && !running;

  return (
    <>
      <style>{INJECTED_STYLES}</style>
      <div style={{ display: "flex", gap: 20, height: "calc(100vh - 100px)" }}>

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div style={{ width: 280, flexShrink: 0, overflowY: "auto", paddingRight: 2 }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 11, color: "var(--ink-muted)",
            letterSpacing: "0.18em", marginBottom: 12,
          }}>
            TRANSACTIONS
          </div>
          {transactions.map((tx, idx) => (
            <TxCard
              key={tx.id} tx={tx} idx={idx}
              selected={selected?.id === tx.id}
              onClick={() => selectTx(tx)}
            />
          ))}
        </div>

        {/* ── Right panel ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {!selected ? (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "var(--border-thin)" }}>SELECT A TRANSACTION</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)" }}>choose from the list to run compliance analysis</div>
            </div>
          ) : (
            <>
              {/* Transaction header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 48, lineHeight: 1, color: "var(--ink)" }}>{selected.user_id}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--ink-muted)" }}>{selected.asset}</span>
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: amountColor(selected.amount), marginTop: 2 }}>
                  {fmtAmount(selected.amount, selected.currency)}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", marginTop: 4 }}>
                  {selected.trade_type.toUpperCase()} · {selected.country} · {selected.ip_address} · {fmtTime(selected.timestamp)}
                </div>
              </div>

              {/* ── Pre-analysis card (before any run) ────────────────────── */}
              {notYetRun && (
                <PreAnalysisCard tx={selected} onRun={runAnalysis} running={running} />
              )}

              {/* ── Pipeline tracker (during & after run) ─────────────────── */}
              {(hasPipeline || running) && (
                <>
                  <div className="card" style={{ padding: "20px", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: liveRunning ? 16 : 0 }}>
                      <PipeNode number={1} label="ANALYST" status={s1} />
                      <Connector prevStatus={s1} nextStatus={s2} />
                      <PipeNode number={2} label="MAPPER"  status={s2} />
                      <Connector prevStatus={s2} nextStatus={s3} />
                      <PipeNode number={3} label="REPORT"  status={s3} />
                    </div>
                    {liveRunning && pipeline && (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)" }}>
                        STATUS:{" "}
                        <span style={{
                          color: pipeline.pipeline_status === "completed" ? "var(--green)"
                               : pipeline.pipeline_status === "failed"    ? "var(--coral)"
                               : "var(--ink)",
                          fontWeight: 500,
                        }}>
                          {pipeline.pipeline_status.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-black run-btn-wrap"
                    onClick={runAnalysis}
                    disabled={running}
                    style={{ width: "100%", fontSize: 18, padding: "14px", marginBottom: 8, gap: 8 }}
                  >
                    {running ? (
                      <><span className="spinner" style={{ borderTopColor: "#fff" }} /> ANALYSING…</>
                    ) : (
                      <><span className="run-arrow" style={{ display: "inline-block", transition: "transform 0.15s ease" }}>→</span> RUN COMPLIANCE ANALYSIS</>
                    )}
                  </button>
                </>
              )}

              {/* Cleared notice */}
              {isCleared && (
                <div style={{
                  border: "2px solid var(--green)", background: "#f0fff4",
                  padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: 13,
                  color: "var(--green)", marginTop: 8, boxShadow: "4px 4px 0 var(--green)",
                }}>
                  ✓ TRANSACTION CLEARED — no suspicious patterns detected. Agents 2 & 3 skipped.
                </div>
              )}

              {/* Agent output cards — use merged outputs (live or from DB case) */}
              {s1 === "completed" && a1Out && (
                <Agent1Card
                  output={a1Out}
                  context={pipeline?.agent1_context ?? null}
                  targetTimestamp={selected?.timestamp}
                />
              )}
              {s2 === "completed" && a2Out && (
                <Agent2Card output={a2Out} />
              )}
              {s3 === "completed" && a3Out && (
                <Agent3Card
                  output={a3Out}
                  caseId={caseId}
                  onReviewed={async () => {
                    const updated = await getTransactions();
                    setTransactions(updated);
                    const fresh = updated.find((t) => t.id === selected.id);
                    if (fresh) setSelected(fresh);
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
