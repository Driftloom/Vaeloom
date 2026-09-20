"""Enterprise Transactional Email Service.

Supports:
1. Resend API (via RESEND_API_KEY)
2. Standard SMTP (via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD)
3. Local Dev / Test fallback (logs email payload cleanly to logger and audit trail)
"""

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import os
import smtplib
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self):
        self.resend_api_key = os.environ.get("RESEND_API_KEY")
        self.smtp_host = os.environ.get("SMTP_HOST")
        self.smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        self.smtp_user = os.environ.get("SMTP_USER")
        self.smtp_password = os.environ.get("SMTP_PASSWORD")
        self.sender_email = os.environ.get("SENDER_EMAIL", "invites@vaeloom.app")

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send an email using Resend, SMTP, or Dev/Mock fallback."""
        text_body = text_body or html_body

        # 1. Resend API
        if self.resend_api_key:
            try:
                import httpx

                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={
                            "Authorization": f"Bearer {self.resend_api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "from": self.sender_email,
                            "to": [to_email],
                            "subject": subject,
                            "html": html_body,
                            "text": text_body,
                        },
                    )
                    if resp.is_success:
                        data = resp.json()
                        logger.info("Email dispatched via Resend: to=%s id=%s", to_email, data.get("id"))
                        return {"success": True, "provider": "resend", "id": data.get("id")}
                    else:
                        logger.warning("Resend dispatch failed (%d): %s", resp.status_code, resp.text)
            except Exception as exc:
                logger.warning("Error dispatching email via Resend: %s", exc)

        # 2. SMTP
        if self.smtp_host and self.smtp_user and self.smtp_password:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = self.sender_email
                msg["To"] = to_email
                msg.attach(MIMEText(text_body, "plain"))
                msg.attach(MIMEText(html_body, "html"))

                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                    server.starttls()
                    server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.sender_email, [to_email], msg.as_string())

                logger.info("Email dispatched via SMTP: to=%s host=%s", to_email, self.smtp_host)
                return {"success": True, "provider": "smtp"}
            except Exception as exc:
                logger.warning("Error dispatching email via SMTP: %s", exc)

        # 3. Dev / Mock Fallback
        logger.info(
            "DEVELOPMENT EMAIL DISPATCHED (Mock Fallback):\n"
            "  To: %s\n"
            "  Subject: %s\n"
            "  Body Preview: %s\n",
            to_email,
            subject,
            text_body[:200],
        )
        return {"success": True, "provider": "mock", "delivered": False, "simulated": True}

    async def send_organization_invitation(
        self,
        to_email: str,
        organization_name: str,
        inviter_name: str,
        invite_url: str,
        role: str = "member",
        expires_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Dispatch a branded organization invitation email."""
        subject = f"You're invited to join {organization_name} on Vaeloom"

        html_body = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background: #ffffff; color: #111827; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #111827;">Join {organization_name}</h2>
                <p style="margin: 0; font-size: 14px; color: #4b5563;">
                    <strong>{inviter_name}</strong> has invited you to collaborate as a <strong>{role}</strong> in <strong>{organization_name}</strong> on Vaeloom.
                </p>
            </div>
            <div style="margin: 32px 0;">
                <a href="{invite_url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 12px 24px; border-radius: 6px;">
                    Accept Invitation
                </a>
            </div>
            <div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                <p style="margin: 0 0 8px 0;">
                    Or copy and paste this link in your browser:<br/>
                    <a href="{invite_url}" style="color: #2563eb; word-break: break-all;">{invite_url}</a>
                </p>
                <p style="margin: 0;">This invitation will expire in 7 days.</p>
            </div>
        </div>
        """

        text_body = (
            f"Join {organization_name} on Vaeloom\n\n"
            f"{inviter_name} has invited you to collaborate as a {role} in {organization_name}.\n\n"
            f"Accept your invitation here:\n{invite_url}\n\n"
            f"This invitation will expire in 7 days."
        )

        return await self.send_email(to_email, subject, html_body, text_body)


email_service = EmailService()
