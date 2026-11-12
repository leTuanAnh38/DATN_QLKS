import re
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from ..models import HotelSetting
from ...users.models import log_action
from ..serializers import HotelSettingSerializer


def normalize_hotel_slogan(slogan, stars):
    if not slogan:
        return f"{stars}-Star Luxury Resort & Hotel"
    s = re.sub(r'\b\d+[- ]*(?:Star|star)\b', f"{stars}-Star", slogan)
    s = re.sub(r'\b\d+[- ]*(?:Sao|sao)\b', f"{stars} Sao", s)
    return s


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
        if config.stars and config.hotel_slogan:
            normalized = normalize_hotel_slogan(config.hotel_slogan, config.stars)
            if normalized != config.hotel_slogan:
                config.hotel_slogan = normalized
                try:
                    config.save(update_fields=['hotel_slogan'])
                except Exception:
                    pass
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
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        stars = data.get('stars', config.stars)
        if 'hotel_slogan' in data and stars:
            data['hotel_slogan'] = normalize_hotel_slogan(data['hotel_slogan'], stars)

        serializer = HotelSettingSerializer(config, data=data, partial=False)
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
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        stars = data.get('stars', config.stars)
        if 'hotel_slogan' in data and stars:
            data['hotel_slogan'] = normalize_hotel_slogan(data['hotel_slogan'], stars)

        serializer = HotelSettingSerializer(config, data=data, partial=True)
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
