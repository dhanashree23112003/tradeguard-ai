import { useState, useEffect } from "react";
import { getCases, getCase, reviewCase } from "../api";
import { statusBadgeClass, severityBadgeClass, riskColor } from "../components/RiskBadge";
import { renderReport } from "../components/AgentStep";

function fmtTime(ts) {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function safeParse(val) {
  if (!val) return null;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch (e) { return null; }
}

function NotAvailable() {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", padding: "10px 16px" }}>
      — not available —
    </div>
  );
}

/* ── Case detail modal ──────────────────────────────────────────────────── */
function CaseModal({ caseId, onClose, onDone }) {
  const [data, setData]   = useState(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy]   = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => { getCase(caseId).then(setData); }, [caseId]);

  async function submit(action) {
    setBusy(true);
    if (action === "approve") { setFlash(true); setTimeout(() => setFlash(false), 600); }
    await reviewCase(caseId, action, notes);
    setBusy(false);
    onDone();
  }

  if (!data) return (
    <div className="overlay" onClick={onClose}>
      <div style={{
        background: "var(--surface)", border: "3px solid var(--border)",
        boxShadow: "8px 8px 0 var(--border)", padding: 40,
        display: "flex", alignItems: "center", gap: 12,
        fontFamily: "var(--font-mono)", fontSize: 13,
      }}>
        <span className="spinner" /> LOADING CASE…
      </div>
    </div>
  );

  const a1 = safeParse(data.agent1_output);
  const a2 = safeParse(data.agent2_output);
  const tx = data.transaction;
  const score = data.overall_risk_score;

  return (
    <div
      className="overlay"
      style={{ background: "rgba(10,10,10,0.85)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: flash ? "#f0fff4" : "var(--surface)",
          border: "3px solid var(--border)",
          boxShadow: "8px 8px 0 var(--border)",
          maxWidth: 700, width: "95vw",
          maxHeight: "90vh", overflowY: "auto",
          transition: "background 0.3s",
        }}
      >
        {/* Modal header */}
        <div style={{
          background: "var(--ink)", color: "#fff",
          padding: "16px 20px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: "0.06em" }}>
              CASE #{data.id}
            </span>
            {data.severity && (
              <span className={`badge ${severityBadgeClass(data.severity)}`} style={{ marginLeft: 12 }}>
                {data.severity.toUpperCase()}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "2px solid rgba(255,255,255,0.3)",
              color: "#fff", cursor: "pointer", padding: "4px 10px",
              fontFamily: "var(--font-mono)", fontSize: 13,
            }}
          >✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Transaction row */}
          {tx && (
            <div style={{
              border: "2px solid var(--border-thin)", padding: "12px 16px", marginBottom: 16,
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px",
            }}>
              {[
                ["USER",    tx.user_id],
                ["ASSET",   `${tx.asset} · ${tx.trade_type.toUpperCase()}`],
                ["AMOUNT",  `${tx.currency} ${Number(tx.amount).toLocaleString()}`],
                ["COUNTRY", tx.country],
                ["IP",      tx.ip_address],
                ["TIME",    fmtTime(tx.timestamp)],
              ].map(([k, v]) => (
                <div key={k}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", letterSpacing: "0.1em" }}>{k}: </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Agent 1 compact */}
          <div style={{ border: "2px solid var(--border)", marginBottom: 12 }}>
            <div className="agent-header">
              <span>01 — TRANSACTION ANALYST</span>
              {a1 && (
                <span style={{ fontFamily: "var(--font-display)", fontSize: 32, color: riskColor(a1.risk_score) }}>
                  {a1.risk_score}
                </span>
              )}
            </div>
            {a1 ? (
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: a1.reasoning ? 10 : 0 }}>
                  {(a1.flags || []).map((f, i) => <span key={i} className="flag-pill">{f}</span>)}
                </div>
                {a1.reasoning && (
                  <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.6 }}>
                    {a1.reasoning}
                  </p>
                )}
              </div>
            ) : <NotAvailable />}
          </div>

          {/* Agent 2 compact */}
          <div style={{ border: "2px solid var(--border)", marginBottom: 12 }}>
            <div className="agent-header">
              <span>02 — COMPLIANCE MAPPER</span>
              {a2 && <span className={`badge ${severityBadgeClass(a2.severity)}`}>{(a2.severity || "").toUpperCase()}</span>}
            </div>
            {a2 ? (
              <div style={{ padding: "12px 16px" }}>
                {(a2.applicable_rules || []).map((r, i) => (
                  <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 12, display: "flex", gap: 8, marginBottom: 4 }}>
                    <span style={{ color: "var(--coral)" }}>→</span>{r}
                  </div>
                ))}
                {a2.recommended_action && (
                  <div className="action-box" style={{ marginTop: 10, fontSize: 13 }}>{a2.recommended_action}</div>
                )}
              </div>
            ) : <NotAvailable />}
          </div>

          {/* Agent 3 report */}
          <div style={{ border: "2px solid var(--border)", marginBottom: 16 }}>
            <div className="agent-header"><span>03 — COMPLIANCE REPORT</span></div>
            {data.agent3_report ? (
              <div style={{ padding: "16px 20px", maxHeight: 300, overflowY: "auto" }}>
                {renderReport(data.agent3_report, localStorage.getItem("tg_reviewer_name") || "")}
              </div>
            ) : <NotAvailable />}
          </div>

          {/* Review controls */}
          {data.status === "pending_review" ? (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reviewer notes (optional)…"
                style={{
                  width: "100%", minHeight: 60,
                  background: "var(--bg)", border: "2px solid var(--border)",
                  borderRadius: 0, color: "var(--ink)",
                  fontFamily: "var(--font-mono)", fontSize: 12,
                  padding: "8px 12px", resize: "vertical", marginBottom: 12,
                }}
              />
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-approve" disabled={busy} onClick={() => submit("approve")} style={{ flex: 1 }}>
                  APPROVE CASE
                </button>
                <button className="btn btn-reject" disabled={busy} onClick={() => submit("reject")} style={{ flex: 1 }}>
                  REJECT CASE
                </button>
              </div>
            </>
          ) : (
            <div style={{
              padding: "12px 16px", border: `2px solid ${data.status === "approved" ? "var(--green)" : "var(--coral)"}`,
              background: data.status === "approved" ? "#f0fff4" : "#fff5f5",
              fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: "0.06em",
              color: data.status === "approved" ? "var(--green)" : "var(--coral)",
            }}>
              {data.status.toUpperCase()}
              {data.reviewer_notes && (
                <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 14, color: "var(--ink-muted)", marginTop: 6 }}>
                  {data.reviewer_notes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Case grid card ─────────────────────────────────────────────────────── */
function CaseCard({ c, idx, onClick }) {
  const score = c.overall_risk_score;

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: "pointer",
        animation: `slideUp 0.3s ease ${idx * 0.05}s both`,
        transition: "box-shadow 0.1s, transform 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "6px 6px 0 var(--border)";
        e.currentTarget.style.transform = "translate(-1px,-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "4px 4px 0 var(--border)";
        e.currentTarget.style.transform = "none";
      }}
    >
      {/* Top: ID + severity */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 14px", borderBottom: "2px solid var(--border-thin)",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 12 }}>CASE #{c.id} · TX-{c.transaction_id}</span>
        {c.severity && (
          <span className={`badge ${severityBadgeClass(c.severity)}`}>{c.severity.toUpperCase()}</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "16px 14px" }}>
        {/* Risk score */}
        <div style={{ fontFamily: "var(--font-display)", fontSize: 64, lineHeight: 1, color: riskColor(score), marginBottom: 8 }}>
          {score !== null && score !== undefined ? Math.round(score) : "—"}
        </div>

        {/* Amount + asset */}
        {c.agent1_output && (
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)", marginBottom: 4 }}>
            {c.agent1_output.flags?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {c.agent1_output.flags.slice(0, 2).map((f, i) => (
                  <span key={i} className="flag-pill" style={{ fontSize: 10 }}>{f}</span>
                ))}
                {c.agent1_output.flags.length > 2 && (
                  <span className="flag-pill" style={{ fontSize: 10 }}>+{c.agent1_output.flags.length - 2}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Status in serif italic */}
        <div style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 14,
          color: "var(--ink-muted)", marginBottom: 12,
        }}>
          {c.status.replace("_", " ")}
        </div>

        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", marginBottom: 14 }}>
          {fmtTime(c.created_at)}
        </div>
      </div>

      {/* Open button */}
      <button
        className="btn btn-black"
        style={{ width: "100%", margin: 0, boxShadow: "none", borderTop: "2px solid var(--border)", borderLeft: "none", borderRight: "none", borderBottom: "none" }}
        onClick={onClick}
      >
        OPEN CASE →
      </button>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function CaseManagement() {
  const [cases, setCases]           = useState([]);
  const [filterStatus, setFilterStatus]     = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [selectedCase, setSelectedCase]     = useState(null);

  function load() {
    const params = {};
    if (filterStatus)   params.status   = filterStatus;
    if (filterSeverity) params.severity = filterSeverity;
    getCases(params).then(setCases);
  }

  useEffect(() => { load(); }, [filterStatus, filterSeverity]);

  const selectStyle = {
    background: "var(--surface)",
    border: "2px solid var(--border)",
    borderRadius: 0,
    color: "var(--ink)",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    padding: "7px 12px",
    cursor: "pointer",
    boxShadow: "3px 3px 0 var(--border)",
  };

  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 42, letterSpacing: "0.06em", lineHeight: 1 }}>
          CASE MANAGEMENT
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="">ALL STATUSES</option>
            <option value="pending_review">PENDING REVIEW</option>
            <option value="cleared">CLEARED</option>
            <option value="approved">APPROVED</option>
            <option value="rejected">REJECTED</option>
          </select>
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} style={selectStyle}>
            <option value="">ALL SEVERITIES</option>
            <option value="critical">CRITICAL</option>
            <option value="high">HIGH</option>
            <option value="medium">MEDIUM</option>
            <option value="low">LOW</option>
          </select>
          <button className="btn btn-black" onClick={load} style={{ padding: "7px 14px", fontSize: 13 }}>
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Grid */}
      {cases.length === 0 ? (
        <div style={{
          border: "2px dashed var(--border-thin)", padding: 60,
          textAlign: "center", fontFamily: "var(--font-mono)",
          color: "var(--ink-muted)", fontSize: 13,
        }}>
          No cases found — run analysis on transactions first.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }} className="stagger">
          {cases.map((c, idx) => (
            <CaseCard key={c.id} c={c} idx={idx} onClick={() => setSelectedCase(c.id)} />
          ))}
        </div>
      )}

      {/* Overlay */}
      {selectedCase && (
        <CaseModal
          caseId={selectedCase}
          onClose={() => setSelectedCase(null)}
          onDone={() => { setSelectedCase(null); load(); }}
        />
      )}
    </div>
  );
}
