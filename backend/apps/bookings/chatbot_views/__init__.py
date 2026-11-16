"""Package chatbot_views. Re-export để giữ nguyên `from .chatbot_views import ...`."""
from .constants import DEFAULT_ROOM_IMAGES, DEFAULT_SERVICE_IMAGES
from .text_utils import format_currency, strip_html_tags, detect_language, format_currency_multilingual
from .nlp_parser import extract_dates_from_conversation, extract_guest_count, resolve_room_from_conversation
from .context_builder import (
    calculate_category_availability,
    build_active_stay_details,
    build_hotel_context,
    estimate_booking_price,
)
from .inhouse_requests import (
    handle_inhouse_housekeeping_request,
    handle_inhouse_maintenance_request,
    detect_inhouse_pending_action,
    handle_lost_and_found_inquiry,
)
from .prompt_builder import generate_system_prompt
from .fallback_rules import local_smart_fallback
from .response_parsers import extract_suggestions, extract_booking_tracker, evaluate_booking_cancel_context
from .views import ChatbotAskView, ChatbotActionConfirmView

__all__ = [
    "format_currency",
    "strip_html_tags",
    "detect_language",
    "format_currency_multilingual",
    "extract_dates_from_conversation",
    "extract_guest_count",
    "calculate_category_availability",
    "build_active_stay_details",
    "build_hotel_context",
    "estimate_booking_price",
    "handle_inhouse_housekeeping_request",
    "handle_inhouse_maintenance_request",
    "detect_inhouse_pending_action",
    "handle_lost_and_found_inquiry",
    "resolve_room_from_conversation",
    "generate_system_prompt",
    "local_smart_fallback",
    "DEFAULT_ROOM_IMAGES",
    "DEFAULT_SERVICE_IMAGES",
    "extract_suggestions",
    "extract_booking_tracker",
    "evaluate_booking_cancel_context",
    "ChatbotAskView",
    "ChatbotActionConfirmView",
]
