"""Signatories and app settings routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AppSetting, Signatory, User
from app.schemas.signatory import (
    AppSettingsOut,
    AppSettingsUpdate,
    SignatoryCreate,
    SignatoryOut,
    SignatoryUpdate,
)
from app.utils.security import get_current_user, require_role

router = APIRouter(prefix="/signatories", tags=["signatories"])

_admin = require_role("admin")

CERTIFIER_KEY = "certifier_id"
ISSUER_KEY = "issuer_id"
REGION_KEY = "region"


# ── helpers ──────────────────────────────────────────────────────────────────

def _get_setting(db: Session, key: str) -> str | None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row else None


def _set_setting(db: Session, key: str, value: str | None) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))
    db.commit()


# ── app settings (MUST be declared before /{id} to avoid route shadowing) ────

@router.get("/settings", response_model=AppSettingsOut)
def get_signatory_settings(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AppSettingsOut:
    cert = _get_setting(db, CERTIFIER_KEY)
    iss = _get_setting(db, ISSUER_KEY)
    region = _get_setting(db, REGION_KEY)
    return AppSettingsOut(
        certifier_id=uuid.UUID(cert) if cert else None,
        issuer_id=uuid.UUID(iss) if iss else None,
        region=region,
    )


@router.put("/settings", response_model=AppSettingsOut)
def update_signatory_settings(
    payload: AppSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(_admin),
) -> AppSettingsOut:
    if "certifier_id" in payload.model_fields_set:
        _set_setting(db, CERTIFIER_KEY, str(payload.certifier_id) if payload.certifier_id else None)
    if "issuer_id" in payload.model_fields_set:
        _set_setting(db, ISSUER_KEY, str(payload.issuer_id) if payload.issuer_id else None)
    if "region" in payload.model_fields_set:
        _set_setting(db, REGION_KEY, payload.region)

    # Rebuild stored transaction slips so the archive reflects the new
    # header/signatories instead of whatever was in effect at creation time.
    from app.services import report_files
    report_files.regenerate_all_reports(db)

    return get_signatory_settings(db)


# ── signatories CRUD ─────────────────────────────────────────────────────────

@router.get("/", response_model=list[SignatoryOut])
def list_signatories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Signatory]:
    return (
        db.query(Signatory)
        .filter(Signatory.is_active == True)  # noqa: E712
        .order_by(Signatory.full_name)
        .all()
    )


@router.post("/", response_model=SignatoryOut, status_code=status.HTTP_201_CREATED)
def create_signatory(
    payload: SignatoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(_admin),
) -> Signatory:
    s = Signatory(
        full_name=payload.full_name,
        designation=payload.designation,
        unit=payload.unit,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/{signatory_id}", response_model=SignatoryOut)
def update_signatory(
    signatory_id: uuid.UUID,
    payload: SignatoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(_admin),
) -> Signatory:
    s = db.query(Signatory).filter(Signatory.id == signatory_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Signatory not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(s, field, val)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{signatory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_signatory(
    signatory_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(_admin),
) -> None:
    s = db.query(Signatory).filter(Signatory.id == signatory_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Signatory not found")
    s.is_active = False
    # Clear from settings if selected
    for key in (CERTIFIER_KEY, ISSUER_KEY):
        if _get_setting(db, key) == str(signatory_id):
            _set_setting(db, key, None)
    db.commit()


