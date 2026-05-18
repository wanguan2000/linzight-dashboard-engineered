from __future__ import annotations

import os
import smtplib
import ssl
from email.message import EmailMessage


def smtp_configured() -> bool:
    return bool(os.getenv("LINZIGHT_SMTP_HOST") and os.getenv("LINZIGHT_SMTP_USERNAME") and os.getenv("LINZIGHT_SMTP_PASSWORD"))


def send_email(to_email: str, subject: str, body: str) -> dict[str, str]:
    host = os.getenv("LINZIGHT_SMTP_HOST", "")
    username = os.getenv("LINZIGHT_SMTP_USERNAME", "")
    password = os.getenv("LINZIGHT_SMTP_PASSWORD", "")
    from_email = os.getenv("LINZIGHT_SMTP_FROM", username)
    port = int(os.getenv("LINZIGHT_SMTP_PORT", "465"))
    security = os.getenv("LINZIGHT_SMTP_SECURITY", "ssl").lower()

    if not host or not username or not password or not from_email:
        return {"status": "not_configured"}

    message = EmailMessage()
    message["From"] = from_email
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    if security == "starttls":
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(username, password)
            smtp.send_message(message)
    else:
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=15) as smtp:
            smtp.login(username, password)
            smtp.send_message(message)

    return {"status": "sent"}
