"""Kiểm tra cấu hình và gửi email qua HTTPS API (Brevo/Resend) hoặc SMTP fallback."""
import json
import logging
import os
import urllib.error
import urllib.request
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)


def _is_email_configured():
    """
    Kiểm tra xem hệ thống đã cấu hình BREVO_API_KEY / RESEND_API_KEY
    hoặc thông tin SMTP (EMAIL_HOST_USER & EMAIL_HOST_PASSWORD) hợp lệ hay chưa.
    """
    if os.environ.get('BREVO_API_KEY', '').strip() or os.environ.get('RESEND_API_KEY', '').strip():
        return True

    user = str(getattr(settings, 'EMAIL_HOST_USER', '') or '').strip()
    pwd = str(getattr(settings, 'EMAIL_HOST_PASSWORD', '') or '').strip()

    if not user or not pwd:
        return False
    if user in ['your_email@gmail.com', 'example@gmail.com', '']:
        return False
    if pwd in ['xxxx xxxx xxxx xxxx', 'xxxx-xxxx-xxxx-xxxx', ''] or 'xxxx' in pwd.lower():
        return False

    return True


def _post_json(url, payload, headers, timeout=15):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode('utf-8', errors='ignore')


def send_email_message(subject, text_content, html_content, to_emails, cc_emails=None, sender_name='Khách Sạn TA Đà Nẵng'):
    """
    Gửi email ưu tiên qua HTTPS API (cổng 443, tránh bị Railway chặn SMTP):
    1. BREVO_API_KEY -> Brevo Transactional Email API
    2. RESEND_API_KEY -> Resend API
    3. Fallback -> Django SMTP (EmailMultiAlternatives)
    """
    to_list = [e.strip() for e in (to_emails or []) if e and str(e).strip()]
    cc_list = [e.strip() for e in (cc_emails or []) if e and str(e).strip()]
    if not to_list:
        return

    brevo_key = os.environ.get('BREVO_API_KEY', '').strip()
    if brevo_key:
        sender_email = (
            os.environ.get('BREVO_SENDER_EMAIL', '').strip()
            or str(getattr(settings, 'EMAIL_HOST_USER', '') or '').strip()
        )
        if not sender_email:
            raise ValueError("Thiếu BREVO_SENDER_EMAIL hoặc EMAIL_HOST_USER để gửi email qua Brevo.")
        payload = {
            'sender': {'name': sender_name, 'email': sender_email},
            'to': [{'email': e} for e in to_list],
            'subject': subject,
            'htmlContent': html_content,
            'textContent': text_content,
        }
        if cc_list:
            payload['cc'] = [{'email': e} for e in cc_list]
        _post_json(
            'https://api.brevo.com/v3/smtp/email',
            payload,
            headers={
                'accept': 'application/json',
                'content-type': 'application/json',
                'api-key': brevo_key,
            },
        )
        return

    resend_key = os.environ.get('RESEND_API_KEY', '').strip()
    if resend_key:
        sender_email = (
            os.environ.get('RESEND_FROM_EMAIL', '').strip()
            or getattr(settings, 'DEFAULT_FROM_EMAIL', None)
            or 'onboarding@resend.dev'
        )
        payload = {
            'from': sender_email,
            'to': to_list,
            'subject': subject,
            'html': html_content,
            'text': text_content,
        }
        if cc_list:
            payload['cc'] = cc_list
        _post_json(
            'https://api.resend.com/emails',
            payload,
            headers={
                'Authorization': f'Bearer {resend_key}',
                'Content-Type': 'application/json',
            },
        )
        return

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or f"{sender_name} <{settings.EMAIL_HOST_USER}>"
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=from_email,
        to=to_list,
        cc=cc_list or None,
    )
    msg.attach_alternative(html_content, "text/html")
    msg.send(fail_silently=False)
