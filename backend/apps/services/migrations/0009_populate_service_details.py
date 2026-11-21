# Generated manually to populate duration and ingredients for all existing ServiceItem records

from django.db import migrations


SERVICE_DETAILS_BY_NAME = {
    'bò wagyu úc nướng than hoa sốt tiêu rừng': {
        'duration': 'Chế biến 25 - 30 phút • 1 - 2 khách',
        'ingredients': (
            'Thăn ngoại bò Wagyu Úc vân mỡ cẩm thạch (250g)\n'
            'Rau củ hữu cơ Đà Lạt nướng bơ tỏi (măng tây, cà chua bi, khoai tây)\n'
            'Sốt tiêu rừng Tây Nguyên nấu chậm đậm vị\n'
            'Muối hồng Himalaya & thảo mộc hương thảo tươi'
        ),
    },
    'súp tôm hùm nha trang saffron': {
        'duration': 'Chế biến 20 phút • 1 phần',
        'ingredients': (
            'Thịt tôm hùm bông Nha Trang tươi sống\n'
            'Nhụy hoa nghệ tây Iran (Saffron) thượng hạng\n'
            'Nước dùng vỏ tôm ninh chậm 8 giờ cùng kem tươi Pháp\n'
            'Bánh mì nướng bơ tỏi giòn tan dùng kèm'
        ),
    },
    'phở bò bắp hoa thố đá hoàng gia': {
        'duration': 'Chế biến 15 - 20 phút • 1 phần',
        'ingredients': (
            'Nước dùng xương ống bò ninh 24 giờ cùng hoa hồi, quế chi, thảo quả\n'
            'Thịt bắp bò hoa thái mỏng & gầu bò mềm ngọt\n'
            'Bánh phở tươi truyền thống giữ nóng trong thố đá\n'
            'Rau thơm tươi, giá đỗ, chanh ớt & tương ớt thủ công'
        ),
    },
    'mỳ ý tôm hùm bisque sốt cà chua rừng': {
        'duration': 'Chế biến 20 - 25 phút • 1 phần',
        'ingredients': (
            'Mỳ Tagliolini tươi cán thủ công chuẩn Ý\n'
            'Thịt tôm hùm áp chảo bơ tỏi thơm ngậy\n'
            'Sốt Bisque hải sản hòa quyện cà chua rừng Địa Trung Hải\n'
            'Phô mai Parmigiano-Reggiano bào sợi & lá húng quế tươi'
        ),
    },
    'cơm chiên hải sản hoàng kim tổ chim': {
        'duration': 'Chế biến 15 - 20 phút • 1 - 2 khách',
        'ingredients': (
            'Gạo ST25 hạt dài tơi dẻo phủ trứng gà vàng ươm\n'
            'Tôm sú biển Đà Nẵng, mực ống tươi & sò điệp áp chảo\n'
            'Trứng muối bùi béo & đậu Hà Lan, bắp ngọt\n'
            'Giỏ khoai môn chiên giòn tạo hình tổ chim & nước tương ớt xắt'
        ),
    },
    'cua hoàng đế alaska hấp vang trắng': {
        'duration': 'Chế biến 30 - 40 phút • 2 - 4 khách',
        'ingredients': (
            'Cua Hoàng Đế Alaska tươi sống tuyển chọn nguyên con\n'
            'Rượu vang trắng Pháp, sả, gừng & thảo mộc thơm\n'
            '3 loại sốt chấm đặc biệt: Muối ớt xanh Đà Nẵng, bơ chanh tỏi, sốt me cay\n'
            'Dụng cụ tách vỏ chuyên dụng & khăn ấm lau tay hương sả'
        ),
    },
    'set trà chiều hoàng gia royal high tea': {
        'duration': 'Phục vụ trong 20 phút • Dành cho 2 khách',
        'ingredients': (
            'Khay 3 tầng gồm bánh Scone nướng nóng kèm kem Clotted Cream & mứt dâu\n'
            'Bánh Tart trái cây nhiệt đới & bánh ngọt Pastry thủ công\n'
            'Finger Sandwich cá hồi xông khói, trứng & dưa leo\n'
            '1 ấm trà Bá Tước Earl Grey thượng hạng (kèm sữa tươi & chanh vàng)'
        ),
    },
    'cocktail đà nẵng sunset signature': {
        'duration': 'Pha chế 10 - 15 phút • 1 ly (250ml)',
        'ingredients': (
            'Rượu Gin thảo mộc tuyển chọn\n'
            'Siro hoa dâm bụt đỏ tự nhiên & nước ép dứa tươi Đà Nẵng\n'
            'Rượu vang nổ sâm panh dịu nhẹ\n'
            'Trang trí lát cam sấy, lá bạc hà tươi & đá tinh khiết'
        ),
    },
    'nước ép dưa hấu & chanh leo nhiệt đới': {
        'duration': 'Pha chế 10 phút • 1 ly (350ml)',
        'ingredients': (
            '100% dưa hấu đỏ chín ngọt ép lạnh tươi mới\n'
            'Nước cốt chanh leo tươi giàu Vitamin C\n'
            'Không đường phụ gia, không chất bảo quản\n'
            'Phục vụ kèm lá bạc hà tươi & mật ong rừng riêng (tùy chọn)'
        ),
    },
    'cà phê trứng béo ngậy cung đình': {
        'duration': 'Pha chế 10 - 15 phút • 1 tách (180ml)',
        'ingredients': (
            'Cà phê Robusta rang mộc Tây Nguyên pha phin đậm đà\n'
            'Lớp kem lòng đỏ trứng gà ta đánh bông mịn với mật ong & sữa đặc\n'
            'Phủ bột cacao nguyên chất thơm dịu\n'
            'Phục vụ nóng trong chén giữ nhiệt truyền thống'
        ),
    },
    'vang đỏ bordeaux grand cru (ly)': {
        'duration': 'Phục vụ 10 phút • 1 ly tiêu chuẩn (150ml)',
        'ingredients': (
            'Rượu vang đỏ nhập khẩu vùng Bordeaux Grand Cru (Pháp)\n'
            'Phối trộn giống nho Cabernet Sauvignon & Merlot ủ thùng gỗ sồi\n'
            'Ướp chuẩn nhiệt độ thưởng thức 16 - 18°C\n'
            'Phục vụ kèm ly pha lê chuyên dụng & hạt dinh dưỡng nhẹ'
        ),
    },
    'massage toàn thân đá nóng núi lửa (60 phút)': {
        'duration': '60 phút liệu trình • 1 khách',
        'ingredients': (
            'Ngâm chân thư giãn muối thảo dược & gừng tươi (10 phút)\n'
            'Massage toàn thân kỹ thuật Thụy Điển kết hợp tinh dầu oải hương hữu cơ\n'
            'Chườm và ấn huyệt bằng đá bazan núi lửa giữ nhiệt sâu\n'
            'Trà gừng mật ong ấm & khăn nóng thư giãn sau liệu trình'
        ),
    },
    'trị liệu cổ vai gáy thảo dược đông y (45 phút)': {
        'duration': '45 phút liệu trình • 1 khách',
        'ingredients': (
            'Bấm huyệt giải phóng căng cứng vùng cổ, vai, gáy & lưng trên\n'
            'Chườm túi thảo dược Đông y gừng, quế, ngải cứu hấp nóng\n'
            'Thoa tinh dầu thảo mộc làm ấm & khai thông kinh lạc\n'
            'Trà thảo mộc thanh lọc cơ thể dùng sau trị liệu'
        ),
    },
    'chăm sóc da mặt ngọc trai trắng sáng (60 phút)': {
        'duration': '60 phút liệu trình • 1 khách',
        'ingredients': (
            'Tẩy trang dịu nhẹ, rửa mặt sâu & xông hơi thải độc lỗ chân lông\n'
            'Tẩy tế bào chết sinh học & massage nâng cơ mặt nhẹ nhàng\n'
            'Điện di tinh chất Serum Hyaluronic Acid (HA) cấp ẩm chuyên sâu\n'
            'Đắp mặt nạ bột ngọc trai tinh khiết dưỡng sáng & khóa ẩm bảo vệ da'
        ),
    },
    'giặt hấp áo sơ mi / đầm dạ hội lấy ngay': {
        'duration': 'Trả đồ nhanh trong 3 giờ • Tính theo sản phẩm',
        'ingredients': (
            'Kiểm tra chất liệu vải & xử lý vết bẩn chuyên dụng\n'
            'Giặt khô hơi nước công nghệ cao bảo vệ phom dáng & màu sắc sợi vải\n'
            'Là ủi phẳng phiu chuẩn khách sạn & khử mùi hương dịu nhẹ\n'
            'Treo móc bọc túi bảo vệ sang trọng, giao trả tận cửa phòng'
        ),
    },
    'đưa đón sân bay bằng xe maybach / limousine': {
        'duration': 'Phục vụ 24/7 theo giờ bay • 1 chiều (tối đa 4 khách)',
        'ingredients': (
            'Xe sang Mercedes-Maybach / Limousine đời mới, nội thất cao cấp\n'
            'Tài xế đồng phục chuyên nghiệp cầm bảng tên đón tận sảnh sân bay Đà Nẵng\n'
            'Hỗ trợ hành lý tận tâm từ sảnh sân bay đến phòng nghỉ\n'
            'Miễn phí nước khoáng cao cấp, khăn lạnh & Wi-Fi tốc độ cao trên xe'
        ),
    },
    'set thêm gối lông vũ & khăn tắm cao cấp': {
        'duration': 'Giao tận phòng trong 10 - 15 phút • Miễn phí',
        'ingredients': (
            '02 gối lông vũ nhân tạo êm ái hỗ trợ nâng đỡ cổ vai\n'
            '01 chăn mỏng mùa hè cotton satin thoáng khí\n'
            '02 khăn tắm cỡ lớn & 02 khăn mặt 100% cotton mềm mịn\n'
            'Tất cả đều được giặt hấp tiệt trùng & đóng gói thơm mới'
        ),
    },
}


def _fallback_details(name, category_name):
    text = f'{category_name or ""} {name or ""}'.lower()
    if any(k in text for k in ['spa', 'massage', 'trị liệu', 'da mặt', 'wellness', 'thư giãn']):
        return (
            '60 phút liệu trình • 1 khách',
            'Tư vấn thể trạng & lựa chọn tinh dầu thiên nhiên phù hợp\n'
            'Thực hiện liệu trình chuyên sâu bởi kỹ thuật viên tay nghề cao\n'
            'Phòng trị liệu yên tĩnh hương thảo mộc & âm nhạc thư giãn\n'
            'Trà thảo mộc ấm & khăn nóng phục vụ sau liệu trình',
        )
    if any(k in text for k in ['xe', 'đưa đón', 'sân bay', 'limousine', 'transfer']):
        return (
            'Phục vụ 24/7 theo lịch hẹn • 1 chiều',
            'Xe đời mới sạch sẽ, điều hòa mát lạnh\n'
            'Tài xế chuyên nghiệp, đón tiễn đúng giờ\n'
            'Hỗ trợ hành lý tận tâm\n'
            'Nước suối & khăn lạnh miễn phí trên xe',
        )
    if any(k in text for k in ['giặt', 'ủi', 'laundry']):
        return (
            'Giao trả tận phòng trong 3 - 6 giờ',
            'Phân loại chất liệu vải kỹ lưỡng trước khi giặt\n'
            'Giặt hấp & là ủi tiêu chuẩn khách sạn\n'
            'Dung dịch giặt xả dịu nhẹ, thơm mát\n'
            'Gấp gọn hoặc treo móc giao tận phòng',
        )
    if any(k in text for k in ['uống', 'trà', 'cà phê', 'cocktail', 'vang', 'rượu', 'nước', 'bar']):
        return (
            'Pha chế 10 - 15 phút • 1 phần',
            'Nguyên liệu & đồ uống tuyển chọn chính hãng\n'
            'Pha chế tươi mới theo khẩu vị riêng của quý khách\n'
            'Phục vụ kèm ly thủy tinh cao cấp & đá tinh khiết\n'
            'Giao tận phòng nhanh chóng 24/7',
        )
    if any(k in text for k in ['ẩm thực', 'món', 'ăn', 'bò', 'phở', 'súp', 'mỳ', 'cơm', 'cua', 'hải sản', 'dining']):
        return (
            'Chế biến 20 - 30 phút • 1 phần',
            'Nguyên liệu tươi sạch tuyển chọn trong ngày\n'
            'Chế biến nóng ngay khi tiếp nhận yêu cầu\n'
            'Trình bày tinh tế kèm gia vị & nước chấm riêng\n'
            'Giao nóng tận phòng trong hộp/đĩa giữ nhiệt chuyên dụng',
        )
    return (
        'Phục vụ tận phòng 24/7',
        'Chuẩn bị đầy đủ theo tiêu chuẩn phục vụ khách sạn\n'
        'Nhân viên buồng phòng giao nhanh tận cửa phòng\n'
        'Hỗ trợ ghi chú yêu cầu riêng khi đặt dịch vụ',
    )


def populate_service_details(apps, schema_editor):
    ServiceItem = apps.get_model('services', 'ServiceItem')
    for item in ServiceItem.objects.select_related('category').all():
        key = (item.name or '').strip().lower()
        preset = SERVICE_DETAILS_BY_NAME.get(key)
        if preset:
            default_duration = preset['duration']
            default_ingredients = preset['ingredients']
        else:
            cat_name = item.category.name if item.category else ''
            default_duration, default_ingredients = _fallback_details(item.name, cat_name)

        updated_fields = []
        if not (item.duration or '').strip():
            item.duration = default_duration
            updated_fields.append('duration')
        if not (item.ingredients or '').strip():
            item.ingredients = default_ingredients
            updated_fields.append('ingredients')

        if updated_fields:
            item.save(update_fields=updated_fields)


def noop_reverse(apps, schema_editor):
    # Không xóa dữ liệu khi rollback để tránh mất chỉnh sửa của Admin
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0008_serviceitem_duration_serviceitem_ingredients'),
    ]

    operations = [
        migrations.RunPython(populate_service_details, noop_reverse),
    ]
