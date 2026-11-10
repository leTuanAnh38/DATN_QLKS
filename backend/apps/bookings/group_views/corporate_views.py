"""Đối tác doanh nghiệp và mã công ty."""
from django.db.models import Q, Sum
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action

from ..models import CorporatePartner
from ...users.models import log_action
from ...users.views import check_role_permission
from ..serializers import GroupBookingSerializer, CorporatePartnerSerializer
from core_project.pagination import StandardResultsSetPagination


class ValidateCorporateCodeView(APIView):
    """
    API xác thực Mã Doanh Nghiệp (Corporate Code) dành cho Khách hàng / Công ty đặt qua Website:
    - POST /api/bookings/validate-corporate-code/
    Payload: { "code": "FPT2026" }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        raw_code = request.data.get('code') or request.data.get('corporate_code')
        if not raw_code:
            return Response({
                'success': False,
                'message': 'Vui lòng nhập Mã doanh nghiệp đối tác.'
            }, status=status.HTTP_400_BAD_REQUEST)

        code_clean = str(raw_code).strip().upper()
        partner = CorporatePartner.objects.filter(corporate_code__iexact=code_clean, is_active=True).first()

        if not partner:
            return Response({
                'success': False,
                'message': f'Mã doanh nghiệp "{code_clean}" không tồn tại hoặc đã hết hiệu lực.'
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'success': True,
            'message': f'Áp dụng thành công ưu đãi Doanh nghiệp: {partner.company_name}',
            'partner': {
                'id': partner.id,
                'company_name': partner.company_name,
                'tax_code': partner.tax_code,
                'company_address': partner.company_address,
                'corporate_code': partner.corporate_code,
                'discount_percent': float(partner.discount_percent),
                'contact_person': partner.contact_person,
                'contact_email': partner.contact_email,
                'payment_terms_days': partner.payment_terms_days
            }
        }, status=status.HTTP_200_OK)


class CorporatePartnerViewSet(viewsets.ModelViewSet):
    """
    API Quản lý Danh bạ Khách hàng Doanh nghiệp / Đối tác B2B:
    - GET /api/bookings/corporate-partners/ : Danh sách đối tác
    - POST /api/bookings/corporate-partners/ : Thêm đối tác mới
    - GET /api/bookings/corporate-partners/<id>/ : Chi tiết đối tác
    - PUT/PATCH /api/bookings/corporate-partners/<id>/ : Cập nhật đối tác
    - DELETE /api/bookings/corporate-partners/<id>/ : Xóa đối tác
    - POST /api/bookings/corporate-partners/<id>/toggle-status/ : Bật/Tắt hoạt động
    """
    serializer_class = CorporatePartnerSerializer
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'bookings']:
            return [AllowAny()]
        return [IsAuthenticated()]

    def check_permissions(self, request):
        super().check_permissions(request)
        user = request.user

        # 1. Thao tác ghi / xóa: Yêu cầu quyền tương ứng qua check_role_permission RBAC
        if self.action == 'create':
            if not check_role_permission(user, 'corporate_partners', 'create'):
                self.permission_denied(
                    request,
                    message="Bạn không có quyền tạo mới hồ sơ Đối tác Doanh nghiệp (B2B)."
                )
        elif self.action in ['update', 'partial_update', 'toggle_status']:
            if not check_role_permission(user, 'corporate_partners', 'update'):
                self.permission_denied(
                    request,
                    message="Bạn không có quyền chỉnh sửa thông tin Đối tác Doanh nghiệp (B2B)."
                )
        elif self.action == 'destroy':
            if not check_role_permission(user, 'corporate_partners', 'delete'):
                self.permission_denied(
                    request,
                    message="Bạn không có quyền xóa hồ sơ Đối tác Doanh nghiệp (B2B)."
                )
        elif self.action in ['list', 'retrieve', 'bookings']:
            # Nếu người dùng đã đăng nhập (nhân viên/quản trị), kiểm tra quyền xem (read)
            if user and user.is_authenticated and not check_role_permission(user, 'corporate_partners', 'read'):
                self.permission_denied(
                    request,
                    message="Bạn không có quyền xem danh sách Đối tác Doanh nghiệp (B2B)."
                )

    def get_queryset(self):
        qs = CorporatePartner.objects.prefetch_related('group_bookings').all().order_by('-created_at')
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(company_name__icontains=search) |
                Q(tax_code__icontains=search) |
                Q(corporate_code__icontains=search) |
                Q(contact_person__icontains=search) |
                Q(contact_phone__icontains=search)
            )
        active_only = self.request.query_params.get('active_only')
        if active_only in ['true', '1', True]:
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        partner = serializer.save()
        log_action(user, 'CREATE', 'BOOKING', f"Thêm đối tác Doanh nghiệp: {partner.company_name} (#{partner.corporate_code})", request=self.request)

    def perform_update(self, serializer):
        user = self.request.user
        partner = serializer.save()
        log_action(user, 'UPDATE', 'BOOKING', f"Cập nhật đối tác Doanh nghiệp: {partner.company_name} (#{partner.corporate_code})", request=self.request)

    def destroy(self, request, *args, **kwargs):
        partner = self.get_object()
        if partner.group_bookings.exists():
            return Response({
                'success': False,
                'message': 'Không thể xóa đối tác đã phát sinh đơn đặt đoàn hoặc đơn đặt phòng. Vui lòng chuyển trạng thái sang Tạm ngưng để bảo toàn lịch sử hóa đơn!'
            }, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        partner_name = partner.company_name
        partner_code = partner.corporate_code
        self.perform_destroy(partner)
        log_action(user, 'DELETE', 'BOOKING', f"Đã xóa đối tác Doanh nghiệp: {partner_name} (#{partner_code})", request=request)
        return Response({
            'success': True,
            'message': f"Đã xóa đối tác {partner_name} thành công."
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        partner = self.get_object()
        partner.is_active = not partner.is_active
        partner.save(update_fields=['is_active', 'updated_at'])
        status_text = "kích hoạt" if partner.is_active else "tạm ngưng"
        log_action(request.user, 'UPDATE', 'BOOKING', f"Đã {status_text} đối tác Doanh nghiệp: {partner.company_name} (#{partner.corporate_code})", request=request)
        return Response({
            'success': True,
            'message': f"Đã {status_text} đối tác thành công.",
            'is_active': partner.is_active,
            'data': CorporatePartnerSerializer(partner).data
        })

    @action(detail=True, methods=['get'], url_path='bookings')
    def bookings(self, request, pk=None):
        """
        Lấy toàn bộ lịch sử đơn đặt đoàn thuộc về Đối tác Doanh nghiệp này.
        GET /api/bookings/corporate-partners/<id>/bookings/
        """
        partner = self.get_object()
        group_bookings = partner.group_bookings.prefetch_related(
            'sub_bookings', 'sub_bookings__room', 'sub_bookings__category', 'sub_bookings__guests'
        ).all().order_by('-created_at')

        status_param = request.query_params.get('status')
        if status_param and status_param != 'all':
            if status_param == 'completed':
                group_bookings = group_bookings.filter(status__in=['completed', 'checked_out'])
            else:
                group_bookings = group_bookings.filter(status=status_param)

        serializer = GroupBookingSerializer(group_bookings, many=True)
        total_spent = partner.group_bookings.exclude(status='cancelled').aggregate(total=Sum('total_amount'))['total'] or 0

        return Response({
            'success': True,
            'partner': {
                'id': partner.id,
                'company_name': partner.company_name,
                'corporate_code': partner.corporate_code,
                'discount_percent': float(partner.discount_percent),
                'total_spent': float(total_spent)
            },
            'total_bookings': group_bookings.count(),
            'data': serializer.data
        })
