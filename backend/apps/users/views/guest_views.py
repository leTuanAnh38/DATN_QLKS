"""Quản lý khách hàng (admin)."""
import os
import logging
import re

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from core_project.pagination import StandardResultsSetPagination
from django.db.models import Q
from django.contrib.auth import get_user_model
from django.conf import settings

from ..models import log_action, MembershipTier
from ..serializers import RegisterSerializer, AdminGuestSerializer

User = get_user_model()
logger = logging.getLogger(__name__)

ROLE_MATRIX_FILE = os.path.join(settings.BASE_DIR, 'role_matrix.json')
from .permissions import IsFrontDeskOrManager


# =========================================================================
# PHÂN HỆ QUẢN TRỊ ADMIN: QUẢN LÝ KHÁCH HÀNG
# =========================================================================

class AdminGuestListCreateView(APIView):
    permission_classes = [IsFrontDeskOrManager]
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        queryset = User.objects.filter(role='guest').select_related('guest_profile').order_by('-date_joined')

        # Tìm kiếm theo từ khóa
        q = request.query_params.get('q', '').strip()
        if q:
            clean_q = re.sub(r'[\s\-\.]', '', q)
            search_filter = (
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(username__icontains=q) |
                Q(email__icontains=q) |
                Q(guest_profile__id_card_number__icontains=q)
            )
            if clean_q:
                search_filter |= Q(phone_number__icontains=clean_q)
            queryset = queryset.filter(search_filter)

        # Lọc theo hạng thành viên VIP
        vip_tier = request.query_params.get('vip_tier')
        if vip_tier and vip_tier != 'all':
            queryset = queryset.filter(guest_profile__vip_tier=vip_tier)

        # Lọc theo trạng thái hoạt động / Phân loại khách
        is_active = request.query_params.get('is_active') or request.query_params.get('status')
        if is_active is not None and is_active != 'all':
            val = str(is_active).strip().lower()
            walkin_q = Q(username__startswith='walkin_') | Q(email__endswith='.local') | Q(password__startswith='!')
            if val in ['true', '1', 'active']:
                queryset = queryset.filter(is_active=True).exclude(walkin_q)
            elif val == 'walkin':
                queryset = queryset.filter(walkin_q)
            elif val in ['false', '0', 'locked']:
                queryset = queryset.filter(is_active=False).exclude(walkin_q)

        # Tính toán thống kê trên toàn bộ tập dữ liệu (không bị giới hạn bởi phân trang)
        total_guests = queryset.count()
        active_guests = queryset.filter(is_active=True).count()
        diamond_guests = queryset.filter(
            Q(current_tier__name__icontains='Diamond') | Q(guest_profile__vip_tier__icontains='Diamond')
        ).count()
        gold_silver_guests = queryset.filter(
            Q(current_tier__name__icontains='Gold') | Q(guest_profile__vip_tier__icontains='Gold') |
            Q(current_tier__name__icontains='Silver') | Q(guest_profile__vip_tier__icontains='Silver') |
            Q(current_tier__name__icontains='Vàng') | Q(guest_profile__vip_tier__icontains='Vàng') |
            Q(current_tier__name__icontains='Bạc') | Q(guest_profile__vip_tier__icontains='Bạc')
        ).count()

        stats = {
            'total_guests': total_guests,
            'active_guests': active_guests,
            'diamond_guests': diamond_guests,
            'gold_silver_guests': gold_silver_guests,
        }

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = AdminGuestSerializer(page, many=True, context={'request': request})
            return Response({
                'success': True,
                'count': paginator.page.paginator.count,
                'total_pages': paginator.page.paginator.num_pages,
                'current_page': paginator.page.number,
                'page_size': paginator.get_page_size(request),
                'next': paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
                'results': serializer.data,
                'guests': serializer.data,
                'stats': stats,
            }, status=status.HTTP_200_OK)

        serializer = AdminGuestSerializer(queryset, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': queryset.count(),
            'results': serializer.data,
            'guests': serializer.data,
            'stats': stats,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Cập nhật thêm nếu có CCCD, VIP tier từ form admin
            profile = getattr(user, 'guest_profile', None)
            if profile:
                user_updated_fields = []
                if 'vip_tier' in request.data:
                    clean_tier = str(request.data['vip_tier']).strip()
                    tier_obj = MembershipTier.objects.filter(
                        Q(code__iexact=clean_tier) | Q(name__icontains=clean_tier)
                    ).first()
                    if tier_obj:
                        user.current_tier = tier_obj
                        profile.vip_tier = tier_obj.name
                    else:
                        profile.vip_tier = clean_tier
                    user_updated_fields.append('current_tier')
                if 'id_card_number' in request.data:
                    profile.id_card_number = request.data['id_card_number']
                if 'loyalty_points' in request.data:
                    pts = int(request.data.get('loyalty_points', 0))
                    profile.loyalty_points = pts
                    user.total_points = pts
                    user_updated_fields.append('total_points')
                if user_updated_fields:
                    user.save(update_fields=user_updated_fields)
                profile.save()

            log_action(
                user=request.user,
                action='CREATE',
                module='USER',
                description=f"Tạo hồ sơ khách hàng mới {user.username} ({user.get_full_name() or user.email})",
                request=request
            )

            return Response({
                'success': True,
                'message': 'Tạo tài khoản khách hàng mới thành công!',
                'guest': AdminGuestSerializer(user, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class AdminGuestDetailView(APIView):
    permission_classes = [IsFrontDeskOrManager]

    def get(self, request, pk):
        try:
            guest = User.objects.select_related('guest_profile').get(pk=pk)
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy thông tin khách hàng.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminGuestSerializer(guest, context={'request': request})
        data = dict(serializer.data)

        # Trích xuất CCCD nếu có từ guest_profile hoặc đơn đặt phòng
        id_card = ''
        if hasattr(guest, 'guest_profile') and guest.guest_profile and guest.guest_profile.id_card_number:
            id_card = guest.guest_profile.id_card_number
        else:
            try:
                from ...bookings.models import Booking
                latest_bk = Booking.objects.filter(guest=guest).exclude(identity_card='').order_by('-created_at').first()
                if latest_bk:
                    id_card = latest_bk.identity_card
            except Exception:
                pass
        data['id_card_number'] = id_card

        return Response({
            'success': True,
            'guest': data,
            'user': data,
            'customer': data,
            **data
        }, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        try:
            guest = User.objects.select_related('guest_profile').get(pk=pk, role='guest')
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy thông tin khách hàng.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminGuestSerializer(guest, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_guest = serializer.save()

            log_action(
                user=request.user,
                action='UPDATE',
                module='USER',
                description=f"Cập nhật hồ sơ khách hàng {updated_guest.username}",
                request=request
            )

            return Response({
                'success': True,
                'message': 'Cập nhật thông tin khách hàng thành công!',
                'guest': AdminGuestSerializer(updated_guest, context={'request': request}).data
            }, status=status.HTTP_200_OK)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not (request.user.is_superuser or getattr(request.user, 'role', '') in ['admin', 'owner', 'manager']):
            return Response({
                'success': False,
                'message': 'Chỉ Quản lý hoặc Quản trị viên mới có quyền xóa tài khoản khách hàng.'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            guest = User.objects.get(pk=pk, role='guest')
            guest_uname = guest.username
            guest.delete()

            log_action(
                user=request.user,
                action='DELETE',
                module='USER',
                description=f"Xóa tài khoản khách hàng {guest_uname}",
                request=request
            )

            return Response({'success': True, 'message': 'Đã xóa tài khoản khách hàng thành công.'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy khách hàng cần xóa.'}, status=status.HTTP_404_NOT_FOUND)
