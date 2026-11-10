"""Kiểm tra cấu hình email."""
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _is_email_configured():
    """
    Kiểm tra xem thông tin EMAIL_HOST_USER và EMAIL_HOST_PASSWORD trong .env đã được cấu hình thật hay chưa.
    Tránh timeout hoặc lỗi kết nối SMTP khi đang dùng giá trị mẫu.
    """
    user = getattr(settings, 'EMAIL_HOST_USER', '') or ''
    pwd = getattr(settings, 'EMAIL_HOST_PASSWORD', '') or ''
    
    user = str(user).strip()
    pwd = str(pwd).strip()

    if not user or not pwd:
        return False
    
    # Kiểm tra các giá trị placeholder mẫu
    if user in ['your_email@gmail.com', 'example@gmail.com', '']:
        return False
    if pwd in ['xxxx xxxx xxxx xxxx', 'xxxx-xxxx-xxxx-xxxx', '']:
        return False
    if 'xxxx' in pwd.lower():
        return False

    return True
