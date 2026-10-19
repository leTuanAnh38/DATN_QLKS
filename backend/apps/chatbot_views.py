# Re-export from apps.bookings.chatbot_views
from apps.bookings.chatbot_views import (
    build_hotel_context,
    generate_system_prompt,
    local_smart_fallback,
    ChatbotAskView,
)

__all__ = [
    'build_hotel_context',
    'generate_system_prompt',
    'local_smart_fallback',
    'ChatbotAskView',
]
