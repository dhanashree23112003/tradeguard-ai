# TradeGuard AI

A full-stack multi-agent AI compliance monitoring system that detects suspicious trading activity, maps regulatory violations, and generates formal compliance reports — with a human-in-the-loop approval step.

![TradeGuard AI](https://img.shields.io/badge/AI-Multi--Agent-blue) ![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green) ![React](https://img.shields.io/badge/Frontend-React-61dafb) ![Groq](https://img.shields.io/badge/LLM-Llama%203.3%2070B-orange)

---

## What It Does

A transaction comes in. Three AI agents analyze it in sequence:

- **Agent 1 — Transaction Analyst** — scores the transaction 0-100 for risk, detects flags like large amounts, unusual hours, geographic anomalies, and rapid buy-sell reversals
- **Agent 2 — Compliance Mapper** — maps violations to real regulations (AML, FATF, KYC, wash trading)
- **Agent 3 — Report Writer** — generates a formal legal compliance report

A human compliance officer then reviews the case and explicitly approves or rejects it. Nothing is finalized without a human decision.

If Agent 1 finds no suspicious activity, the transaction is cleared and Agents 2 and 3 are skipped.

---

## Key Features

- 3-agent LLM pipeline with separate API calls and system prompts per agent
- Cross-transaction context: detects rapid buy-sell reversals by querying related transactions within a 5-minute window before calling Agent 1
- Real-time pipeline visualization with animated agent state transitions
- Human-in-the-loop approval workflow (Approve / Reject with reviewer notes)
- Persistent reviewer signature saved to localStorage
- Rate limit retry logic with exponential backoff (20s / 40s / 60s)
- Safe JSON parsing with error fallback so one bad agent response does not crash the pipeline
- Analytics dashboard with severity breakdown chart and activity feed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
| Database | SQLite via SQLAlchemy |
| AI | Llama 3.3 70B via Groq API |
| Charts | Recharts |

---

## Project Structure

```
TradeGuard AI/
  backend/
    main.py          # FastAPI routes and endpoints
    models.py        # SQLAlchemy models (Transaction, ComplianceCase)
    orchestrator.py  # 3-agent pipeline logic
    database.py      # DB connection and session
    mock_data.py     # Seeds 20 mock transactions on startup
    requirements.txt
  frontend/
    src/
      pages/
        PipelineView.jsx      # Live agent pipeline page
        CaseManagement.jsx    # Case review and approval page
        Analytics.jsx         # Stats and charts page
      components/
        AgentStep.jsx         # Agent output cards and report renderer
        RiskBadge.jsx         # Status and severity badge helpers
      api.js                  # All API calls
      App.jsx
  .env.example
  README.md
```

---

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- Free Groq API key from [console.groq.com](https://console.groq.com)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/tradeguard-ai.git
cd tradeguard-ai
```

### 2. Set up environment

```bash
cp .env.example backend/.env
# Open backend/.env and add your Groq API key
```

### 3. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000`. On first start it seeds 20 mock transactions automatically.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/transactions | List all transactions |
| POST | /api/analyze/{id} | Run 3-agent compliance pipeline |
| GET | /api/pipeline/{id} | Poll pipeline status |
| GET | /api/cases | List compliance cases |
| GET | /api/cases/{id} | Get full case with agent outputs |
| PATCH | /api/cases/{id}/review | Approve or reject a case |
| GET | /api/analytics | Summary statistics |

---

## Demo

The mock data includes a mix of transactions to demonstrate different outcomes:

| Transaction | Amount | Country | Expected |
|---|---|---|---|
| TX-1 BTC Buy | USD 95,000 | Russia | Flagged — large amount + high-risk country |
| TX-3 ETH Buy | EUR 250,000 | Iran | Flagged — critical, unusual hours (3AM) |
| TX-4/5 EUR/USD | USD 12,500 / 12,400 | China | Flagged — rapid buy-sell reversal (3 min apart) |
| TX-6 BTC Buy | USD 500,000 | North Korea | Flagged — critical |
| TX-9 ETH Buy | USD 500 | USA | Cleared — clean transaction |

---

## Note on Rate Limits

This project uses the Groq free tier which has a 12,000 tokens per minute limit. Wait 10-15 seconds between analyses to stay within the limit. If you see STATUS: FAILED, wait 60 seconds and retry — the token bucket resets every minute.

---

## License

MIT
