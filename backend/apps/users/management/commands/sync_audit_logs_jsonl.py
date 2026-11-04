import os
import json
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from ...models import AuditLog


class Command(BaseCommand):
    help = 'Đồng bộ toàn bộ hoặc các bản ghi nhật ký hoạt động (AuditLog) mới từ cơ sở dữ liệu ra file JSONL trên máy chủ.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='Ghi đè lại toàn bộ file JSONL từ đầu (xuất toàn bộ database).',
            default=False
        )

    def handle(self, *args, **options):
        overwrite = options.get('overwrite', False)
        log_file = getattr(
            settings,
            'AUDIT_LOG_FILE',
            os.path.join(getattr(settings, 'BASE_DIR', ''), 'logs', 'audit_logs.jsonl')
        )
        os.makedirs(os.path.dirname(str(log_file)), exist_ok=True)

        existing_ids = set()
        mode = 'a'

        if overwrite:
            mode = 'w'
            self.stdout.write(self.style.WARNING(f"Đang ghi đè toàn bộ file: {log_file} ..."))
            queryset = AuditLog.objects.all().select_related('user').order_by('id')
        else:
            if os.path.exists(log_file):
                # Đọc các ID đã có để tránh ghi trùng
                try:
                    with open(log_file, 'r', encoding='utf-8') as f:
                        for line in f:
                            line_str = line.strip()
                            if line_str:
                                try:
                                    entry = json.loads(line_str)
                                    if 'id' in entry:
                                        existing_ids.add(entry['id'])
                                except json.JSONDecodeError:
                                    continue
                except Exception as e:
                    self.stderr.write(self.style.WARNING(f"Không thể đọc file cũ ({e}), tiến hành đồng bộ bình thường."))

            max_id = max(existing_ids) if existing_ids else 0
            self.stdout.write(self.style.NOTICE(f"File hiện có {len(existing_ids)} bản ghi (ID cao nhất: {max_id}). Đang tìm bản ghi mới..."))
            queryset = AuditLog.objects.filter(id__gt=max_id).select_related('user').order_by('id')

        total_to_write = queryset.count()
        if total_to_write == 0:
            self.stdout.write(self.style.SUCCESS(f"File JSONL đã hoàn toàn đồng bộ với Database ({AuditLog.objects.count()} bản ghi). Không có bản ghi mới cần ghi!"))
            return

        self.stdout.write(self.style.NOTICE(f"Bắt đầu xuất {total_to_write} bản ghi vào '{log_file}'..."))

        count = 0
        with open(log_file, mode, encoding='utf-8') as f:
            for log_obj in queryset.iterator(chunk_size=500):
                user = getattr(log_obj, 'user', None)
                username = user.username if user else "Hệ thống"
                full_name = ""
                role = "SYSTEM"
                if user:
                    first = getattr(user, 'first_name', '') or ''
                    last = getattr(user, 'last_name', '') or ''
                    full_name = f"{last} {first}".strip() or user.username
                    role = (getattr(user, 'role', '') or 'STAFF').upper()

                if getattr(log_obj, 'created_at', None):
                    created_dt = timezone.localtime(log_obj.created_at) if timezone.is_aware(log_obj.created_at) else log_obj.created_at
                    created_str = created_dt.strftime('%Y-%m-%d %H:%M:%S')
                else:
                    created_str = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %H:%M:%S')

                log_data = {
                    "id": log_obj.id,
                    "timestamp": created_str,
                    "user_id": user.id if user else None,
                    "username": username,
                    "full_name": full_name,
                    "role": role,
                    "action": log_obj.action,
                    "module": log_obj.module,
                    "description": log_obj.description,
                    "ip_address": log_obj.ip_address or ""
                }
                f.write(json.dumps(log_data, ensure_ascii=False) + '\n')
                count += 1

        self.stdout.write(self.style.SUCCESS(f"Thành công! Đã ghi {count} bản ghi vào file: {log_file}"))
