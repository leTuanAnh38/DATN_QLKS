from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from ..models import HotelSetting
from ...users.models import log_action
from ..serializers import HotelSettingSerializer


class HotelSettingView(APIView):
    """
    API endpoint: /api/hotel-settings/ hoặc /api/bookings/hotel-settings/
    - GET (Public): Lấy thông tin cấu hình khách sạn & vận hành (Singleton).
    - PUT / PATCH (Admin/Owner): Cập nhật thông tin khách sạn, giờ check-in/out, mức phụ thu và thuế phí.
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        config = HotelSetting.get_solo()
        serializer = HotelSettingSerializer(config)
        return Response({
            "success": True,
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def put(self, request):
        if not (request.user.is_superuser or getattr(request.user, 'role', None) in ['admin', 'owner']):
            return Response({
                "success": False,
                "message": "Bạn không có quyền chỉnh sửa cấu hình hệ thống khách sạn."
            }, status=status.HTTP_403_FORBIDDEN)

        config = HotelSetting.get_solo()
        serializer = HotelSettingSerializer(config, data=request.data, partial=False)
        if serializer.is_valid():
            cfg = serializer.save()
            log_action(
                user=request.user,
                action='UPDATE',
                module='SYSTEM',
                description=f"Cập nhật cài đặt hệ thống khách sạn: {cfg.hotel_name}",
                request=request
            )
            return Response({
                "success": True,
                "message": "Cập nhật cài đặt hệ thống thành công!",
                "data": serializer.data
            }, status=status.HTTP_200_OK)
        return Response({
            "success": False,
            "message": "Dữ liệu cấu hình không hợp lệ.",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        if not (request.user.is_superuser or getattr(request.user, 'role', None) in ['admin', 'owner']):
            return Response({
                "success": False,
                "message": "Bạn không có quyền chỉnh sửa cấu hình hệ thống khách sạn."
            }, status=status.HTTP_403_FORBIDDEN)

        config = HotelSetting.get_solo()
        serializer = HotelSettingSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            cfg = serializer.save()
            log_action(
                user=request.user,
                action='UPDATE',
                module='SYSTEM',
                description=f"Cập nhật một phần cài đặt hệ thống khách sạn: {cfg.hotel_name}",
                request=request
            )
            return Response({
                "success": True,
                "message": "Cập nhật cài đặt hệ thống thành công!",
                "data": serializer.data
            }, status=status.HTTP_200_OK)
        return Response({
            "success": False,
            "message": "Dữ liệu cấu hình không hợp lệ.",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
