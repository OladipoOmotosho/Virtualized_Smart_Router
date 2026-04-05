"""smtplib helper for sending IPS anomaly alert emails.

Note: send_alert() is a blocking/synchronous function.
Callers in async code should use ``asyncio.to_thread(send_alert, ...)``.
"""

import logging
import smtplib
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def send_alert(device_ip: str, measured_rate: float, threshold: float) -> None:
    """Send an IPS anomaly alert email to the configured admin recipient.

    Does not raise — logs errors instead so a failed email never crashes the IPS loop.
    """
    subject = f"[IPS Alert] Anomaly detected on {device_ip}"
    body = (
        f"Device {device_ip} exceeded its traffic threshold.\n\n"
        f"  Measured rate : {measured_rate:.2f} KB/s\n"
        f"  Threshold     : {threshold:.2f} KB/s\n\n"
        "The device has been temporarily restricted. "
        "Review the dashboard for details."
    )

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = settings.smtp_user
    msg["To"] = settings.alert_recipient

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        logger.info("IPS alert email sent for device %s", device_ip)
    except Exception:
        logger.exception("Failed to send IPS alert email for device %s", device_ip)
