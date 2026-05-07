import json
import os
import time
from groq import Groq
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

MODEL = "llama-3.3-70b-versatile"


def _get_client():
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set. Create a backend/.env file with your key.")
    return Groq(api_key=key)

AGENT1_SYSTEM = (
    "You are a financial fraud analyst. You will receive a target transaction AND a list of "
    "recent related transactions from the same user or IP address for context. "
    "Analyze ALL of them together to identify suspicious patterns. Look for: "
    "unusually large trade amounts (>$10,000), rapid buy-sell reversals within 5 minutes "
    "(e.g. user buys then sells the same asset within minutes — check the related_transactions), "
    "trades at unusual hours (2AM-5AM), multiple transactions from the same IP in under 60 seconds, "
    "and geographic anomalies. "
    "Return ONLY a valid JSON object with fields: "
    "is_suspicious (bool), risk_score (0-100), flags (list of strings), reasoning (string). "
    "Do not include any text outside the JSON object."
)

AGENT2_SYSTEM = (
    "You are a financial compliance officer. Given a suspicious transaction and its flags, "
    "map it to the relevant regulatory frameworks. Consider: AML (Anti-Money Laundering) "
    "thresholds, FATF travel rule violations, KYC gaps, wash trading patterns, and market "
    "manipulation indicators. "
    "Return ONLY a valid JSON object with fields: "
    "applicable_rules (list of strings), severity (low/medium/high/critical), "
    "recommended_action (string), regulatory_body (string). "
    "Do not include any text outside the JSON object."
)

AGENT3_SYSTEM = (
    "You are a compliance report writer. Given a transaction, its risk analysis, and compliance "
    "mapping, generate a formal structured compliance report. Include sections: "
    "Executive Summary, Transaction Details, Risk Assessment, Regulatory Implications, and "
    "Recommended Action. Write in formal legal-financial language suitable for a compliance "
    "officer to review and submit. Be concise but thorough."
)


def _call_agent(system_prompt: str, user_message: str, max_tokens: int = 600, retries: int = 2) -> str:
    for attempt in range(retries):
        try:
            response = _get_client().chat.completions.create(
                model=MODEL,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )
            return response.choices[0].message.content
        except Exception as e:
            is_rate_limit = "rate limit" in str(e).lower() or "429" in str(e)
            if is_rate_limit and attempt < retries - 1:
                wait = 20 * (attempt + 1)  # 20s, 40s, 60s
                print(f"[TradeGuard] Rate limit — waiting {wait}s then retrying ({attempt + 2}/{retries})")
                time.sleep(wait)
            else:
                raise


def _parse_json(text: str) -> dict:
    text = text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
    return json.loads(text)


class ComplianceOrchestrator:
    def __init__(self, db):
        self.db = db

    def run(self, transaction_id: int) -> dict:
        from models import Transaction, ComplianceCase

        tx = self.db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not tx:
            return {"error": "Transaction not found"}

        # Create or reuse a compliance case
        case = self.db.query(ComplianceCase).filter(
            ComplianceCase.transaction_id == transaction_id
        ).first()
        if not case:
            case = ComplianceCase(transaction_id=transaction_id, created_at=datetime.utcnow())
            self.db.add(case)
            self.db.commit()
            self.db.refresh(case)

        result = {
            "transaction_id": transaction_id,
            "case_id": case.id,
            "agent1": {"status": "pending", "output": None},
            "agent2": {"status": "skipped", "output": None},
            "agent3": {"status": "skipped", "output": None},
            "pipeline_status": "running",
        }

        # --- Agent 1: Transaction Analyst ---
        tx_dict = {
            "id": tx.id,
            "timestamp": tx.timestamp.isoformat(),
            "user_id": tx.user_id,
            "amount": tx.amount,
            "currency": tx.currency,
            "trade_type": tx.trade_type,
            "asset": tx.asset,
            "ip_address": tx.ip_address,
            "country": tx.country,
        }

        # Fetch related transactions for reversal / same-IP detection
        window_5min  = tx.timestamp - timedelta(minutes=5)
        window_60sec = tx.timestamp - timedelta(seconds=60)

        from models import Transaction as Tx
        related_reversal = (
            self.db.query(Tx)
            .filter(
                Tx.id        != tx.id,
                Tx.user_id   == tx.user_id,
                Tx.asset     == tx.asset,
                Tx.timestamp >= window_5min,
                Tx.timestamp <= tx.timestamp + timedelta(minutes=5),
            )
            .all()
        )
        related_same_ip = (
            self.db.query(Tx)
            .filter(
                Tx.id         != tx.id,
                Tx.ip_address == tx.ip_address,
                Tx.timestamp  >= window_60sec,
                Tx.timestamp  <= tx.timestamp + timedelta(seconds=60),
            )
            .all()
        )

        # Merge and deduplicate
        seen_ids = set()
        related = []
        for r in related_reversal + related_same_ip:
            if r.id not in seen_ids:
                seen_ids.add(r.id)
                related.append({
                    "id":         r.id,
                    "timestamp":  r.timestamp.isoformat(),
                    "user_id":    r.user_id,
                    "amount":     r.amount,
                    "currency":   r.currency,
                    "trade_type": r.trade_type,
                    "asset":      r.asset,
                    "ip_address": r.ip_address,
                    "country":    r.country,
                })

        agent1_prompt = (
            f"Target transaction to analyze:\n{json.dumps(tx_dict, indent=2)}\n\n"
            f"Related transactions from the same user/IP within the detection window "
            f"({len(related)} found):\n{json.dumps(related, indent=2)}"
        )

        # Store context so the frontend can display the detection window
        result["agent1_context"] = {
            "related_transactions": related,
            "reversal_window_minutes": 5,
            "ip_window_seconds": 60,
        }

        try:
            raw1 = _call_agent(AGENT1_SYSTEM, agent1_prompt, max_tokens=512)
            agent1_data = _parse_json(raw1)
            result["agent1"] = {"status": "completed", "output": agent1_data}
            case.agent1_output = json.dumps(agent1_data)
            case.overall_risk_score = agent1_data.get("risk_score")
        except Exception as e:
            result["agent1"] = {"status": "failed", "error": str(e)}
            case.agent1_output = json.dumps({"error": str(e)})
            tx.status = "pending"  # keep pending so user can retry
            self.db.commit()
            result["pipeline_status"] = "failed"
            return result

        self.db.commit()

        is_suspicious = agent1_data.get("is_suspicious", False)

        if not is_suspicious:
            tx.status = "cleared"
            case.status = "cleared"
            self.db.commit()
            result["pipeline_status"] = "completed"
            result["final_status"] = "cleared"
            return result

        # Transaction is suspicious — proceed
        tx.status = "flagged"
        self.db.commit()

        # --- Agent 2: Compliance Mapper ---
        agent2_prompt = (
            f"Transaction:\n{json.dumps(tx_dict, indent=2)}\n\n"
            f"Risk Analysis:\n{json.dumps(agent1_data, indent=2)}"
        )
        try:
            raw2 = _call_agent(AGENT2_SYSTEM, agent2_prompt, max_tokens=512)
            agent2_data = _parse_json(raw2)
            result["agent2"] = {"status": "completed", "output": agent2_data}
            case.agent2_output = json.dumps(agent2_data)
        except Exception as e:
            result["agent2"] = {"status": "failed", "error": str(e)}
            case.agent2_output = json.dumps({"error": str(e)})
            self.db.commit()
            result["pipeline_status"] = "partial"
            return result

        self.db.commit()

        # --- Agent 3: Report Generator ---
        agent3_prompt = (
            f"Transaction:\n{json.dumps(tx_dict, indent=2)}\n\n"
            f"Risk Analysis:\n{json.dumps(agent1_data, indent=2)}\n\n"
            f"Compliance Mapping:\n{json.dumps(agent2_data, indent=2)}"
        )
        try:
            raw3 = _call_agent(AGENT3_SYSTEM, agent3_prompt, max_tokens=1200, retries=3)
            result["agent3"] = {"status": "completed", "output": raw3}
            case.agent3_report = raw3
        except Exception as e:
            result["agent3"] = {"status": "failed", "error": str(e)}
            case.agent3_report = f"Report generation failed: {e}"
            self.db.commit()
            result["pipeline_status"] = "partial"
            return result

        case.status = "pending_review"
        self.db.commit()
        result["pipeline_status"] = "completed"
        result["final_status"] = "flagged_pending_review"
        return result
