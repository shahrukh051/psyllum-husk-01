# =============================================================
# backend/services/email_service.py
# Async email via aiosmtplib — sends HTML emails
# Gracefully disabled when SMTP credentials are not configured
# =============================================================

from __future__ import annotations
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib
from jinja2 import Environment, DictLoader

from backend.config import get_settings

log = logging.getLogger(__name__)

# ── Jinja2 HTML templates ─────────────────────────────────────

ORDER_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f2ee;margin:0;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
    <div style="background:#1a2e1e;padding:32px 40px;">
      <h1 style="color:#e8c092;margin:0;font-size:22px;font-weight:600;letter-spacing:.5px;">Husk &amp; Co.</h1>
      <p style="color:#aacfb8;margin:8px 0 0;font-size:13px;">Pure Botanical Wellness</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="color:#3a5a42;font-size:15px;margin-top:0;">Hi <strong>{{ customer_name }}</strong>,</p>
      <p style="color:#555;font-size:15px;line-height:1.6;">
        Thank you for your order! We've received it and will confirm dispatch within 24 hours.
      </p>
      <div style="background:#f9f7f4;border-radius:8px;padding:20px 24px;margin:24px 0;">
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#8fac9b;font-weight:600;">Order ID</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#1a2e1e;font-family:monospace;">{{ order_id }}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr style="border-bottom:2px solid #e8e0d4;">
            <th style="text-align:left;padding:8px 0;font-size:12px;color:#8fac9b;text-transform:uppercase;letter-spacing:.8px;">Product</th>
            <th style="text-align:center;padding:8px 0;font-size:12px;color:#8fac9b;text-transform:uppercase;letter-spacing:.8px;">Qty</th>
            <th style="text-align:right;padding:8px 0;font-size:12px;color:#8fac9b;text-transform:uppercase;letter-spacing:.8px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          {% for item in items %}
          <tr style="border-bottom:1px solid #f0ece6;">
            <td style="padding:12px 0;font-size:14px;color:#333;">{{ item.name }}</td>
            <td style="padding:12px 0;font-size:14px;color:#333;text-align:center;">× {{ item.qty }}</td>
            <td style="padding:12px 0;font-size:14px;color:#333;text-align:right;">₹{{ "{:,}".format(item.line_total) }}</td>
          </tr>
          {% endfor %}
        </tbody>
      </table>
      <div style="text-align:right;">
        <p style="margin:4px 0;font-size:13px;color:#888;">Subtotal: ₹{{ "{:,}".format(subtotal) }}</p>
        <p style="margin:4px 0;font-size:13px;color:#888;">Shipping: {% if shipping == 0 %}Free 🎉{% else %}₹{{ shipping }}{% endif %}</p>
        <p style="margin:12px 0 0;font-size:17px;font-weight:700;color:#1a2e1e;">Total: ₹{{ "{:,}".format(grand_total) }}</p>
      </div>
      <p style="color:#888;font-size:13px;line-height:1.6;margin-top:28px;">
        Delivery typically takes <strong>3–7 business days</strong>. We'll send you a tracking link once your order ships.
      </p>
    </div>
    <div style="background:#f9f7f4;padding:20px 40px;border-top:1px solid #e8e0d4;">
      <p style="color:#aaa;font-size:12px;margin:0;text-align:center;">
        © 2026 Husk &amp; Co. Botanical Wellness · <a href="#" style="color:#8fac9b;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>
"""

CONTACT_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f5f2ee;margin:0;padding:40px 0;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
    <div style="background:#1a2e1e;padding:32px 40px;">
      <h1 style="color:#e8c092;margin:0;font-size:22px;">Husk &amp; Co.</h1>
    </div>
    <div style="padding:36px 40px;">
      <p style="color:#3a5a42;font-size:15px;margin-top:0;">Hi <strong>{{ name }}</strong>,</p>
      <p style="color:#555;font-size:15px;line-height:1.6;">
        Thanks for getting in touch! We've received your message and will get back to you within <strong>24 hours</strong>.
      </p>
      <div style="background:#f9f7f4;border-radius:8px;padding:20px 24px;margin:20px 0;border-left:4px solid #8fac9b;">
        <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#8fac9b;">Your message</p>
        <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">{{ message }}</p>
      </div>
    </div>
    <div style="background:#f9f7f4;padding:20px 40px;border-top:1px solid #e8e0d4;">
      <p style="color:#aaa;font-size:12px;margin:0;text-align:center;">© 2026 Husk &amp; Co. Botanical Wellness</p>
    </div>
  </div>
</body>
</html>
"""

_jinja = Environment(loader=DictLoader({
    "order":   ORDER_TEMPLATE,
    "contact": CONTACT_TEMPLATE,
}))


async def send_order_confirmation(
    to_email: str,
    customer_name: str,
    order_id: str,
    items: list[dict],
    subtotal: int,
    shipping: int,
    grand_total: int,
) -> None:
    settings = get_settings()
    if not settings.email_enabled:
        log.info("Email not configured — skipping order confirmation to %s", to_email)
        return

    html = _jinja.get_template("order").render(
        customer_name=customer_name,
        order_id=order_id,
        items=items,
        subtotal=subtotal,
        shipping=shipping,
        grand_total=grand_total,
    )
    await _send(to_email, f"Your Husk & Co. order {order_id}", html)


async def send_contact_acknowledgement(to_email: str, name: str, message: str) -> None:
    settings = get_settings()
    if not settings.email_enabled:
        log.info("Email not configured — skipping contact ack to %s", to_email)
        return

    html = _jinja.get_template("contact").render(name=name, message=message or "")
    await _send(to_email, "We received your message — Husk & Co.", html)


async def _send(to: str, subject: str, html: str) -> None:
    settings = get_settings()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.email_from
    msg["To"]      = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            start_tls=True,
        )
        log.info("Email sent to %s: %s", to, subject)
    except Exception as exc:
        # Never crash the request because email failed
        log.error("Failed to send email to %s: %s", to, exc)
