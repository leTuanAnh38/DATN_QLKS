"""Package views của users. Re-export để giữ nguyên `from .views import ...`."""
from .role_matrix import load_role_matrix, save_role_matrix, check_role_permission, get_all_roles_matrix
from .permissions import IsManagerOrAdmin, IsOwnerOrAdminOnly, IsFrontDeskOrManager, IsEmployeeManagementPermission
from .auth_views import RegisterView, LoginView, CurrentUserView, LogoutView, ChangePasswordView, ForgotPasswordView, ResetPasswordConfirmView
from .guest_views import AdminGuestListCreateView, AdminGuestDetailView
from .employee_views import AdminEmployeeListCreateView, AdminEmployeeDetailView
from .role_views import AdminRoleListView, AdminRolePermissionsView
from .audit_views import AuditLogViewSet
from .user_views import UserViewSet, MembershipTierListView

__all__ = [
    "load_role_matrix",
    "save_role_matrix",
    "check_role_permission",
    "IsManagerOrAdmin",
    "IsOwnerOrAdminOnly",
    "IsFrontDeskOrManager",
    "IsEmployeeManagementPermission",
    "RegisterView",
    "LoginView",
    "CurrentUserView",
    "LogoutView",
    "ChangePasswordView",
    "ForgotPasswordView",
    "ResetPasswordConfirmView",
    "AdminGuestListCreateView",
    "AdminGuestDetailView",
    "AdminEmployeeListCreateView",
    "AdminEmployeeDetailView",
    "get_all_roles_matrix",
    "AdminRoleListView",
    "AdminRolePermissionsView",
    "UserViewSet",
    "AuditLogViewSet",
    "MembershipTierListView",
]
