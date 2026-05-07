import json
from datetime import datetime, date
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import engine, get_db, Base
from models import Transaction, ComplianceCase
from mock_data import seed_database
from orchestrator import ComplianceOrchestrator

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TradeGuard AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    seed_database(db)
    db.close()


# ── Schemas ───────────────────────────────────────────────────────────────────
class ReviewPayload(BaseModel):
    action: str          # "approve" | "reject"
    notes: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────
def tx_to_dict(tx: Transaction) -> dict:
    return {
        "id": tx.id,
        "timestamp": tx.timestamp.isoformat(),
        "user_id": tx.user_id,
        "amount": tx.amount,
        "currency": tx.currency,
        "trade_type": tx.trade_type,
        "asset": tx.asset,
        "ip_address": tx.ip_address,
        "country": tx.country,
        "status": tx.status,
    }


def case_to_dict(case: ComplianceCase, include_report: bool = False) -> dict:
    agent1 = None
    agent2 = None
    if case.agent1_output:
        try:
            agent1 = json.loads(case.agent1_output)
        except Exception:
            agent1 = case.agent1_output
    if case.agent2_output:
        try:
            agent2 = json.loads(case.agent2_output)
        except Exception:
            agent2 = case.agent2_output

    severity = None
    if agent2 and isinstance(agent2, dict):
        severity = agent2.get("severity")

    d = {
        "id": case.id,
        "transaction_id": case.transaction_id,
        "overall_risk_score": case.overall_risk_score,
        "severity": severity,
        "status": case.status,
        "reviewer_notes": case.reviewer_notes,
        "created_at": case.created_at.isoformat(),
        "agent1_output": agent1,
        "agent2_output": agent2,
    }
    if include_report:
        d["agent3_report"] = case.agent3_report
    return d


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/api/transactions")
def list_transactions(db: Session = Depends(get_db)):
    txs = db.query(Transaction).order_by(Transaction.timestamp.desc()).all()
    return [tx_to_dict(t) for t in txs]


@app.get("/api/cases")
def list_cases(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(ComplianceCase)
    if status:
        q = q.filter(ComplianceCase.status == status)
    cases = q.order_by(ComplianceCase.created_at.desc()).all()
    result = [case_to_dict(c) for c in cases]
    if severity:
        result = [c for c in result if c.get("severity") == severity]
    return result


@app.get("/api/cases/{case_id}")
def get_case(case_id: int, db: Session = Depends(get_db)):
    case = db.query(ComplianceCase).filter(ComplianceCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    tx = db.query(Transaction).filter(Transaction.id == case.transaction_id).first()
    data = case_to_dict(case, include_report=True)
    if tx:
        data["transaction"] = tx_to_dict(tx)
    return data


@app.patch("/api/cases/{case_id}/review")
def review_case(case_id: int, payload: ReviewPayload, db: Session = Depends(get_db)):
    case = db.query(ComplianceCase).filter(ComplianceCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if payload.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    case.status = "approved" if payload.action == "approve" else "rejected"
    case.reviewer_notes = payload.notes

    tx = db.query(Transaction).filter(Transaction.id == case.transaction_id).first()
    if tx:
        tx.status = case.status

    db.commit()
    return case_to_dict(case, include_report=True)


# Pipeline state cache (in-memory for simplicity — resets on restart)
_pipeline_cache: dict[int, dict] = {}


@app.post("/api/analyze/{transaction_id}")
def analyze_transaction(
    transaction_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    _pipeline_cache[transaction_id] = {"pipeline_status": "running", "started_at": datetime.utcnow().isoformat()}

    def run_pipeline():
        from database import SessionLocal
        pipeline_db = SessionLocal()
        try:
            orchestrator = ComplianceOrchestrator(pipeline_db)
            result = orchestrator.run(transaction_id)
            _pipeline_cache[transaction_id] = result
        except Exception as e:
            _pipeline_cache[transaction_id] = {"pipeline_status": "failed", "error": str(e)}
        finally:
            pipeline_db.close()

    background_tasks.add_task(run_pipeline)
    return {"message": "Analysis started", "transaction_id": transaction_id}


@app.get("/api/pipeline/{transaction_id}")
def get_pipeline_status(transaction_id: int):
    state = _pipeline_cache.get(transaction_id)
    if not state:
        return {"pipeline_status": "not_started"}
    return state


@app.get("/api/analytics")
def get_analytics(db: Session = Depends(get_db)):
    today = date.today()
    all_cases = db.query(ComplianceCase).all()
    today_cases = [c for c in all_cases if c.created_at.date() == today]

    flagged = [c for c in all_cases if c.status in ("pending_review", "approved", "rejected")]
    scores = [c.overall_risk_score for c in all_cases if c.overall_risk_score is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0

    severity_counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for c in all_cases:
        if c.agent2_output:
            try:
                data = json.loads(c.agent2_output)
                sev = data.get("severity", "").lower()
                if sev in severity_counts:
                    severity_counts[sev] += 1
            except Exception:
                pass

    recent = (
        db.query(ComplianceCase)
        .order_by(ComplianceCase.created_at.desc())
        .limit(10)
        .all()
    )
    recent_feed = []
    for c in recent:
        tx = db.query(Transaction).filter(Transaction.id == c.transaction_id).first()
        recent_feed.append({
            "case_id": c.id,
            "transaction_id": c.transaction_id,
            "user_id": tx.user_id if tx else "?",
            "status": c.status,
            "risk_score": c.overall_risk_score,
            "created_at": c.created_at.isoformat(),
        })

    flagged_rate = round(len(flagged) / len(all_cases) * 100, 1) if all_cases else 0

    return {
        "total_cases_today": len(today_cases),
        "total_cases": len(all_cases),
        "flagged_rate_pct": flagged_rate,
        "average_risk_score": avg_score,
        "severity_counts": severity_counts,
        "recent_activity": recent_feed,
    }
