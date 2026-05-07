import { reviewCase, getCases } from "../api";
import { useState } from "react";
import { severityBadgeClass } from "./RiskBadge";

/* ── helpers ────────────────────────────────────────────────────────────── */
function timeDiffLabel(a, b) {
  const diffMs = Math.abs(new Date(a) - new Date(b));
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s apart`;
  return `${Math.round(diffSec / 60)}m apart`;
}

/* ── Context Window panel ───────────────────────────────────────────────── */
function ContextWindow({ context, targetTimestamp }) {
  const related = context?.related_transactions ?? [];

  return (
    <div style={{
      borderTop: "2px solid var(--border-thin)",
      marginTop: 20,
      paddingTop: 16,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", letterSpacing: "0.12em" }}>
          DETECTION CONTEXT WINDOW
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            background: "var(--bg)", border: "1px solid var(--border-thin)",
            padding: "2px 8px", color: "var(--ink-muted)",
          }}>
            reversal window: ±5 min
          </span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            background: "var(--bg)", border: "1px solid var(--border-thin)",
            padding: "2px 8px", color: "var(--ink-muted)",
          }}>
            same-IP window: ±60 sec
          </span>
        </div>
      </div>

      {related.length === 0 ? (
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 12,
          color: "var(--ink-muted)", padding: "10px 14px",
          background: "var(--bg)", border: "1px solid var(--border-thin)",
        }}>
          No related transactions found in detection window — analyzed in isolation.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {related.map((r) => {
            const diff = timeDiffLabel(r.timestamp, targetTimestamp);
            const isReversal = r.trade_type !== undefined;
            return (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 14px",
                background: "var(--bg)",
                borderLeft: "4px solid var(--coral)",
                border: "1px solid var(--border-thin)",
                borderLeftWidth: 4,
                borderLeftColor: "var(--coral)",
                gap: 12,
                flexWrap: "wrap",
              }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500 }}>
                    TX-{r.id}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-display)", fontSize: 14,
                    color: r.trade_type === "buy" ? "var(--green)" : "var(--coral)",
                  }}>
                    {r.trade_type?.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    {r.asset}
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>
                    {r.currency} {Number(r.amount).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 10,
                    color: "var(--ink-muted)",
                  }}>
                    {new Date(r.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 10,
                    background: "var(--yellow)", border: "1px solid var(--border)",
                    padding: "1px 7px", color: "var(--ink)", fontWeight: 500,
                  }}>
                    {diff}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)" }}>
                    {r.ip_address}
                  </span>
                </div>
              </div>
            );
          })}
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)",
            paddingTop: 4,
          }}>
            ↑ {related.length} related transaction{related.length > 1 ? "s" : ""} sent to AI alongside target
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Agent 1 output card ────────────────────────────────────────────────── */
function Agent1Card({ output, context, targetTimestamp }) {
  const score = output?.risk_score ?? null;
  const flags = output?.flags ?? [];
  const scoreColor =
    score >= 70 ? "var(--coral)" : score >= 40 ? "var(--yellow)" : "var(--green)";

  return (
    <div className="card" style={{ marginTop: 16, animation: "slideUp 0.3s ease both" }}>
      <div className="agent-header">
        <span>01 — TRANSACTION ANALYST</span>
        <span className="badge badge-cleared" style={{ fontSize: 11 }}>COMPLETED</span>
      </div>
      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", gap: 40, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Risk Score */}
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", marginBottom: 2, letterSpacing: "0.12em" }}>
              RISK SCORE
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 96, lineHeight: 1, color: scoreColor }}>
              {score ?? "—"}
            </div>
          </div>

          {/* Flags + Reasoning */}
          <div style={{ flex: 1, minWidth: 200 }}>
            {flags.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", marginBottom: 8, letterSpacing: "0.12em" }}>
                  FLAGS DETECTED
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {flags.map((f, i) => (
                    <span key={i} className="flag-pill">{f}</span>
                  ))}
                </div>
              </div>
            )}
            {output?.reasoning && (
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", marginBottom: 6, letterSpacing: "0.12em" }}>
                  ANALYSIS
                </div>
                <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.6 }}>
                  {output.reasoning}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Context Window */}
        <ContextWindow context={context} targetTimestamp={targetTimestamp} />
      </div>
    </div>
  );
}

/* ── Agent 2 output card ────────────────────────────────────────────────── */
function Agent2Card({ output }) {
  const rules = output?.applicable_rules ?? [];
  const sev = output?.severity ?? "";

  return (
    <div className="card" style={{ marginTop: 12, animation: "slideUp 0.3s ease both" }}>
      <div className="agent-header">
        <span>02 — COMPLIANCE MAPPER</span>
        {sev && <span className={`badge ${severityBadgeClass(sev)}`}>{sev.toUpperCase()}</span>}
      </div>
      <div style={{ padding: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", marginBottom: 10, letterSpacing: "0.12em" }}>
              APPLICABLE RULES
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rules.map((r, i) => (
                <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 13, display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--coral)", fontWeight: 500, flexShrink: 0 }}>→</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {output?.regulatory_body && (
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", marginBottom: 4, letterSpacing: "0.12em" }}>
                  REGULATORY BODY
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink)" }}>
                  {output.regulatory_body}
                </div>
              </div>
            )}
            {output?.recommended_action && (
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", marginBottom: 6, letterSpacing: "0.12em" }}>
                  RECOMMENDED ACTION
                </div>
                <div className="action-box">{output.recommended_action}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Report renderer — strips ** markdown, centres headers ─────────────── */
function renderReport(raw, sigName) {
  if (!raw) return null;
  // Strip ** markers and replace [Your Name] placeholder with actual name
  const clean = raw
    .replace(/\*\*/g, "")
    .replace(/\[Your Name\]/gi, sigName && sigName.trim() ? sigName.trim() : "[Your Name]")
    .trim();
  const blocks = clean.split(/\n\n+/);

  return blocks.map((block, i) => {
    const lines = block.trim().split("\n").filter(Boolean);
    if (!lines.length) return null;
    const first = lines[0].trim();

    // Single short line with no bullet/number prefix = section header
    const isHeader =
      lines.length === 1 &&
      first.length < 60 &&
      !first.startsWith("-") &&
      !/^\d+\./.test(first);

    if (isHeader) {
      return (
        <div key={i} style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          letterSpacing: "0.06em",
          color: "var(--ink)",
          textAlign: "center",
          marginTop: i > 0 ? 22 : 0,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: "1px solid var(--border-thin)",
        }}>
          {first}
        </div>
      );
    }

    return (
      <div key={i} style={{ marginBottom: 10 }}>
        {lines.map((line, j) => {
          const t = line.trim();
          const isList = t.startsWith("-") || /^\d+\./.test(t);
          return (
            <div key={j} style={{
              fontFamily: "var(--font-serif)",
              fontSize: 14,
              lineHeight: 1.75,
              color: "var(--ink)",
              paddingLeft: isList ? 16 : 0,
              marginBottom: 2,
            }}>
              {t}
            </div>
          );
        })}
      </div>
    );
  });
}

/* ── Agent 3 output card ────────────────────────────────────────────────── */
function Agent3Card({ output, caseId, onReviewed }) {
  const [notes, setNotes]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [flash, setFlash]   = useState(false);
  const [sigName, setSigName] = useState(
    () => localStorage.getItem("tg_reviewer_name") || ""
  );
  const [editingSig, setEditingSig] = useState(false);

  function handleSigChange(e) {
    setSigName(e.target.value);
    localStorage.setItem("tg_reviewer_name", e.target.value);
  }

  async function submit(action) {
    if (!caseId) return;
    setBusy(true);
    if (action === "approve") { setFlash(true); setTimeout(() => setFlash(false), 600); }
    await reviewCase(caseId, action, notes);
    setBusy(false);
    if (onReviewed) onReviewed();
  }

  return (
    <div
      className="card"
      style={{
        marginTop: 12,
        animation: "slideUp 0.3s ease both",
        ...(flash ? { animation: "greenFlash 0.6s ease" } : {}),
      }}
    >
      <div className="agent-header">
        <span>03 — COMPLIANCE REPORT</span>
      </div>
      <div style={{ padding: "20px" }}>
        <div style={{ maxHeight: 400, overflowY: "auto", marginBottom: 8 }}>
          {renderReport(output, sigName)}
        </div>

        {/* Signature block */}
        <div style={{
          borderTop: "2px solid var(--border-thin)",
          paddingTop: 14,
          marginBottom: 20,
        }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 9,
            color: "var(--ink-muted)", letterSpacing: "0.12em", marginBottom: 6,
          }}>
            REVIEWER SIGNATURE
          </div>

          {editingSig ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                autoFocus
                value={sigName}
                onChange={handleSigChange}
                onBlur={() => setEditingSig(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingSig(false)}
                placeholder="Type your full name…"
                style={{
                  flex: 1,
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  fontSize: 18,
                  border: "none",
                  borderBottom: "2px solid var(--border)",
                  background: "transparent",
                  color: "var(--ink)",
                  outline: "none",
                  padding: "4px 0",
                }}
              />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)" }}>
                Enter to save
              </span>
            </div>
          ) : (
            <div
              onClick={() => setEditingSig(true)}
              title="Click to edit your name"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer",
                padding: "4px 0",
                borderBottom: "2px dashed var(--border-thin)",
              }}
            >
              <span style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: 18,
                color: sigName ? "var(--ink)" : "var(--ink-muted)",
              }}>
                {sigName || "Click to add your name…"}
              </span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9,
                color: "var(--ink-muted)", letterSpacing: "0.1em",
                marginLeft: "auto",
              }}>
                ✎ EDIT
              </span>
            </div>
          )}
        </div>

        {caseId && (
          <>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reviewer notes (optional)…"
              style={{
                width: "100%", minHeight: 64,
                background: "var(--bg)",
                border: "2px solid var(--border)",
                borderRadius: 0,
                color: "var(--ink)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                padding: "8px 12px",
                resize: "vertical",
                marginBottom: 12,
              }}
            />
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-approve" disabled={busy} onClick={() => submit("approve")}
                style={{ flex: 1 }}>
                APPROVE CASE
              </button>
              <button className="btn btn-reject" disabled={busy} onClick={() => submit("reject")}
                style={{ flex: 1 }}>
                REJECT CASE
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Exports ────────────────────────────────────────────────────────────── */
export { Agent1Card, Agent2Card, Agent3Card, renderReport };
