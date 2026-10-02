import asyncio
import random
import sys
import time
from datetime import date, timedelta, time as dt_time
import httpx
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.user import TaiKhoan, BenhNhan
from app.models.appointment import LichKham, TrangThaiLichEnum

BASE_URL = "http://127.0.0.1:8000/api/v1"

class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"

results = []

def record_result(tc_id, author, name, passed, status_code, details=""):
    status_str = f"{Colors.GREEN}PASSED{Colors.RESET}" if passed else f"{Colors.RED}FAILED{Colors.RESET}"
    print(f"[{status_str}] {Colors.BOLD}{tc_id}{Colors.RESET} ({author}): {name} -> HTTP {status_code}")
    if details:
        print(f"       -> {details}")
    results.append({
        "id": tc_id,
        "author": author,
        "name": name,
        "passed": passed,
        "status_code": status_code,
        "details": details
    })


async def get_otp_from_db(email: str) -> str:
    async with AsyncSessionLocal() as session:
        stmt = select(TaiKhoan.otp_code).where(TaiKhoan.email == email)
        res = await session.execute(stmt)
        return res.scalar_one_or_none()


async def create_past_appointment_for_noshow(benh_nhan_id: int, bac_si_id: int) -> int:
    """Tạo trực tiếp 1 lịch hẹn hôm qua (đã qua giờ khám) để test hợp lệ chức năng No-show"""
    async with AsyncSessionLocal() as session:
        yesterday = date.today() - timedelta(days=1)
        rand_hour = random.randint(7, 16)
        rand_min = random.choice([0, 30])
        ma_lich = f"LK-{yesterday.strftime('%Y%m%d')}-NS{random.randint(10000, 99999)}"
        lich = LichKham(
            ma_lich_kham=ma_lich,
            benh_nhan_id=benh_nhan_id,
            bac_si_id=bac_si_id,
            ngay_kham=yesterday,
            gio_kham=dt_time(rand_hour, rand_min),
            so_thu_tu=99,
            ly_do_kham="Khám thử nghiệm tính năng No-show",
            trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
            is_reconfirmed_24h=True
        )
        session.add(lich)
        await session.commit()
        await session.refresh(lich)
        return lich.id


async def run_e2e_tests():
    ts = int(time.time())
    rand_id = random.randint(1000, 9999)
    test_email = f"patient_e2e_{ts}_{rand_id}@example.com"
    test_phone = f"097{random.randint(1000000, 9999999)}"
    test_password = "Password@123"
    
    patient_tokens = {}
    seed_patient_tokens = {}
    doctor_tokens = {}
    admin_tokens = {}
    
    created_appointment_id = None
    created_appointment_id_2 = None
    tomorrow = date.today() + timedelta(days=1)
    tomorrow_str = tomorrow.strftime("%Y-%m-%d")
    unique_future_date = date.today() + timedelta(days=7)
    unique_future_date_str = unique_future_date.strftime("%Y-%m-%d")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        print(f"\n{Colors.CYAN}{Colors.BOLD}======================================================================{Colors.RESET}")
        print(f"{Colors.CYAN}{Colors.BOLD}   BẮT ĐẦU CHẠY KIỂM THỬ THỰC TẾ HỆ THỐNG CLINIC AI (E2E TEST SUITE)  {Colors.RESET}")
        print(f"{Colors.CYAN}{Colors.BOLD}======================================================================{Colors.RESET}\n")

        # 0. ĐĂNG NHẬP SẴN BÁC SĨ, ADMIN VÀ SEED BỆNH NHÂN (Trước khi kích hoạt Rate Limit)
        print(f"{Colors.CYAN}[BƯỚC CHUẨN BỊ] Khởi tạo phiên đăng nhập Bác sĩ & Admin...{Colors.RESET}")
        login_doc = await client.post("/auth/login", json={"email": "an.doctor@clinic.com", "mat_khau": "Doctor@123456"})
        doctor_tokens["access"] = (login_doc.json().get("data") or {}).get("access_token")
        
        login_admin = await client.post("/auth/login", json={"email": "admin@clinic.com", "mat_khau": "Admin@123456"})
        admin_tokens["access"] = (login_admin.json().get("data") or {}).get("access_token")

        login_seed_pt = await client.post("/auth/login", json={"email": "patient@test.com", "mat_khau": "Patient@123456"})
        seed_patient_tokens["access"] = (login_seed_pt.json().get("data") or {}).get("access_token")

        # -------------------------------------------------------------
        # PHẦN 1: BÙI THANH TÙNG (Package A)
        # -------------------------------------------------------------
        print(f"\n{Colors.YELLOW}--- PHẦN 1: BÙI THANH TÙNG (Package A - Xác thực, Token & Hồ sơ) ---{Colors.RESET}")

        # TC-01: Đăng ký tài khoản
        reg_payload = {
            "ho_ten": f"Nguyễn Văn E2E {rand_id}",
            "email": test_email,
            "so_dien_thoai": test_phone,
            "mat_khau": test_password,
            "ngay_sinh": "1996-05-15",
            "gioi_tinh": "Nam"
        }
        res = await client.post("/auth/register", json=reg_payload)
        res_json = res.json()
        passed = res.status_code == 201 and res_json.get("success") is True
        debug_otp = (res_json.get("data") or {}).get("debug_otp")
        record_result("TC-01", "Tùng", "Đăng ký tài khoản người bệnh mới (POST /auth/register)", passed, res.status_code, f"Email: {test_email} | SĐT: {test_phone} | OTP: {debug_otp}")

        # TC-02: Kích hoạt OTP
        otp_code = debug_otp or await get_otp_from_db(test_email)
        verify_payload = {"email": test_email, "otp_code": otp_code}
        res = await client.post("/auth/verify-otp", json=verify_payload)
        data = res.json().get("data") or {}
        passed = res.status_code == 200 and "access_token" in data and "refresh_token" in data
        patient_tokens["access"] = data.get("access_token")
        patient_tokens["refresh"] = data.get("refresh_token")
        record_result("TC-02", "Tùng", "Xác thực OTP kích hoạt tài khoản (POST /auth/verify-otp)", passed, res.status_code, f"Token nhận được: {str(patient_tokens['access'])[:25]}... (OTP: {otp_code})")

        # TC-03: Đăng nhập hệ thống
        login_payload = {"email": test_email, "mat_khau": test_password}
        res = await client.post("/auth/login", json=login_payload)
        data = res.json().get("data") or {}
        passed = res.status_code == 200 and data.get("vai_tro") == "benh_nhan"
        patient_tokens["access"] = data.get("access_token")
        patient_tokens["refresh"] = data.get("refresh_token")
        record_result("TC-03", "Tùng", "Đăng nhập nhận Access + Refresh Token (POST /auth/login)", passed, res.status_code, f"Vai trò: {data.get('vai_tro')}, Hạn: {data.get('expires_in_minutes')} phút")

        # TC-04: Cấp lại token bằng Refresh Token
        refresh_payload = {"refresh_token": patient_tokens["refresh"]}
        res = await client.post("/auth/refresh", json=refresh_payload)
        data = res.json().get("data") or {}
        new_access = data.get("access_token")
        passed = res.status_code == 200 and new_access is not None
        if new_access:
            patient_tokens["access"] = new_access
        record_result("TC-04", "Tùng", "Làm mới Access Token (POST /auth/refresh)", passed, res.status_code, f"New Access Token: {str(new_access)[:25]}...")

        # TC-05: Xem thông tin cá nhân (GET /auth/me)
        headers = {"Authorization": f"Bearer {patient_tokens['access']}"}
        res = await client.get("/auth/me", headers=headers)
        data = res.json().get("data") or {}
        passed = res.status_code == 200 and data.get("email") == test_email and data.get("ma_dinh_danh_y_te") is not None
        record_result("TC-05", "Tùng", "Xem thông tin hồ sơ cá nhân (GET /auth/me)", passed, res.status_code, f"Họ tên: {data.get('ho_ten')} | Mã Y Tế: {data.get('ma_dinh_danh_y_te')} | Vai trò: {data.get('vai_tro')}")

        # TC-06: Cập nhật thông tin cá nhân (PUT /auth/me)
        update_payload = {
            "ho_ten": "Nguyễn Văn E2E Updated",
            "dia_chi": "Số 15 Cầu Giấy, Hà Nội",
            "nhom_mau": "O+",
            "tien_su_benh": "Đau dạ dày nhẹ",
            "di_ung_thuoc": "Dị ứng Penicillin"
        }
        res = await client.put("/auth/me", headers=headers, json=update_payload)
        data = res.json().get("data") or {}
        passed = res.status_code == 200 and data.get("ho_ten") == update_payload["ho_ten"] and data.get("nhom_mau") == "O+"
        record_result("TC-06", "Tùng", "Cập nhật hồ sơ bệnh nhân (PUT /auth/me)", passed, res.status_code, f"Địa chỉ: {data.get('dia_chi')} | Nhóm máu: {data.get('nhom_mau')} | Dị ứng: {data.get('di_ung_thuoc')}")

        # -------------------------------------------------------------
        # PHẦN 2: HOÀNG ĐỨC TRỌNG (Package B Core)
        # -------------------------------------------------------------
        print(f"\n{Colors.YELLOW}--- PHẦN 2: HOÀNG ĐỨC TRỌNG (Package B Core - Danh mục & Đặt lịch) ---{Colors.RESET}")

        # TC-07: Danh mục chuyên khoa
        res = await client.get("/medical/specialties")
        data = res.json().get("data") or []
        passed = res.status_code == 200 and len(data) >= 4
        sample_ck = next((c for c in data if c.get("so_luong_bac_si", 0) > 0), data[0] if data else {})
        record_result("TC-07", "Trọng", "Lấy danh mục chuyên khoa (GET /medical/specialties)", passed, res.status_code, f"Tổng số: {len(data)} chuyên khoa. Mẫu: {sample_ck.get('ten_chuyen_khoa')} (BS: {sample_ck.get('so_luong_bac_si')})")

        # TC-08: Danh mục bác sĩ & phân trang
        res = await client.get("/medical/doctors?page=1&page_size=10")
        data = res.json().get("data") or []
        meta = res.json().get("meta") or {}
        passed = res.status_code == 200 and len(data) >= 1
        sample_bs = data[0] if data else {}
        record_result("TC-08", "Trọng", "Tra cứu danh sách bác sĩ (GET /medical/doctors)", passed, res.status_code, f"Tổng số BS: {meta.get('total_items')}. Mẫu: {sample_bs.get('ho_ten')} ({sample_bs.get('hoc_vi')} - {sample_bs.get('chuyen_khoa')}) Giá: {sample_bs.get('gia_kham_mac_dinh'):,.0f}đ")

        # TC-09: Dynamic Slots 30 phút
        res = await client.get(f"/appointments/doctors/1/slots?query_date={tomorrow_str}")
        data = res.json().get("data") or {}
        slots = data.get("slots") or []
        avail_slot = next((s for s in slots if s.get("status") == "available"), None)
        passed = res.status_code == 200 and len(slots) == 15 and avail_slot is not None
        selected_slot_time = avail_slot.get("time_val") if avail_slot else "08:30:00"
        record_result("TC-09", "Trọng", f"Tính toán Dynamic Slots 30p ngày {tomorrow_str} (GET /slots)", passed, res.status_code, f"Tổng số slot: {len(slots)}/15 slots. Chọn slot trống: {selected_slot_time} ({avail_slot.get('status')})")

        # TC-10: Đặt lịch khám trực tuyến (Pessimistic Locking)
        book_payload = {
            "bac_si_id": 1,
            "ngay_kham": tomorrow_str,
            "gio_kham": selected_slot_time,
            "ly_do_kham": "Tức ngực trái và hồi hộp khi gắng sức",
            "trieu_chung_ban_dau": "Đau tức vùng ngực 2 ngày"
        }
        res = await client.post("/appointments", headers=headers, json=book_payload)
        data = res.json().get("data") or {}
        created_appointment_id = data.get("id")
        passed = res.status_code == 201 and data.get("ma_lich_kham") and data.get("trang_thai") == "cho_xac_nhan"
        record_result("TC-10", "Trọng", "Đặt lịch khám trực tuyến (POST /appointments)", passed, res.status_code, f"Mã hẹn: {data.get('ma_lich_kham')} | STT: {data.get('so_thu_tu')} | Bác sĩ ID: {data.get('bac_si_id')} | Trạng thái: {data.get('trang_thai')}")

        # TC-11: Chống Race Condition - Đặt trùng slot
        res_dup = await client.post("/appointments", headers=headers, json=book_payload)
        passed = res_dup.status_code == 409
        record_result("TC-11", "Trọng", "Bắt xung đột trùng slot Pessimistic Lock (POST /appointments)", passed, res_dup.status_code, f"Lỗi phản hồi 409: {res_dup.json().get('message')}")

        # TC-12: Hủy lịch hẹn trước 2 tiếng & giải phóng slot
        cancel_payload = {"ly_do_huy": "Có lịch họp đột xuất cần dời ngày khám"}
        res = await client.post(f"/appointments/{created_appointment_id}/cancel", headers=headers, json=cancel_payload)
        data = res.json().get("data") or {}
        passed = res.status_code == 200 and data.get("trang_thai") == "da_huy"
        
        # Kiểm tra lại slot xem đã giải phóng về 'available' chưa
        res_check_slot = await client.get(f"/appointments/doctors/1/slots?query_date={tomorrow_str}")
        slots_check = (res_check_slot.json().get("data") or {}).get("slots") or []
        freed_slot = next((s for s in slots_check if s.get("time_val") == selected_slot_time), {})
        is_freed = freed_slot.get("status") == "available"
        record_result("TC-12", "Trọng", "Hủy lịch hẹn trước 2h & nhả slot (POST /appointments/{id}/cancel)", passed and is_freed, res.status_code, f"Trạng thái lịch: {data.get('trang_thai')} | Slot {selected_slot_time} đã về: {freed_slot.get('status')}")

        # -------------------------------------------------------------
        # PHẦN 3: ĐINH ĐỨC HOÀNG (Package B Advanced & Package D)
        # -------------------------------------------------------------
        print(f"\n{Colors.YELLOW}--- PHẦN 3: ĐINH ĐỨC HOÀNG (Package B Adv & D - Xác nhận, Waitlist, No-show & Admin) ---{Colors.RESET}")

        # TC-13: Tạo 1 lịch hẹn mới để test luồng xác nhận
        book_payload_2 = {
            "bac_si_id": 1,
            "ngay_kham": tomorrow_str,
            "gio_kham": selected_slot_time,
            "ly_do_kham": "Khám định kỳ huyết áp",
            "trieu_chung_ban_dau": "Chóng mặt nhẹ buổi sáng"
        }
        res = await client.post("/appointments", headers=headers, json=book_payload_2)
        data = res.json().get("data") or {}
        created_appointment_id_2 = data.get("id")
        passed = res.status_code == 201
        record_result("TC-13", "Hoàng", "Khởi tạo lịch hẹn để kiểm thử luồng nâng cao", passed, res.status_code, f"ID: {created_appointment_id_2} | Mã: {data.get('ma_lich_kham')}")

        # TC-14: Bệnh nhân xác nhận lịch trước 24h
        res = await client.post(f"/appointments/{created_appointment_id_2}/confirm", headers=headers)
        data = res.json().get("data") or {}
        passed = res.status_code == 200 and data.get("is_reconfirmed_24h") is True and data.get("trang_thai") == "da_xac_nhan"
        record_result("TC-14", "Hoàng", "Bệnh nhân xác nhận lịch trước 24h (POST /{id}/confirm)", passed, res.status_code, f"Trạng thái: {data.get('trang_thai')} | Xác nhận: {data.get('is_reconfirmed_24h')}")

        # TC-15: Ràng buộc an toàn: Chặn đánh dấu No-show trước giờ hẹn khám (Negative Test)
        doc_headers = {"Authorization": f"Bearer {doctor_tokens['access']}"}
        res_noshow_early = await client.post(
            f"/appointments/{created_appointment_id_2}/no-show",
            headers=doc_headers,
            json={"ghi_chu": "Bệnh nhân chưa đến"}
        )
        passed_early = res_noshow_early.status_code == 409
        record_result("TC-15", "Hoàng", "Chặn đánh dấu No-show trước giờ hẹn (Invariant Protection)", passed_early, res_noshow_early.status_code, f"Lỗi 409: {res_noshow_early.json().get('message')}")

        # TC-16: Bác sĩ đánh dấu No-show hợp lệ khi ca khám đã qua giờ (Positive Test)
        # Lấy benh_nhan.id từ DB
        async with AsyncSessionLocal() as session:
            stmt_bn = select(BenhNhan.id).join(TaiKhoan, TaiKhoan.nguoi_dung_id == BenhNhan.nguoi_dung_id).where(TaiKhoan.email == test_email)
            real_bn_id = (await session.execute(stmt_bn)).scalar() or 1
            
        past_app_id = await create_past_appointment_for_noshow(real_bn_id, bac_si_id=1)
        res_noshow_valid = await client.post(
            f"/appointments/{past_app_id}/no-show",
            headers=doc_headers,
            json={"ghi_chu": "Bệnh nhân không có mặt sau 15 phút gọi tên"}
        )
        data_noshow = res_noshow_valid.json().get("data") or {}
        passed_valid = res_noshow_valid.status_code == 200 and data_noshow.get("trang_thai") in ("no_show", "vang_mat") and data_noshow.get("so_lan_no_show") >= 1
        record_result("TC-16", "Hoàng", "Bác sĩ đánh dấu vắng mặt No-show hợp lệ (POST /{id}/no-show)", passed_valid, res_noshow_valid.status_code, f"Trạng thái: {data_noshow.get('trang_thai')} | Bệnh nhân ID: {data_noshow.get('benh_nhan_id')} bị phạt vi phạm: {data_noshow.get('so_lan_no_show')} lần")

        # Dọn dẹp hàng đợi test cũ trên ngày hẹn này để đảm bảo test isolation tuyệt đối
        async with AsyncSessionLocal() as session:
            from app.models.appointment import DanhSachCho
            from sqlalchemy import delete
            await session.execute(delete(DanhSachCho).where(DanhSachCho.ngay_mong_muon == unique_future_date, DanhSachCho.bac_si_id == 1))
            await session.commit()

        # TC-17: Đăng ký danh sách chờ Waitlist (Bệnh nhân đăng ký chờ ngày độc lập)
        waitlist_payload = {
            "bac_si_id": 1,
            "ngay_mong_muon": unique_future_date_str,
            "ca_mong_muon": "sang",
            "trieu_chung": "Cần khám tim mạch khẩn trong ca sáng"
        }
        res = await client.post("/appointments/waitlist", headers=headers, json=waitlist_payload)
        data = res.json().get("data") or {}
        waitlist_id = data.get("id")
        passed = res.status_code == 201 and data.get("thu_tu_uu_tien") >= 1 and data.get("trang_thai") == "dang_cho"
        record_result("TC-17", "Hoàng", "Đăng ký danh sách chờ Waitlist (POST /waitlist)", passed, res.status_code, f"Entry ID: {waitlist_id} | Thứ tự ưu tiên: #{data.get('thu_tu_uu_tien')} | Ca: {data.get('ca_mong_muon')}")

        # TC-18: Tra cứu danh sách chờ cá nhân (GET /my-waitlist)
        res = await client.get("/appointments/my-waitlist", headers=headers)
        data = res.json().get("data") or []
        passed = res.status_code == 200 and len(data) >= 1
        sample_wl = data[0] if data else {}
        record_result("TC-18", "Hoàng", "Tra cứu danh sách chờ cá nhân (GET /my-waitlist)", passed, res.status_code, f"Số lượng đang chờ: {len(data)}. Bác sĩ: {sample_wl.get('bac_si_ho_ten')} ({sample_wl.get('chuyen_khoa')})")

        # TC-19: Tự động hủy lịch & Phân quyền bảo mật Admin (process-unconfirmed)
        # Bước A: Bệnh nhân gọi -> Phải trả về 403 Forbidden
        res_patient_call = await client.post("/appointments/process-unconfirmed?hours_threshold=2.0", headers=headers)
        patient_blocked = res_patient_call.status_code == 403

        # Bước B: Admin gọi -> Phải trả về 200 OK
        admin_headers = {"Authorization": f"Bearer {admin_tokens['access']}"}
        res_admin_call = await client.post("/appointments/process-unconfirmed?hours_threshold=2.0", headers=admin_headers)
        admin_data = res_admin_call.json().get("data") or {}
        admin_passed = res_admin_call.status_code == 200

        passed = patient_blocked and admin_passed
        record_result("TC-19", "Hoàng", "Tự động hủy lịch & Siết quyền RBAC Admin (POST /process-unconfirmed)", passed, f"P:{res_patient_call.status_code}/A:{res_admin_call.status_code}", f"Bệnh nhân bị chặn 403: {patient_blocked} | Admin xử lý thành công: Hủy {admin_data.get('so_lich_tu_dong_huy')} lịch, Đôn {admin_data.get('so_nguoi_don_waitlist')} người")

        # TC-20: Luồng Bệnh nhân nhận slot từ Waitlist (POST /waitlist/{id}/accept)
        # Tìm 1 slot còn trống trong ca sáng của ngày unique_future_date
        res_future_slots = await client.get(f"/appointments/doctors/1/slots?query_date={unique_future_date_str}")
        future_slots = (res_future_slots.json().get("data") or {}).get("slots") or []
        future_avail_slot = next((s for s in future_slots if s.get("status") == "available" and s.get("time_val") < "12:00:00"), None)
        future_slot_time = future_avail_slot.get("time_val") if future_avail_slot else "09:30:00"

        # Bước 1: Seed Patient (patient@test.com) đặt lịch trước ở slot đó
        seed_headers = {"Authorization": f"Bearer {seed_patient_tokens['access']}"}
        res_seed_book = await client.post("/appointments", headers=seed_headers, json={
            "bac_si_id": 1,
            "ngay_kham": unique_future_date_str,
            "gio_kham": future_slot_time,
            "ly_do_kham": "Đặt trước để sau đó hủy nhường slot"
        })
        seed_app_id = (res_seed_book.json().get("data") or {}).get("id")

        # Bước 2: Seed Patient hủy lịch -> Hệ thống đôn người đang chờ ở TC-17 (waitlist_id) sang 'da_thong_bao'!
        await client.post(f"/appointments/{seed_app_id}/cancel", headers=seed_headers, json={"ly_do_huy": "Hủy lịch để nhường cho danh sách chờ"})

        # Bước 3: Patient đang đứng đầu danh sách chờ (headers của test_patient) gọi accept slot!
        res_accept = await client.post(f"/appointments/waitlist/{waitlist_id}/accept", headers=headers)
        accept_data = res_accept.json().get("data") or {}
        passed = res_accept.status_code == 200 and accept_data.get("ma_lich_kham") is not None
        record_result("TC-20", "Hoàng", "Bệnh nhân nhận slot từ Waitlist (POST /waitlist/{id}/accept)", passed, res_accept.status_code, f"Lịch mới sinh từ Waitlist: {accept_data.get('ma_lich_kham')} | Giờ: {accept_data.get('gio_kham')} | Bệnh nhân: {accept_data.get('benh_nhan', {}).get('ho_ten')}")

        # TC-21: Tra cứu lịch sử khám bệnh nhân (GET /my-appointments)
        res = await client.get("/appointments/my-appointments", headers=headers)
        data = res.json().get("data") or []
        passed = res.status_code == 200 and len(data) >= 1
        sample_app = data[0] if data else {}
        record_result("TC-21", "Hoàng", "Tra cứu lịch sử khám cá nhân (GET /my-appointments)", passed, res.status_code, f"Tổng số lịch: {len(data)}. Lịch gần nhất: {sample_app.get('ma_lich_kham')} ({sample_app.get('trang_thai')}) STT: {sample_app.get('so_thu_tu')}")

        # -------------------------------------------------------------
        # RATE LIMITING TEST (Chạy cuối cùng để không ảnh hưởng các test khác)
        # -------------------------------------------------------------
        print(f"\n{Colors.YELLOW}--- KIỂM TRA RATE LIMITING (Chạy cuối cùng) ---{Colors.RESET}")
        rate_limit_triggered = False
        status_last = 200
        for i in range(7):
            res_spam = await client.post("/auth/login", json={"email": "spam_bot@example.com", "mat_khau": "WrongPass123"})
            status_last = res_spam.status_code
            if res_spam.status_code == 429:
                rate_limit_triggered = True
                break
        record_result("TC-22", "Tùng", "Cơ chế Rate Limiting chống Brute-force (/auth/login)", rate_limit_triggered, status_last, "Đã kích hoạt chặn 429 Too Many Requests khi gọi spam")

    # Tổng kết
    total = len(results)
    passed_count = sum(1 for r in results if r["passed"])
    failed_count = total - passed_count
    print(f"\n{Colors.CYAN}{Colors.BOLD}======================================================================{Colors.RESET}")
    print(f"{Colors.BOLD}TỔNG KẾT KẾT QUẢ KIỂM THỬ: {Colors.GREEN}{passed_count}/{total} PASSED{Colors.RESET} ({failed_count} FAILED){Colors.RESET}")
    print(f"{Colors.CYAN}{Colors.BOLD}======================================================================{Colors.RESET}\n")

    if failed_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_e2e_tests())
