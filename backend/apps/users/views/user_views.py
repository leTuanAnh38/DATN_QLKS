"""UserViewSet và hạng thành viên."""
import os
import logging

from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from core_project.pagination import StandardResultsSetPagination
from django.contrib.auth import get_user_model
from django.conf import settings

from ..models import MembershipTier
from ..serializers import UserSerializer

User = get_user_model()
logger = logging.getLogger(__name__)

ROLE_MATRIX_FILE = os.path.join(settings.BASE_DIR, 'role_matrix.json')
from .permissions import IsManagerOrAdmin


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet quản lý User có tích hợp StandardResultsSetPagination
    """
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action == 'retrieve':
            return [IsAuthenticated()]
        return [IsManagerOrAdmin()]


class MembershipTierListView(APIView):
    """
    API GET /api/users/membership-tiers/
    Lấy danh sách các Hạng thành viên và đặc quyền tương ứng.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from ..models import MembershipTier
        from ..serializers import MembershipTierSerializer
        tiers = MembershipTier.objects.all().order_by('order', 'min_points')
        serializer = MembershipTierSerializer(tiers, many=True)
        return Response({
            'success': True,
            'tiers': serializer.data
        }, status=status.HTTP_200_OK)
