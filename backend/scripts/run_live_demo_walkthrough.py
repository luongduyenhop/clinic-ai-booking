"""Kịch bản demo E2E gọi API thật của backend đã seed (scripts/seed_one_week_realistic.py).

Chạy:  python -m scripts.run_live_demo_walkthrough
Biến môi trường (tùy chọn):
    DEMO_BASE_URL     mặc định http://127.0.0.1:8000/api/v1
    DEMO_PASSWORD     mật khẩu chung các tài khoản demo, mặc định theo TAI_KHOAN_DANG_NHAP.md
    SEPAY_API_KEY     chỉ cần khi backend có cấu hình SEPAY_API_KEY cho webhook
Mọi id (bệnh nhân, lượt khám, hóa đơn) được lấy động từ API, không cố định.
"""
import asyncio
import os
import re
from datetime import datetime
from decimal import Decimal

import httpx

BASE_URL = os.environ.get("DEMO_BASE_URL", "http://127.0.0.1:8000/api/v1")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "Demo@12345678")
RECEPTION_EMAIL = "letan.demo@clinic-ai.test"
DOCTOR_EMAIL = "doctor.demo@clinic-ai.test"
CASHIER_EMAIL = "thungan.demo@clinic-ai.test"


def _data(res: httpx.Response, step: str, expected=(200,)):
    assert res.status_code in expected, f"{step} that bai ({res.status_code}): {res.text}"
    return res.json()["data"]


async def _login(client: httpx.AsyncClient, email: str) -> dict:
    data = _data(
        await client.post("/auth/login", json={"email": email, "mat_khau": DEMO_PASSWORD}),
        f"Dang nhap {email}",
    )
    return {"Authorization": f"Bearer {data['access_token']}"}


async def reception_step(client: httpx.AsyncClient) -> None:
    headers = await _login(client, RECEPTION_EMAIL)
    print("[BUOC 1: TIEP DON - QUAY LE TAN]")
    print(f" -> Dang nhap Le tan thanh cong ({RECEPTION_EMAIL})")

    # Số CCCD/SĐT sinh theo thời điểm chạy để chạy lại nhiều lần không trùng hồ sơ
    suffix = datetime.now().strftime("%m%d%H%M%S")
    cccd = f"00{suffix}"
    phone = f"09{suffix[-8:]}"
    qr_raw = f"{cccd}|123456789|NGUYEN VAN DEMO|20051990|Nam|123 Pho Hue, Hoan Kiem, Ha Noi|15082021"
    qr_data = _data(
        await client.post("/reception/parse-cccd-qr", json={"qr_string": qr_raw}, headers=headers),
        "Quet QR CCCD",
    )
    print(" -> Quet QR CCCD thanh cong:")
    print(f"    + Ho ten:    {qr_data['full_name']}")
    print(f"    + So CCCD:   {qr_data['cccd_number']}")
    print(f"    + Ngay sinh: {qr_data['date_of_birth']} ({qr_data['gender']})")
    print(f"    + Dia chi:   {qr_data['address']}")

    patient = _data(
        await client.post(
            "/reception/register-patient",
            json={
                "ho_ten": qr_data["full_name"],
                "so_dien_thoai": phone,
                "ngay_sinh": qr_data["date_of_birth"],
                "gioi_tinh": {"MALE": "Nam", "FEMALE": "Nữ"}.get(qr_data["gender"], "Khác"),
                "dia_chi": qr_data["address"],
                "cccd_so": qr_data["cccd_number"],
            },
            headers=headers,
        ),
        "Dang ky ho so benh nhan",
        expected=(200, 201),
    )
    print(f" -> Tao ho so benh nhan moi: {patient['ma_dinh_danh_y_te']} (ID: {patient['id']})")


async def doctor_step(client: httpx.AsyncClient) -> None:
    headers = await _login(client, DOCTOR_EMAIL)
    print("\n[BUOC 2: PHONG KHAM LAM SANG - BAC SI]")
    print(f" -> Dang nhap Bac si thanh cong ({DOCTOR_EMAIL})")

    workspace = _data(await client.get("/clinical/workspace-state", headers=headers), "Tai ban kham")
    encounters = [
        enc for enc in (workspace or {}).get("encounters", {}).values()
        if enc.get("luot_kham_server_id") and not enc.get("is_locked")
    ]
    assert encounters, "Ban kham cua bac si khong co luot kham dang mo nao (hay chay lai seed_one_week_realistic.py)"
    encounter = encounters[0]
    encounter_id = encounter["luot_kham_server_id"]
    patient_id = encounter["benh_nhan_id"]
    print(f" -> Luot kham dang mo: {encounter['ma_kcb']} (ID: {encounter_id}) - {encounter.get('ly_do_vao_kham')}")

    vitals = _data(
        await client.post(
            f"/clinical/encounters/{encounter_id}/vitals",
            json={
                "systolic_bp": 122.0,
                "diastolic_bp": 80.0,
                "heart_rate": 76.0,
                "body_temperature": 38.2,
                "respiratory_rate": 18.0,
                "spo2_percentage": 98.0,
                "height_cm": 172.0,
                "weight_kg": 68.0,
            },
            headers=headers,
        ),
        "Ghi sinh hieu",
        expected=(200, 201),
    )
    print(" -> Do sinh hieu: HA 122/80 mmHg | SpO2: 98% | Than nhiet: 38.2 C")
    print(f"    + Chi so BMI tinh tu dong: {vitals['bmi']} (Canh bao nguy kich: {vitals['is_critical']})")

    allergy = _data(
        await client.post(
            "/clinical/allergy-check",
            json={"patient_id": patient_id, "active_ingredient": "Paracetamol"},
            headers=headers,
        ),
        "Kiem tra di ung thuoc",
    )
    print(f" -> Kiem tra di ung Paracetamol: has_conflict = {allergy['has_conflict']}")

    results = _data(
        await client.get("/clinical/icd10/search", params={"q": "viem hong"}, headers=headers),
        "Tra cuu ICD-10",
    )
    assert results, "Tra cuu ICD-10 'viem hong' khong co ket qua"
    print(f" -> Tra cuu ICD-10 tieng Viet: '{results[0]['code']}' - {results[0]['name_vi']}")


async def _pick_invoice(client: httpx.AsyncClient, headers: dict) -> dict:
    """Lập hóa đơn cho lượt khám chờ thu; nếu đã hết thì dùng hóa đơn đang chờ thu."""
    unbilled = _data(await client.get("/cashier/unbilled-encounters", headers=headers), "Lay ca cho lap hoa don")
    items = sorted(unbilled["items"], key=lambda item: not item["is_locked"])
    if items:
        luot_kham_id = items[0]["luot_kham_id"]
        preview = _data(
            await client.get(f"/cashier/encounters/{luot_kham_id}/invoice-preview", headers=headers),
            "Xem truoc bang ke",
        )
        print(f" -> Bang ke vien phi luot kham {preview['ma_kcb']} - {preview['benh_nhan']['ho_ten']}:")
        for line in preview["cac_khoan_thu"]:
            print(f"    + {line['ten_khoan_thu']}: {float(line['thanh_tien']):,.0f} VND")
        print("    ---------------------------------------------")
        print(f"    = Tong du kien: {float(preview['thuc_thu_du_kien']):,.0f} VND")
        invoice = _data(
            await client.post("/cashier/invoices", json={"luot_kham_id": luot_kham_id}, headers=headers),
            "Lap hoa don",
            expected=(200, 201),
        )
        print(f" -> Lap hoa don {invoice['ma_hoa_don']} (ID: {invoice['id']}, trang thai: {invoice['trang_thai']})")
        return {**invoice, "mabn": preview["benh_nhan"]["mabn"]}

    pending = _data(await client.get("/cashier/pending-bills", headers=headers), "Lay hoa don cho thu")
    assert pending["items"], "Khong con luot kham hay hoa don nao cho thu (hay chay lai seed_one_week_realistic.py)"
    invoice = pending["items"][0]
    print(f" -> Lay hoa don dang cho thu: {invoice['ma_hoa_don']} (ID: {invoice['id']})")
    return {**invoice, "mabn": invoice["benh_nhan"]["mabn"]}


async def cashier_step(client: httpx.AsyncClient) -> None:
    headers = await _login(client, CASHIER_EMAIL)
    print("\n[BUOC 3: THU NGAN & VIEN PHI - THANH TOAN VIETQR SEPAY]")
    print(f" -> Dang nhap Thu ngan thanh cong ({CASHIER_EMAIL})")

    invoice = await _pick_invoice(client, headers)
    amount = Decimal(str(invoice["thuc_thu"])) or Decimal(str(invoice["tong_tien"]))
    # Cùng nội dung chuyển khoản mà mã VietQR trên màn hình thu ngân sinh ra
    transfer_content = re.sub(r"[^A-Z0-9 ]", "", f"CLINIC HD {invoice['id']} {invoice['mabn']}".upper())
    print(f" -> Ma VietQR: so tien {float(amount):,.0f} VND | noi dung CK: '{transfer_content}'")

    print("\n[BUOC 4: CONG THANH TOAN SEPAY - WEBHOOK DOI SOAT]")
    webhook_headers = {}
    if os.environ.get("SEPAY_API_KEY"):
        webhook_headers["Authorization"] = f"Apikey {os.environ['SEPAY_API_KEY']}"
    now = datetime.now()
    webhook = _data(
        await client.post(
            "/cashier/webhook/sepay",
            headers=webhook_headers,
            json={
                "id": int(now.strftime("%m%d%H%M%S")),
                "gateway": "MBBank",
                "transactionDate": now.strftime("%Y-%m-%d %H:%M:%S"),
                "content": transfer_content,
                "transferType": "in",
                "transferAmount": float(amount),
                "referenceCode": f"FT{now.strftime('%Y%m%d%H%M%S')}",
            },
        ),
        "Webhook SePay",
    )
    assert webhook["success"], f"Webhook SePay khong doi soat duoc: {webhook['message']}"
    print(f" -> Nhan Webhook SePay: {webhook['message']}")

    paid = _data(await client.get(f"/cashier/invoices/{invoice['id']}", headers=headers), "Doc lai hoa don")
    assert paid["trang_thai"] == "da_thu", f"Hoa don chua duoc khoa so: {paid['trang_thai']}"
    print(
        f" -> Hoa don {paid['ma_hoa_don']} da khoa so: trang_thai = {paid['trang_thai']} | "
        f"thuc thu {float(paid['thuc_thu']):,.0f} VND ({paid['phuong_thuc_thanh_toan']})"
    )


async def main():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        print("\n" + "=" * 78)
        print("     CLINIC-AI DEMO: LIVE WORKFLOW WALKTHROUGH (E2E)")
        print("=" * 78 + "\n")
        await reception_step(client)
        await doctor_step(client)
        await cashier_step(client)
        print("\n" + "=" * 78)
        print("  DEMO SUCCESSFUL: HE THONG PHONG KHAM CLINIC-AI HOAN TOAN SAN SANG!")
        print("=" * 78 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
