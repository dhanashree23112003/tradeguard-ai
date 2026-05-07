export function statusBadgeClass(status) {
  const map = {
    pending:        "badge-pending",
    flagged:        "badge-flagged",
    cleared:        "badge-cleared",
    approved:       "badge-approved",
    rejected:       "badge-rejected",
    pending_review: "badge-pending_review",
  };
  return map[status] || "badge-pending";
}

export function severityBadgeClass(sev) {
  const map = {
    low:      "badge-low",
    medium:   "badge-medium",
    high:     "badge-high",
    critical: "badge-critical",
  };
  return map[(sev || "").toLowerCase()] || "badge-pending";
}

export function riskColor(score) {
  if (score === null || score === undefined) return "var(--ink-muted)";
  if (score >= 70) return "var(--coral)";
  if (score >= 40) return "var(--yellow)";
  return "var(--green)";
}
