import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from ...services import send_checkin_checkout_reminders


class Command(BaseCommand):
    help = 'Send automated Check-in and Check-out reminders to Guests and Hotel Staff'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=str,
            help='Target date (YYYY-MM-DD), default is today',
            default=None
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force sending reminders even if already sent today',
            default=False
        )

    def handle(self, *args, **options):
        target_date_str = options.get('date')
        force = options.get('force', False)

        if target_date_str:
            try:
                target_date = datetime.datetime.strptime(target_date_str, '%Y-%m-%d').date()
            except ValueError:
                self.stderr.write(self.style.ERROR(f"Dinh dang ngay khong hop le: {target_date_str}. Vui long dung YYYY-MM-DD."))
                return
        else:
            target_date = timezone.localdate()

        self.stdout.write(self.style.NOTICE(f"Dang quet don Check-in / Check-out ngay: {target_date} (force={force})..."))

        res = send_checkin_checkout_reminders(target_date=target_date, force=force)

        self.stdout.write(self.style.SUCCESS(
            f"Hoan tat quet thong bao ngay {res['date']}:\n"
            f"- So don Check-in: {res['checkin_bookings_count']}\n"
            f"- So don Check-out: {res['checkout_bookings_count']}\n"
            f"- Thong bao Check-in gui toi khach: {res['guest_checkin_sent']}\n"
            f"- Thong bao Check-in gui toi nhan vien: {res['staff_checkin_sent']}\n"
            f"- Thong bao Check-out gui toi khach: {res['guest_checkout_sent']}\n"
            f"- Thong bao Check-out gui toi nhan vien: {res['staff_checkout_sent']}\n"
            f"=> Tong so thong bao moi: {res['total_notifications_created']}"
        ))
