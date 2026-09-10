# =============================================================
# backend/models.py — Pydantic v2 request/response models
# =============================================================

from __future__ import annotations
import re
from typing import Annotated
from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Shared ────────────────────────────────────────────────────

INDIAN_PHONE_RE = re.compile(r"^[6-9]\d{9}$")


# ── Order models ──────────────────────────────────────────────

class CartItem(BaseModel):
    id:  Annotated[str, Field(min_length=1, max_length=40)]
    qty: Annotated[int, Field(ge=1, le=50)]


class CustomerInfo(BaseModel):
    name:    Annotated[str, Field(min_length=1, max_length=120)]
    phone:   Annotated[str, Field(min_length=10, max_length=10)]
    email:   EmailStr | None = None
    address: Annotated[str | None, Field(default=None, max_length=500)]

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not INDIAN_PHONE_RE.match(v):
            raise ValueError("Invalid Indian mobile number (must start with 6–9 and be 10 digits)")
        return v


class OrderRequest(BaseModel):
    customer: CustomerInfo
    items:    Annotated[list[CartItem], Field(min_length=1, max_length=20)]


class OrderedItem(BaseModel):
    id:        str
    name:      str
    price:     int
    qty:       int
    line_total: int


class OrderResponse(BaseModel):
    success:           bool
    order_id:          str
    subtotal:          int
    shipping:          int
    grand_total:       int
    razorpay_order_id: str | None = None
    message:           str


# ── Contact models ────────────────────────────────────────────

class ContactRequest(BaseModel):
    name:    Annotated[str, Field(min_length=1, max_length=120)]
    email:   EmailStr
    subject: Annotated[str, Field(default="General Enquiry", max_length=200)]
    message: Annotated[str | None, Field(default=None, max_length=2000)]


class ContactResponse(BaseModel):
    success: bool
    message: str


# ── Health ────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:  str
    env:     str
    version: str = "2.0.0"
