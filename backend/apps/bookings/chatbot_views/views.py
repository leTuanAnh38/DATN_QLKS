"""Endpoint chatbot."""
import os
import logging
import requests
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status


logger = logging.getLogger(__name__)
from .context_builder import build_hotel_context
from .text_utils import detect_language
from .response_parsers import extract_booking_tracker, extract_suggestions
from .nlp_parser import extract_dates_from_conversation
from .prompt_builder import generate_system_prompt
from .inhouse_requests import handle_inhouse_housekeeping_request
from .fallback_rules import local_smart_fallback


class ChatbotAskView(APIView):
    """
    API POST /api/chatbot/ask/
    - Nhận message và history từ khách hàng.
    - Bóc tách ngày nhận/trả phòng từ câu hỏi tự nhiên để kiểm tra lịch trống thực tế (Date-Aware Availability).
    - Hỗ trợ đầy đủ nghiệp vụ In-House Concierge cho khách đang lưu trú (CHECKED_IN).
    - Gọi Google Gemini REST API với timeout tối ưu (6s) và tự động chuyển sang Smart Fallback đa ngôn ngữ khi lỗi.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        message = request.data.get('message', '').strip()
        history = request.data.get('history', [])

        if not message:
            return Response(
                {'error': 'Vui lòng cung cấp nội dung tin nhắn (message).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 0. Tự động nhận diện ngôn ngữ và trích xuất khoảng ngày khách quan tâm
        detected_lang = detect_language(message)
        date_info = extract_dates_from_conversation(message, history=history)

        # 1. Thu thập ngữ cảnh Database thời gian thực theo đúng ngày khách hỏi
        hotel_context = build_hotel_context(request, date_info=date_info, lang=detected_lang)
        housekeeping_action = handle_inhouse_housekeeping_request(message, request, hotel_context)
        system_prompt = generate_system_prompt(hotel_context, housekeeping_action=housekeeping_action)
        suggested_rooms, suggested_services = extract_suggestions(message, hotel_context, lang=detected_lang, history=history)
        tracked_bookings = extract_booking_tracker(message, request, hotel_context, lang=detected_lang)

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

        # Nếu tìm thấy đơn đặt phòng tra cứu, bổ sung vào system prompt cho AI
        if tracked_bookings:
            bk = tracked_bookings[0]
            system_prompt += (
                f"\n\n[DỮ LIỆU ĐƠN ĐẶT PHÒNG KHÁCH VỪA TRA CỨU]:\n"
                f"- Mã đơn: #{bk['booking_code']} | Khách hàng: {bk['guest_name']} (SĐT: {bk['guest_phone']})\n"
                f"- Phòng: {bk['room_name']} | Lưu trú: {bk['check_in_date']} đến {bk['check_out_date']}\n"
                f"- Tổng tiền phòng: {bk['total_amount']} | Trạng thái: {bk['status_label']} (Bước {bk['step_index']}/4)\n"
                f"Hãy phản hồi đầy đủ thông tin này một cách ân cần, sang trọng chuẩn 5 sao."
            )

        # 2. Kiểm tra Gemini API Key
        gemini_api_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
        gemini_api_key = gemini_api_key.strip()

        is_key_valid = (
            gemini_api_key and
            'your_gemini_api_key' not in gemini_api_key.lower() and
            'your_api_key' not in gemini_api_key.lower()
        )

        if not is_key_valid:
            fallback_reply = local_smart_fallback(
                message, request.user, hotel_context,
                tracked_bookings=tracked_bookings, lang=detected_lang,
                history=history, housekeeping_action=housekeeping_action
            )
            return Response({
                'success': True,
                'reply': fallback_reply,
                'source': 'local_smart_fallback',
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
                'housekeeping_triggered': bool(housekeeping_action),
                'suggested_rooms': suggested_rooms,
                'suggested_services': suggested_services,
                'tracked_bookings': tracked_bookings
            })

        # 3. Chuẩn bị nội dung gửi Gemini REST API (nhớ tối đa 8 tin nhắn gần nhất)
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}"

        contents = []
        if isinstance(history, list):
            for item in history[-8:]:
                if not isinstance(item, dict):
                    continue
                role = item.get('role', 'user')
                gemini_role = 'model' if role in ['model', 'assistant', 'bot'] else 'user'
                text_content = item.get('text', '') or item.get('content', '') or ''
                if text_content.strip():
                    contents.append({
                        'role': gemini_role,
                        'parts': [{'text': text_content.strip()}]
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
                timeout=6
            )

            if response.status_code == 200:
                res_data = response.json()
                candidates = res_data.get('candidates', [])
                if candidates and 'content' in candidates[0]:
                    parts = candidates[0]['content'].get('parts', [])
                    if parts and 'text' in parts[0]:
                        reply_text = parts[0]['text'].strip()
                        return Response({
                            'success': True,
                            'reply': reply_text,
                            'source': 'gemini_ai',
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
                            'housekeeping_triggered': bool(housekeeping_action),
                            'suggested_rooms': suggested_rooms,
                            'suggested_services': suggested_services,
                            'tracked_bookings': tracked_bookings
                        })

            logger.warning(f"Gemini API phản hồi mã lỗi {response.status_code}: {response.text[:200]}")
            if response.status_code in [404, 400]:
                alt_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_api_key}"
                alt_resp = requests.post(alt_url, json=payload, headers=headers, timeout=5)
                if alt_resp.status_code == 200:
                    alt_data = alt_resp.json()
                    alt_cand = alt_data.get('candidates', [])
                    if alt_cand and 'content' in alt_cand[0]:
                        alt_parts = alt_cand[0]['content'].get('parts', [])
                        if alt_parts and 'text' in alt_parts[0]:
                            return Response({
                                'success': True,
                                'reply': alt_parts[0]['text'].strip(),
                                'source': 'gemini_ai_fallback_model',
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
                                'housekeeping_triggered': bool(housekeeping_action),
                                'suggested_rooms': suggested_rooms,
                                'suggested_services': suggested_services,
                                'tracked_bookings': tracked_bookings
                            })

        except Exception as ex:
            logger.error(f"Lỗi kết nối Gemini API: {ex}")

        # 4. Khi gặp sự cố, tự động kích hoạt Local Smart Fallback (có Multi-turn Memory)
        fallback_reply = local_smart_fallback(
            message, request.user, hotel_context,
            tracked_bookings=tracked_bookings, lang=detected_lang,
            history=history, housekeeping_action=housekeeping_action
        )
        return Response({
            'success': True,
            'reply': fallback_reply,
            'source': 'local_smart_fallback',
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
            'housekeeping_triggered': bool(housekeeping_action),
            'suggested_rooms': suggested_rooms,
            'suggested_services': suggested_services,
            'tracked_bookings': tracked_bookings
        })
