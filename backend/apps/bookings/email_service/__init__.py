"""Package email_service. Re-export để giữ nguyên `from .email_service import ...`."""
from .config import _is_email_configured
from .booking_template import render_booking_email_html
from .booking_sender import _send_booking_email_worker, send_booking_email_async
from .group_template import render_group_booking_email_html
from .group_sender import _send_group_booking_email_worker, send_group_booking_email_async

__all__ = [
    "_is_email_configured",
    "render_booking_email_html",
    "_send_booking_email_worker",
    "send_booking_email_async",
    "render_group_booking_email_html",
    "_send_group_booking_email_worker",
    "send_group_booking_email_async",
]
