"""Endpoint chatbot và xác nhận hành động 2 bước."""
import os
import re
import time
import logging
import requests
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework import status


logger = logging.getLogger(__name__)
from ..models import Booking, ChatbotInteractionLog
from ...services.models import ServiceItem, ServiceRequest
from ...contacts.models import ContactMessage
from ...notifications.models import Notification
from ...users.models import User
from .context_builder import build_hotel_context, build_active_stay_details, estimate_booking_price
from .text_utils import detect_language, phones_match
from .response_parsers import extract_booking_tracker, extract_suggestions, evaluate_booking_cancel_context
from .nlp_parser import extract_dates_from_conversation, extract_guest_count
from .prompt_builder import generate_system_prompt
from .inhouse_requests import (
    INHOUSE_BOOKING_ROLES,
    handle_inhouse_housekeeping_request,
    handle_inhouse_maintenance_request,
    detect_inhouse_pending_action,
    handle_lost_and_found_inquiry,
)
from .fallback_rules import local_smart_fallback


MAX_MESSAGE_LENGTH = 1500
MAX_HISTORY_TURNS = 8
MAX_HISTORY_TEXT_LENGTH = 1000


def _mask_pii_for_log(text):
    """Che số điện thoại trước khi lưu nhật ký chatbot cho Admin xem."""
    if not text:
        return ''
    masked = re.sub(r'(?<!\d)(?:\+?84|0)[\s.\-]?[35789](?:[\s.\-]?\d){8}(?!\d)', '[SĐT]', str(text))
    return masked.strip()[:480]


def _classify_chatbot_intent(
    message,
    hotel_context,
    maintenance_action=None,
    housekeeping_action=None,
    lost_found_action=None,
    pending_action=None,
    cancel_eligibility=None,
    price_estimate=None,
    tracked_bookings=None,
    suggested_rooms=None,
    suggested_services=None,
):
    """Phân loại chủ đề câu hỏi & hành động tự động để thống kê trên Admin Analytics."""
    msg_low = (message or '').strip().lower()

    if maintenance_action:
        act = 'maintenance_auth_required' if maintenance_action.get('requires_auth') else 'maintenance'
        return 'maintenance', act
    if housekeeping_action:
        act = 'housekeeping_auth_required' if housekeeping_action.get('requires_auth') else 'housekeeping'
        return 'housekeeping', act
    if lost_found_action:
        act = 'lost_found_auth_required' if lost_found_action.get('requires_auth') else 'lost_found'
        return 'lost_and_found', act
    if pending_action:
        p_type = pending_action.get('type')
        if p_type == 'human_handoff':
            return 'human_handoff', 'handoff_prompt'
        if p_type in ('create_service_request', 'create_service_request_auth_required'):
            return 'service_order', 'service_order_prompt'
    if cancel_eligibility:
        return 'cancel_policy', 'cancel_check'
    if price_estimate:
        return 'price_estimate', 'price_estimate'
    if tracked_bookings or hotel_context.get('lookup_verification_hint'):
        return 'booking_lookup', 'booking_lookup' if tracked_bookings else ''
    if hotel_context.get('queried_promo'):
        return 'promo_check', 'promo_check'
    if any(k in msg_low for k in ['hóa đơn tạm tính', 'tạm tính', 'minibar', 'folio', 'my bill', 'đơn đồ ăn', '정산서', '账单']):
        return 'inhouse_folio', ''
    if any(k in msg_low for k in ['chính sách hủy', 'hủy phòng', 'hoàn tiền', 'check-in sớm', 'trả phòng muộn', 'cancellation', '취소', '取消']):
        return 'cancel_policy', ''
    if any(k in msg_low for k in ['khuyến mãi', 'voucher', 'ưu đãi', 'giảm giá', 'thành viên', 'vip', 'promo', '할인', '优惠']):
        return 'promo_check', ''
    if any(k in msg_low for k in ['du lịch', 'cầu rồng', 'bà nà', 'hội an', 'sơn trà', 'ngũ hành sơn', 'tour', 'travel']):
        return 'travel_guide', ''
    if suggested_rooms:
        return 'room_inquiry', ''
    if suggested_services:
        return 'service_inquiry', ''
    return 'general', ''


def _record_chatbot_log(
    request,
    detected_lang,
    intent_category,
    response_source,
    action_triggered,
    user_message,
    bot_reply='',
    latency_ms=0,
):
    """Ghi log tương tác vào DB một cách an toàn (không làm gián đoạn luồng chat nếu lỗi)."""
    try:
        user = getattr(request, 'user', None)
        is_auth = bool(user and user.is_authenticated)
        ChatbotInteractionLog.objects.create(
            user=user if is_auth else None,
            detected_lang=str(detected_lang or 'vi')[:10],
            intent_category=str(intent_category or 'general')[:40],
            response_source=str(response_source or 'local_smart_fallback')[:40],
            action_triggered=str(action_triggered or '')[:50],
            user_message=_mask_pii_for_log(user_message),
            bot_reply_preview=_mask_pii_for_log(bot_reply),
            latency_ms=max(0, int(latency_ms or 0)),
            is_authenticated_user=is_auth,
        )
    except Exception as e:
        logger.warning(f"Lỗi ghi ChatbotInteractionLog: {e}")


class ChatbotAnonThrottle(AnonRateThrottle):
    """Giới hạn tần suất gọi chatbot cho khách vãng lai theo IP."""
    scope = 'chatbot_anon'


class ChatbotUserThrottle(UserRateThrottle):
    """Giới hạn tần suất gọi chatbot cho tài khoản đã đăng nhập."""
    scope = 'chatbot_user'

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return super().get_cache_key(request, view)


class ChatbotAskView(APIView):
    """
    API POST /api/chatbot/ask/
    - Nhận message, history và lang (tùy chọn) từ khách hàng.
    - Bóc tách ngày nhận/trả phòng và số lượng khách từ câu hỏi tự nhiên (Date-Aware Availability).
    - Hỗ trợ đầy đủ nghiệp vụ In-House Concierge cho khách đang lưu trú (CHECKED_IN) có xác thực.
    - Gọi Google Gemini REST API với timeout tối ưu (6s) và tự động chuyển sang Smart Fallback đa ngôn ngữ khi lỗi.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ChatbotAnonThrottle, ChatbotUserThrottle]

    def post(self, request, *args, **kwargs):
        start_ts = time.perf_counter()
        message = str(request.data.get('message') or '').strip()
        history = request.data.get('history', [])
        preferred_lang = request.data.get('lang')

        if not message:
            return Response(
                {'error': 'Vui lòng cung cấp nội dung tin nhắn (message).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(message) > MAX_MESSAGE_LENGTH:
            return Response(
                {'error': f'Nội dung tin nhắn tối đa {MAX_MESSAGE_LENGTH} ký tự.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sanitized_history = []
        if isinstance(history, list):
            for item in history[-MAX_HISTORY_TURNS:]:
                if not isinstance(item, dict):
                    continue
                role = item.get('role', 'user')
                text_content = str(item.get('text') or item.get('content') or '').strip()
                if text_content:
                    sanitized_history.append({
                        'role': role,
                        'text': text_content[:MAX_HISTORY_TEXT_LENGTH]
                    })

        # 0. Tự động nhận diện ngôn ngữ, khoảng ngày & số lượng khách
        detected_lang = detect_language(message, preferred_lang=preferred_lang)
        date_info = extract_dates_from_conversation(message, history=sanitized_history)
        guest_count = extract_guest_count(message, history=sanitized_history)

        # 1. Thu thập ngữ cảnh Database thời gian thực theo đúng ngày & số khách
        hotel_context = build_hotel_context(
            request, date_info=date_info, lang=detected_lang, guest_count=guest_count, message=message
        )
        maintenance_action = handle_inhouse_maintenance_request(message, request, history=sanitized_history)
        housekeeping_action = None if maintenance_action else handle_inhouse_housekeeping_request(
            message, request, hotel_context, history=sanitized_history
        )
        lost_found_action = None if (maintenance_action or housekeeping_action) else handle_lost_and_found_inquiry(
            message, request, history=sanitized_history
        )
        pending_action = None if (maintenance_action or housekeeping_action or lost_found_action) else detect_inhouse_pending_action(
            message, request, hotel_context, lang=detected_lang, history=sanitized_history
        )
        suggested_rooms, suggested_services = extract_suggestions(
            message, hotel_context, lang=detected_lang, history=sanitized_history
        )
        tracked_bookings = extract_booking_tracker(
            message, request, hotel_context, lang=detected_lang, history=sanitized_history
        )
        cancel_eligibility = evaluate_booking_cancel_context(
            message, request, tracked_bookings=tracked_bookings
        )
        price_estimate = estimate_booking_price(
            message, hotel_context, lang=detected_lang, history=sanitized_history
        )
        system_prompt = generate_system_prompt(
            hotel_context,
            housekeeping_action=housekeeping_action,
            maintenance_action=maintenance_action,
            pending_action=pending_action,
            lost_found_action=lost_found_action,
            cancel_eligibility=cancel_eligibility,
            price_estimate=price_estimate,
        )

        active_stay_summary = None
        if hotel_context.get('user_context') and hotel_context['user_context'].get('active_stay'):
            st = hotel_context['user_context']['active_stay']
            active_stay_summary = {
                'booking_code': st['booking_code'],
                'room_number': st['room_number'],
                'category_name': st['category_name'],
                'is_checked_in': st['is_checked_in'],
                'grand_total_formatted': st['grand_total_formatted']
            }

        # Nếu tìm thấy đơn đặt phòng/đoàn đã xác thực, bổ sung vào system prompt cho AI
        if tracked_bookings:
            bk = tracked_bookings[0]
            system_prompt += (
                f"\n\n[DỮ LIỆU ĐƠN ĐẶT PHÒNG KHÁCH VỪA TRA CỨU ĐÃ XÁC THỰC]:\n"
                f"- Mã đơn: #{bk['booking_code']} | Khách hàng/Trưởng đoàn: {bk['guest_name']} (SĐT: {bk['guest_phone']})\n"
                f"- Phòng/Đoàn: {bk['room_category']} ({bk['room_name']}) | Lưu trú: {bk['check_in_date']} đến {bk['check_out_date']}\n"
                f"- Tổng tiền: {bk['total_amount']} | Trạng thái: {bk['status_label']} (Bước {bk['step_index']}/4)\n"
                f"Hãy phản hồi đầy đủ thông tin này một cách ân cần, sang trọng."
            )
            if not active_stay_summary and not bk.get('is_group') and str(bk.get('status', '')).lower() == 'checked_in':
                bk_obj = (
                    Booking.objects.filter(id=bk['id'])
                    .select_related('category', 'room', 'invoice', 'group_booking', 'applied_promotion')
                    .prefetch_related('extra_services', 'service_requests__service', 'service_requests__assigned_staff', 'payments')
                    .first()
                )
                if bk_obj:
                    st = build_active_stay_details(bk_obj, lang=detected_lang)
                    if st:
                        active_stay_summary = {
                            'booking_code': st['booking_code'],
                            'room_number': st['room_number'],
                            'category_name': st['category_name'],
                            'is_checked_in': st['is_checked_in'],
                            'grand_total_formatted': st['grand_total_formatted']
                        }
                        system_prompt += (
                            f"\n- Hóa đơn tạm tính thời gian thực (Provisional Folio): "
                            f"Tiền phòng {st['room_total_formatted']} | Phụ phí/Minibar {st['extra_total_formatted']} | "
                            f"Dịch vụ gọi thêm {st['service_total_formatted']} | Tổng cộng {st['grand_total_formatted']} | "
                            f"Đã thanh toán {st.get('paid_total_formatted', '0 đ')} | Còn lại {st['unpaid_additional_formatted']}."
                        )

        base_meta = {
            'detected_lang': detected_lang,
            'queried_dates': {
                'check_in': date_info['check_in_str'],
                'check_out': date_info['check_out_str'],
                'check_in_display': date_info['check_in_display'],
                'check_out_display': date_info['check_out_display'],
                'nights': date_info['nights'],
                'is_custom_date': date_info['is_custom_date']
            },
            'active_stay': active_stay_summary,
            'housekeeping_triggered': bool(housekeeping_action and not housekeeping_action.get('requires_auth')),
            'maintenance_ticket': (
                {
                    'ticket_code': maintenance_action.get('ticket_code'),
                    'equipment_name': maintenance_action.get('equipment_name'),
                    'room_number': maintenance_action.get('room_number'),
                    'priority': maintenance_action.get('priority'),
                }
                if maintenance_action and not maintenance_action.get('requires_auth')
                else None
            ),
            'pending_action': (
                pending_action
                if pending_action and pending_action.get('type') in ('create_service_request', 'human_handoff')
                else None
            ),
            'lost_found_info': (
                {
                    'booking_code': lost_found_action.get('booking_code'),
                    'room_number': lost_found_action.get('room_number'),
                    'matched_items': lost_found_action.get('matched_items', []),
                    'staff_notified': lost_found_action.get('staff_notified', False),
                }
                if lost_found_action and not lost_found_action.get('requires_auth')
                else None
            ),
            'cancel_eligibility': cancel_eligibility,
            'price_estimate': price_estimate,
            'lookup_verification_required': bool(hotel_context.get('lookup_verification_hint')),
            'suggested_rooms': suggested_rooms,
            'suggested_services': suggested_services,
            'tracked_bookings': tracked_bookings
        }

        fallback_kwargs = {
            'tracked_bookings': tracked_bookings,
            'lang': detected_lang,
            'history': sanitized_history,
            'housekeeping_action': housekeeping_action,
            'maintenance_action': maintenance_action,
            'pending_action': pending_action,
            'lost_found_action': lost_found_action,
            'cancel_eligibility': cancel_eligibility,
            'price_estimate': price_estimate,
        }

        intent_category, action_triggered = _classify_chatbot_intent(
            message,
            hotel_context,
            maintenance_action=maintenance_action,
            housekeeping_action=housekeeping_action,
            lost_found_action=lost_found_action,
            pending_action=pending_action,
            cancel_eligibility=cancel_eligibility,
            price_estimate=price_estimate,
            tracked_bookings=tracked_bookings,
            suggested_rooms=suggested_rooms,
            suggested_services=suggested_services,
        )

        def _build_logged_response(reply_text, source):
            elapsed_ms = int((time.perf_counter() - start_ts) * 1000)
            _record_chatbot_log(
                request,
                detected_lang=detected_lang,
                intent_category=intent_category,
                response_source=source,
                action_triggered=action_triggered,
                user_message=message,
                bot_reply=reply_text,
                latency_ms=elapsed_ms,
            )
            return Response({'success': True, 'reply': reply_text, 'source': source, **base_meta})

        # 2. Kiểm tra Gemini API Key
        if hasattr(settings, 'GEMINI_API_KEY'):
            gemini_api_key = str(getattr(settings, 'GEMINI_API_KEY', '') or '').strip()
        else:
            gemini_api_key = os.getenv('GEMINI_API_KEY', '').strip()

        is_key_valid = (
            gemini_api_key and
            'your_gemini_api_key' not in gemini_api_key.lower() and
            'your_api_key' not in gemini_api_key.lower()
        )

        if not is_key_valid:
            fallback_reply = local_smart_fallback(
                message, request.user, hotel_context, **fallback_kwargs
            )
            return _build_logged_response(fallback_reply, 'local_smart_fallback')

        # 3. Chuẩn bị nội dung gửi Gemini REST API
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}"

        contents = []
        for item in sanitized_history:
            gemini_role = 'model' if item['role'] in ['model', 'assistant', 'bot'] else 'user'
            contents.append({
                'role': gemini_role,
                'parts': [{'text': item['text']}]
            })

        contents.append({
            'role': 'user',
            'parts': [{'text': message}]
        })

        payload = {
            'system_instruction': {
                'parts': [{'text': system_prompt}]
            },
            'contents': contents,
            'generationConfig': {
                'temperature': 0.65,
                'maxOutputTokens': 1100
            }
        }

        try:
            headers = {'Content-Type': 'application/json'}
            response = requests.post(
                gemini_url,
                json=payload,
                headers=headers,
                timeout=12
            )

            if response.status_code == 200:
                res_data = response.json()
                candidates = res_data.get('candidates', [])
                if candidates and 'content' in candidates[0]:
                    parts = candidates[0]['content'].get('parts', [])
                    if parts and 'text' in parts[0]:
                        reply_text = parts[0]['text'].strip()
                        return _build_logged_response(reply_text, 'gemini_ai')

            logger.warning(f"Gemini API phản hồi mã lỗi {response.status_code}: {response.text[:200]}")
            if response.status_code in [404, 400]:
                alt_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_api_key}"
                alt_resp = requests.post(alt_url, json=payload, headers=headers, timeout=8)
                if alt_resp.status_code == 200:
                    alt_data = alt_resp.json()
                    alt_cand = alt_data.get('candidates', [])
                    if alt_cand and 'content' in alt_cand[0]:
                        alt_parts = alt_cand[0]['content'].get('parts', [])
                        if alt_parts and 'text' in alt_parts[0]:
                            return _build_logged_response(alt_parts[0]['text'].strip(), 'gemini_ai_fallback_model')

        except Exception as ex:
            logger.error(f"Lỗi kết nối Gemini API: {ex}")

        # 4. Khi gặp sự cố, tự động kích hoạt Local Smart Fallback (có Multi-turn Memory)
        fallback_reply = local_smart_fallback(
            message, request.user, hotel_context, **fallback_kwargs
        )
        return _build_logged_response(fallback_reply, 'local_smart_fallback')


class ChatbotActionConfirmView(APIView):
    """
    API POST /api/chatbot/confirm-action/
    Xác nhận thực thi hành động 2 bước từ AI Concierge:
    - `create_service_request`: Tạo ServiceRequest cho phòng đang lưu trú (`checked_in`) có kiểm tra quyền sở hữu.
    - `human_handoff`: Tạo ContactMessage + Notification gửi Lễ tân & Quản lý.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ChatbotAnonThrottle, ChatbotUserThrottle]

    def post(self, request, *args, **kwargs):
        data = request.data or {}
        action_type = str(data.get('action_type') or data.get('type') or '').strip()

        if action_type == 'create_service_request':
            return self._confirm_service_request(request, data)
        if action_type == 'human_handoff':
            return self._confirm_human_handoff(request, data)
        return Response(
            {'success': False, 'message': 'Hành động xác nhận không hợp lệ.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    def _confirm_service_request(self, request, data):
        booking_id = data.get('booking_id')
        booking_code = str(data.get('booking_code') or '').strip().upper()
        phone_number = str(data.get('phone_number') or '').strip()
        service_id = data.get('service_id')
        note = str(data.get('note') or '').strip()[:200]

        try:
            quantity = int(data.get('quantity', 1))
        except (TypeError, ValueError):
            quantity = 1
        if quantity < 1 or quantity > 20:
            return Response(
                {'success': False, 'message': 'Số lượng dịch vụ phải từ 1 đến 20.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking = None
        if booking_id and str(booking_id).isdigit():
            booking = Booking.objects.filter(pk=int(booking_id)).select_related('room', 'guest').first()
        if not booking and booking_code:
            booking = Booking.objects.filter(booking_code=booking_code).select_related('room', 'guest').first()
        if not booking:
            return Response({'success': False, 'message': 'Không tìm thấy đơn đặt phòng.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_authorized = False
        if user and user.is_authenticated:
            is_staff = user.is_superuser or getattr(user, 'role', '') in INHOUSE_BOOKING_ROLES
            user_email = (user.email or '').strip()
            is_owner = (booking.guest_id == user.id) or (user_email and booking.guest and booking.guest.email == user_email)
            is_authorized = bool(is_staff or is_owner)
        elif booking_code and phone_number and booking.guest:
            is_authorized = (
                booking.booking_code.upper() == booking_code
                and phones_match(getattr(booking.guest, 'phone_number', ''), phone_number)
            )

        if not is_authorized:
            return Response(
                {'success': False, 'message': 'Quý khách cần đăng nhập hoặc xác thực đúng Mã đơn + SĐT để đặt dịch vụ phòng.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if booking.status != 'checked_in' or not booking.room:
            return Response(
                {'success': False, 'message': 'Chỉ có thể đặt dịch vụ tại phòng khi đơn đang ở trạng thái Đang lưu trú (Checked-in).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        service_item = ServiceItem.objects.filter(pk=service_id, is_active=True).first()
        if not service_item:
            return Response({'success': False, 'message': 'Dịch vụ không tồn tại hoặc đã ngừng phục vụ.'}, status=status.HTTP_404_NOT_FOUND)

        sr = ServiceRequest.objects.create(
            booking=booking,
            service=service_item,
            quantity=quantity,
            unit_price=service_item.price,
            total_price=service_item.price * quantity,
            status='pending',
            note=f"[AI Concierge] {note}" if note else "[AI Concierge] Đặt qua trợ lý ảo",
            request_time=timezone.now(),
        )
        _record_chatbot_log(
            request,
            detected_lang=detect_language(note),
            intent_category='service_order',
            response_source='confirm_action',
            action_triggered='service_order_confirmed',
            user_message=f"[Xác nhận dịch vụ] {quantity}x {service_item.name} (#{booking.booking_code})",
            bot_reply=f"Đã tạo ServiceRequest #{sr.id}",
        )
        return Response({
            'success': True,
            'request_id': sr.id,
            'service_name': service_item.name,
            'quantity': quantity,
            'total_price': int(sr.total_price),
            'room_number': booking.room.room_number,
            'booking_code': booking.booking_code,
            'message': f'Đã xác nhận đặt {quantity}x {service_item.name} cho Phòng {booking.room.room_number} thành công!'
        }, status=status.HTTP_201_CREATED)

    def _confirm_human_handoff(self, request, data):
        user = request.user
        is_auth = bool(user and user.is_authenticated)
        name = str(data.get('name') or (user.get_full_name() or user.username if is_auth else '')).strip()[:120]
        email = str(data.get('email') or (getattr(user, 'email', '') if is_auth else '')).strip()[:120]
        subject = str(data.get('subject') or '[AI Concierge Handoff] Yêu cầu hỗ trợ trực tiếp').strip()[:200]
        msg_body = str(data.get('message') or '').strip()[:1500]
        excerpt_raw = data.get('conversation_excerpt')

        if not name or not email or '@' not in email or not msg_body:
            return Response(
                {'success': False, 'message': 'Vui lòng cung cấp đầy đủ Họ tên, Email và Nội dung cần hỗ trợ.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        excerpt_str = ''
        if isinstance(excerpt_raw, list):
            lines = []
            for turn in excerpt_raw[-6:]:
                if not isinstance(turn, dict):
                    continue
                who = 'Khách' if turn.get('role') == 'user' else 'AI'
                txt = str(turn.get('text') or '').strip().replace('\n', ' ')[:180]
                if txt:
                    lines.append(f"- {who}: {txt}")
            if lines:
                excerpt_str = "\n".join(lines)[:1000]
        elif isinstance(excerpt_raw, str) and excerpt_raw.strip():
            excerpt_str = excerpt_raw.strip()[:1000]

        full_contact_message = msg_body
        if excerpt_str:
            full_contact_message = f"{msg_body}\n\n--- Ngữ cảnh hội thoại AI trước đó ---\n{excerpt_str}"

        contact = ContactMessage.objects.create(
            name=name,
            email=email,
            subject=subject,
            message=full_contact_message,
        )
        _record_chatbot_log(
            request,
            detected_lang=detect_language(msg_body),
            intent_category='human_handoff',
            response_source='confirm_action',
            action_triggered='handoff_confirmed',
            user_message=f"[Xác nhận Handoff] {msg_body[:300]}",
            bot_reply=f"Đã tạo ContactMessage #{contact.id}",
        )
        try:
            staff_users = User.objects.filter(
                Q(role__in=['receptionist', 'manager', 'admin']) | Q(is_superuser=True)
            ).distinct()
            Notification.objects.bulk_create([
                Notification(
                    recipient=u,
                    title=f"[AI Handoff] Yêu cầu hỗ trợ từ {name}",
                    message=f"{subject}: {msg_body[:250]}",
                    notification_type='system',
                    action_url='/admin/contacts',
                    priority='high'
                )
                for u in staff_users
            ])
        except Exception as e:
            logger.warning(f"Lỗi gửi notification handoff: {e}")

        return Response({
            'success': True,
            'contact_id': contact.id,
            'message': 'Đã chuyển yêu cầu của Quý khách tới Lễ tân & Quản lý trực ca. Nhân viên sẽ phản hồi trong ít phút!'
        }, status=status.HTTP_201_CREATED)
