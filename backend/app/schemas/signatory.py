import uuid
from datetime import datetime

from pydantic import BaseModel


class SignatoryCreate(BaseModel):
    full_name: str
    designation: str
    unit: str | None = None


class SignatoryUpdate(BaseModel):
    full_name: str | None = None
    designation: str | None = None
    unit: str | None = None
    is_active: bool | None = None


class SignatoryOut(BaseModel):
    id: uuid.UUID
    full_name: str
    designation: str
    unit: str | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AppSettingsOut(BaseModel):
    certifier_id: uuid.UUID | None = None
    issuer_id: uuid.UUID | None = None
    region: str | None = None


class AppSettingsUpdate(BaseModel):
    certifier_id: uuid.UUID | None = None
    issuer_id: uuid.UUID | None = None
    region: str | None = None
