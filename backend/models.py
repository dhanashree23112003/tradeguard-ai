from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String, index=True)
    amount = Column(Float)
    currency = Column(String)
    trade_type = Column(String)  # buy/sell
    asset = Column(String)       # BTC/ETH/forex pair
    ip_address = Column(String)
    country = Column(String)
    status = Column(String, default="pending")  # pending/flagged/cleared/approved/rejected

    cases = relationship("ComplianceCase", back_populates="transaction")


class ComplianceCase(Base):
    __tablename__ = "compliance_cases"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    agent1_output = Column(Text, nullable=True)   # JSON string
    agent2_output = Column(Text, nullable=True)   # JSON string
    agent3_report = Column(Text, nullable=True)   # plain text
    overall_risk_score = Column(Float, nullable=True)
    status = Column(String, default="pending_review")  # pending_review/approved/rejected
    reviewer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    transaction = relationship("Transaction", back_populates="cases")
