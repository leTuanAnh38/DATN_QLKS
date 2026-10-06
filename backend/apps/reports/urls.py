from django.urls import path
from .views import ReportsAnalyticsView

urlpatterns = [
    path('', ReportsAnalyticsView.as_view(), name='reports-analytics'),
]
