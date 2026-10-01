from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsSetPagination(PageNumberPagination):
    """
    Pagination class chuẩn cho toàn bộ hệ thống API:
    - page_size: 10 bản ghi / trang mặc định
    - page_size_query_param: Cho phép client tùy chỉnh số lượng qua ?page_size=X
    - max_page_size: Tối đa 50 bản ghi / trang
    - Hỗ trợ ?no_page=true hoặc ?page_size=all để lấy toàn bộ dữ liệu cho Dropdown / Export
    """
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 50

    def paginate_queryset(self, queryset, request, view=None):
        # Giữ nguyên cấu trúc cũ nếu request yêu cầu không phân trang (dành cho dropdown / select)
        if request.query_params.get('no_page') == 'true' or request.query_params.get('page_size') == 'all':
            return None
        return super().paginate_queryset(queryset, request, view=view)

    def get_paginated_response(self, data):
        return Response({
            'success': True,
            'count': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'page_size': self.get_page_size(self.request),
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data
        })
