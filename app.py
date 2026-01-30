from __future__ import annotations

import json
import os
import secrets
import string
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
from sqlalchemy.orm import sessionmaker, declarative_base

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


# -----------------------------
# Config
# -----------------------------
APP_TITLE = "Health-E"
DB_PATH = os.getenv("KIOSK_DB_PATH", "kiosk.db")
DATABASE_URL = os.getenv("DB_URL", f"sqlite:///{DB_PATH}")
REPORT_DIR = os.getenv("REPORT_DIR", "reports")

os.makedirs(REPORT_DIR, exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


# -----------------------------
# DB model
# -----------------------------
class Intake(Base):
    __tablename__ = "intakes"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ref_id = Column(String(32), unique=True, index=True, nullable=False)  # 20-char id fits
    payload_json = Column(Text, nullable=False)  # stores intake + AI + computed


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


# -----------------------------
# Helpers
# -----------------------------
ALPHABET = string.ascii_uppercase + string.digits  # clean, readable

def generate_ref_id(n: int = 20) -> str:
    # cryptographically strong, collision-resistant enough for prototype
    return "".join(secrets.choice(ALPHABET) for _ in range(n))

def build_pdf(report_path: str, ref_id: str, payload: Dict[str, Any]) -> None:
    """
    Generates a professional single-page PDF report.
    You can extend to multi-page later.
    """
    c = canvas.Canvas(report_path, pagesize=letter)
    width, height = letter

    # Header
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1.0 * inch, height - 1.0 * inch, "Health-E Screening Report")

    c.setFont("Helvetica", 10)
    c.drawString(1.0 * inch, height - 1.25 * inch, f"Reference ID: {ref_id}")
    c.drawString(1.0 * inch, height - 1.42 * inch, f"Generated (UTC): {payload.get('created_at_utc', '')}")

    # Divider
    c.line(1.0 * inch, height - 1.55 * inch, width - 1.0 * inch, height - 1.55 * inch)

    # Body
    y = height - 1.85 * inch
    line_h = 14

    intake = payload.get("intake", {})
    ai = payload.get("ai", {})

    def draw_label_value(label: str, value: str):
        nonlocal y
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1.0 * inch, y, f"{label}:")
        c.setFont("Helvetica", 10)
        c.drawString(2.2 * inch, y, value)
        y -= line_h

    draw_label_value("Patient Name", str(intake.get("name", "—")))
    draw_label_value("Age", str(intake.get("age", "—")))
    draw_label_value("Sex", str(intake.get("sex", "—")))

    y -= 6
    c.setFont("Helvetica-Bold", 11)
    c.drawString(1.0 * inch, y, "AI Screening Summary")
    y -= (line_h + 2)

    condition = str(ai.get("condition", "Non-specific symptoms (screening suggestion)"))
    otc = ai.get("otc", [])
    notes = str(ai.get("notes", "This is informational only. Please verify clinically."))

    c.setFont("Helvetica", 10)
    c.drawString(1.0 * inch, y, f"Likely condition (screening): {condition}")
    y -= line_h

    c.setFont("Helvetica-Bold", 10)
    c.drawString(1.0 * inch, y, "OTC Suggestions (informational):")
    y -= line_h

    c.setFont("Helvetica", 10)
    if not otc:
        c.drawString(1.2 * inch, y, "—")
        y -= line_h
    else:
        for item in otc[:6]:
            c.drawString(1.2 * inch, y, f"• {str(item)}")
            y -= line_h

    y -= 4
    c.setFont("Helvetica-Bold", 10)
    c.drawString(1.0 * inch, y, "Notes:")
    y -= line_h

    c.setFont("Helvetica", 10)
    # simple wrap
    max_chars = 92
    for i in range(0, len(notes), max_chars):
        c.drawString(1.2 * inch, y, notes[i:i+max_chars])
        y -= line_h

    # Footer disclaimer
    c.line(1.0 * inch, 1.35 * inch, width - 1.0 * inch, 1.35 * inch)
    c.setFont("Helvetica", 8)
    disclaimer = (
        "Disclaimer: Health-E is a prototype. Output is informational only and not a medical diagnosis. "
        "If symptoms are severe or worsening, seek emergency care."
    )
    c.drawString(1.0 * inch, 1.1 * inch, disclaimer[:115])
    c.drawString(1.0 * inch, 0.95 * inch, disclaimer[115:])

    c.showPage()
    c.save()


# -----------------------------
# API Schemas
# -----------------------------
class IntakeStart(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    age: int = Field(..., ge=0, le=120)
    sex: str = Field(..., pattern="^(Male|Female)$")
    acceptedTerms: bool = True


# -----------------------------
# App
# -----------------------------
app = FastAPI(title=APP_TITLE)

@app.on_event("startup")
def _startup() -> None:
    init_db()

# serve your static UI exactly as-is
app.mount("/static", StaticFiles(directory="static", html=True), name="static")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/intake/start")
def intake_start(req: IntakeStart):
    if not req.acceptedTerms:
        raise HTTPException(status_code=400, detail="Terms must be accepted.")

    # create unique 20-char ref id
    ref_id = generate_ref_id(20)

    # placeholder “AI” result for now (you’ll replace with MedGemma later)
    ai_result = {
        "condition": "Non-specific symptoms (screening suggestion)",
        "otc": [
            "Acetaminophen (as directed on label) for pain/fever",
            "Oral rehydration + rest",
        ],
        "notes": (
            "Based on limited intake data only. Add symptoms/chat to enable better screening. "
            "Verify allergies, contraindications, pregnancy status, and current meds before use."
        ),
    }

    payload = {
        "intake": {"name": req.name, "age": req.age, "sex": req.sex},
        "ai": ai_result,
        "created_at_utc": datetime.utcnow().isoformat(),
    }

    report_path = os.path.join(REPORT_DIR, f"{ref_id}.pdf")
    build_pdf(report_path, ref_id, payload)

    db = SessionLocal()
    try:
        db.add(Intake(ref_id=ref_id, payload_json=json.dumps(payload)))
        db.commit()
    finally:
        db.close()

    return JSONResponse({
        "ref_id": ref_id,
        "report_pdf_url": f"/api/report/{ref_id}.pdf",
    })


@app.get("/api/report/{ref_id}")
def report_json(ref_id: str):
    db = SessionLocal()
    try:
        it = db.query(Intake).filter(Intake.ref_id == ref_id).first()
        if not it:
            raise HTTPException(status_code=404, detail="Ref ID not found.")
        return JSONResponse(json.loads(it.payload_json))
    finally:
        db.close()


@app.get("/api/report/{ref_id}.pdf")
def report_pdf(ref_id: str):
    path = os.path.join(REPORT_DIR, f"{ref_id}.pdf")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="PDF not found.")
    return FileResponse(path, media_type="application/pdf", filename=f"Health-E_{ref_id}.pdf")
