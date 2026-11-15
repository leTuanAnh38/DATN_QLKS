"""
Module Chatbot AI đã được tổ chức lại tại `apps.bookings.chatbot_views`.
File này giữ lại re-export để tương thích nếu có script cũ import.
"""
from apps.bookings.chatbot_views import (
    ChatbotAskView,
    build_hotel_context,
    generate_system_prompt,
    local_smart_fallback,
)

__all__ = [
    'ChatbotAskView',
    'build_hotel_context',
    'generate_system_prompt',
    'local_smart_fallback',
]
