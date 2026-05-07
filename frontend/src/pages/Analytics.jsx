import { useState, useEffect, useRef } from "react";
import { getAnalytics } from "../api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { statusBadgeClass, severityBadgeClass } from "../components/RiskBadge";

/* ── Animated counter hook ──────────────────────────────────────────────── */
function useCounter(target, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    if (target === null || target === undefined) return;
    const numTarget = parseFloat(target);
    if (isNaN(numTarget)) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(numTarget * eased);
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return val;
}

/* ── Severity color map ─────────────────────────────────────────────────── */
const SEV_FILL = { low: "#00C853", medium: "#FFE600", high: "#FF3B30", critical: "#FF3B30" };

const severityLeftColor = {
  low:            "var(--green)",
  medium:         "var(--yellow)",
  high:           "var(--coral)",
  critical:       "var(--coral)",
  pending_review: "var(--yellow)",
  approved:       "var(--green)",
  rejected:       "#888",
};

/* ── Custom tooltip ─────────────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--ink)", color: "#fff",
      border: "2px solid var(--border)",
      padding: "8px 14px",
      fontFamily: "var(--font-mono)", fontSize: 12,
    }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: "0.06em" }}>
        {label.toUpperCase()}
      </div>
      <div>{payload[0].value} cases</div>
    </div>
  );
}

/* ── Metric card ────────────────────────────────────────────────────────── */
function MetricCard({ label, rawValue, suffix = "", color, decimals = 0, idx = 0 }) {
  const animated = useCounter(rawValue);
  const display = rawValue === null || rawValue === undefined ? "—"
    : (decimals > 0 ? animated.toFixed(decimals) : Math.round(animated).toString());

  return (
    <div
      className="card"
      style={{
        padding: "24px 20px",
        boxShadow: "6px 6px 0 var(--border)",
        animation: `slideUp 0.3s ease ${idx * 0.07}s both`,
      }}
    >
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)",
        letterSpacing: "0.14em", marginBottom: 8, textTransform: "uppercase",
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: 64,
        lineHeight: 1,
        color: color || "var(--ink)",
        letterSpacing: "-0.01em",
      }}>
        {display}{suffix}
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function Analytics() {
  const [data, setData] = useState(null);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    getAnalytics().then(setData);
    const t = setInterval(() => getAnalytics().then(setData), 15000);
    return () => clearInterval(t);
  }, []);

  if (!data) return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--ink-muted)", padding: 40 }}>
      <span className="spinner" /> LOADING INTELLIGENCE REPORT…
    </div>
  );

  const chartData = Object.entries(data.severity_counts).map(([name, count]) => ({ name, count }));

  const flagColor = data.flagged_rate_pct > 50 ? "var(--coral)"
                  : data.flagged_rate_pct > 25 ? "var(--yellow)"
                  : "var(--green)";
  const scoreColor = data.average_risk_score >= 70 ? "var(--coral)"
                   : data.average_risk_score >= 40 ? "var(--yellow)"
                   : "var(--green)";

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: 72,
          letterSpacing: "0.08em",
          lineHeight: 1,
          color: "var(--ink)",
        }}>
          INTELLIGENCE<br />REPORT
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)", marginTop: 8 }}>
          {today}
        </div>
      </div>

      {/* ── 3 metric cards ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <MetricCard label="Total Cases Today"  rawValue={data.total_cases_today}   color="var(--ink)"  idx={0} />
        <MetricCard label="Flagged Rate"       rawValue={data.flagged_rate_pct}    suffix="%" color={flagColor}  decimals={1} idx={1} />
        <MetricCard label="Avg Risk Score"     rawValue={data.average_risk_score}  color={scoreColor} decimals={1} idx={2} />
      </div>

      {/* ── Charts + feed ───────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Bar chart */}
        <div className="card" style={{ padding: "20px", boxShadow: "6px 6px 0 var(--border)", animation: "slideUp 0.3s ease 0.2s both" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: "0.1em", marginBottom: 16, color: "var(--ink)" }}>
            CASES BY SEVERITY
          </div>
          {chartData.every((d) => d.count === 0) ? (
            <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)", padding: 40 }}>
              No cases yet. Run analysis first.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(10,10,10,0.12)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontFamily: "var(--font-mono)", fontSize: 11, fill: "var(--ink-muted)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontFamily: "var(--font-mono)", fontSize: 11, fill: "var(--ink-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(10,10,10,0.04)" }} />
                <Bar dataKey="count" radius={0}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={SEV_FILL[entry.name] || "var(--ink)"} stroke="var(--border)" strokeWidth={1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent activity feed */}
        <div className="card" style={{ padding: "20px", boxShadow: "6px 6px 0 var(--border)", animation: "slideUp 0.3s ease 0.25s both" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: "0.1em", marginBottom: 16, color: "var(--ink)" }}>
            RECENT ACTIVITY
          </div>
          {data.recent_activity.length === 0 ? (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)", padding: 20, textAlign: "center" }}>
              No recent activity.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.recent_activity.map((item) => {
                const leftColor = severityLeftColor[item.status] || "var(--ink-muted)";
                return (
                  <div
                    key={item.case_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      background: "var(--bg)",
                      border: "1px solid var(--border-thin)",
                      borderLeft: `4px solid ${leftColor}`,
                    }}
                  >
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                      <span style={{ color: "var(--ink)", fontWeight: 500 }}>#{item.case_id}</span>
                      <span style={{ color: "var(--ink-muted)", margin: "0 6px" }}>·</span>
                      <span>{item.user_id}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {item.risk_score !== null && (
                        <span style={{
                          fontFamily: "var(--font-display)", fontSize: 18,
                          color: item.risk_score >= 70 ? "var(--coral)" : item.risk_score >= 40 ? "var(--yellow)" : "var(--green)",
                        }}>
                          {Math.round(item.risk_score)}
                        </span>
                      )}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)" }}>
                        {new Date(item.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Total cases breakdown ────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: 16, padding: "16px 20px", boxShadow: "4px 4px 0 var(--border)", animation: "slideUp 0.3s ease 0.3s both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-muted)", letterSpacing: "0.12em" }}>TOTAL CASES ALL TIME</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 36, color: "var(--ink)" }}>{data.total_cases}</div>
          </div>
          <div style={{ flex: 1, height: 2, background: "var(--border-thin)" }} />
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)" }}>
            Refreshes every 15 seconds
          </div>
        </div>
      </div>
    </div>
  );
}
