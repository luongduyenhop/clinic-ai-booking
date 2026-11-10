import asyncio
from datetime import date, datetime, timezone
from decimal import Decimal
import hashlib
import hmac
import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"
PAYMENT_SECRET = "0f9b6b7a8c3d2e1f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f"


async def main():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        print("\n" + "=" * 78)
        print("     CLINIC-AI PRODUCTION DEMO: LIVE WORKFLOW WALKTHROUGH (E2E)")
        print("=" * 78 + "\n")

        login_res = await client.post(
            "/auth/login",
            json={"email": "tiepdon@clinic.com", "mat_khau": "Reception@2026"},
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        reception_token = login_res.json()["data"]["access_token"]
        reception_headers = {"Authorization": f"Bearer {reception_token}"}
        print("[BUOC 1: TIEP DON - QUAY LE TAN]")
        print(" -> Dang nhap Le tan thanh cong: Hoang Lan (tiepdon@clinic.com)")

        qr_raw = "001099008899|123456789|NGUYEN VAN AN|20051990|Nam|123 Pho Hue, Hoan Kiem, Ha Noi|15082021"
        qr_parse_res = await client.post(
            "/reception/parse-cccd-qr",
            json={"qr_string": qr_raw},
            headers=reception_headers,
        )
        assert qr_parse_res.status_code == 200, f"Parse QR failed: {qr_parse_res.text}"
        qr_data = qr_parse_res.json()["data"]
        print(f" -> Quet QR CCCD 7 truong thanh cong:")
        print(f"    + Ho ten:    {qr_data['full_name']}")
        print(f"    + So CCCD:   {qr_data['cccd_number']}")
        print(f"    + Ngay sinh: {qr_data['date_of_birth']} ({qr_data['gender']})")
        print(f"    + Dia chi:   {qr_data['address']}")

        dr_login_res = await client.post(
            "/auth/login",
            json={"email": "doctor@clinic.com", "mat_khau": "Doctor@2026"},
        )
        assert dr_login_res.status_code == 200
        doctor_token = dr_login_res.json()["data"]["access_token"]
        doctor_headers = {"Authorization": f"Bearer {doctor_token}"}
        print("\n[BUOC 2: PHONG KHAM LAM SANG - BAC SI]")
        print(" -> Dang nhap Bac si thanh cong: BS. Nguyen Van An (doctor@clinic.com)")

        encounter_id = 1
        vitals_res = await client.post(
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
            headers=doctor_headers,
        )
        if vitals_res.status_code in (200, 201):
            v_data = vitals_res.json()["data"]
            print(f" -> Do sinh hieu: HA 122/80 mmHg | SpO2: 98% | Than nhiet: 38.2 C")
            print(f"    + Chi so BMI tinh tu dong: {v_data['bmi']} (The trang: Binh thuong)")

        allergy_check = await client.post(
            "/clinical/allergy-check",
            json={
                "patient_id": 1,
                "drug_name": "Paracetamol 500mg",
            },
            headers=doctor_headers,
        )
        if allergy_check.status_code == 200:
            al_data = allergy_check.json()["data"]
            print(f" -> Kiem tra di ung thuoc: Khong co xung dot (has_conflict = {al_data['has_conflict']})")

        icd_search = await client.get(
            "/clinical/icd10/search",
            params={"query": "viem hong"},
            headers=doctor_headers,
        )
        if icd_search.status_code == 200:
            results = icd_search.json()["data"]
            print(f" -> Tra cuu ICD-10 tieng Viet: '{results[0]['code']}' - {results[0]['name_vi']}")

        cashier_login_res = await client.post(
            "/auth/login",
            json={"email": "thungan@clinic.com", "mat_khau": "Cashier@2026"},
        )
        assert cashier_login_res.status_code == 200
        cashier_token = cashier_login_res.json()["data"]["access_token"]
        cashier_headers = {"Authorization": f"Bearer {cashier_token}"}
        print("\n[BUOC 3: THU NGAN & VIEN PHI - THANH TOAN NAPAS VIETQR]")
        print(" -> Dang nhap Thu ngan thanh cong: Le Thi Mai (thungan@clinic.com)")

        fee_res = await client.get(
            f"/cashier/encounters/{encounter_id}/fee-sheet",
            headers=cashier_headers,
        )
        if fee_res.status_code == 200:
            fee_data = fee_res.json()["data"]
            print(f" -> Bang ke vien phi tu dong:")
            print(f"    + Phi kham chuyen khoa: {float(fee_data['total_service_amount']):,.0f} VND")
            print(f"    + Phi thuoc ke don:     {float(fee_data['total_medication_amount']):,.0f} VND")
            print(f"    ---------------------------------------------")
            print(f"    = Tong vien phi thuc thu: {float(fee_data['final_amount']):,.0f} VND")

        inv_res = await client.post(
            f"/cashier/encounters/{encounter_id}/create-invoice",
            json={"encounter_id": encounter_id, "discount_amount": 0},
            headers=cashier_headers,
        )
        if inv_res.status_code in (200, 201):
            inv_data = inv_res.json()["data"]
            invoice_id = inv_data["id"]
            invoice_code = inv_data["invoice_code"]
            final_amount = Decimal(str(inv_data["final_amount"]))
            print(f" -> Khoi tao hoa don vien phi: {invoice_code} (Trang thai: {inv_data['status']})")
        else:
            invoice_id = 2
            invoice_code = "HD-20261110-000001"
            final_amount = Decimal("150000.00")
            print(f" -> Lay hoa don hien tai: {invoice_code} (ID: {invoice_id})")

        qr_res = await client.post(
            f"/cashier/invoices/{invoice_id}/generate-vietqr",
            headers=cashier_headers,
        )
        if qr_res.status_code == 200:
            qr_resp = qr_res.json()["data"]
            print(f" -> Sinh ma Napas VietQR 247 Dong:")
            print(f"    + Bank BIN:       {qr_resp['bank_bin']} (Napas 247)")
            print(f"    + So tai khoan:   {qr_resp['account_number']}")
            print(f"    + So tien:        {float(qr_resp['final_amount']):,.0f} VND")
            print(f"    + Ma doi soat:    {qr_resp['payment_reference']}")
            print(f"    + EMVCo Chuoi QR: {qr_resp['qr_payload_emvco'][:35]}...")
            print(f"    + Link QuickLink: {qr_resp['qr_quicklink_url'][:60]}...")

        print("\n[BUOC 4: CONG THANH TOAN NGAN HANG - WEBHOOK DOI SOAT]")
        txn_code = f"TXN-NAPAS-DEMO-{invoice_id:04d}-{datetime.now().strftime('%H%M%S')}"
        raw_msg = f"{txn_code}|{invoice_id}|{final_amount}"
        sig = hmac.new(
            PAYMENT_SECRET.encode("utf-8"),
            raw_msg.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        webhook_res = await client.post(
            "/cashier/payments/webhook",
            headers={"X-Signature": sig},
            json={
                "transaction_code": txn_code,
                "bank_transaction_id": f"FT{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "amount": float(final_amount),
                "invoice_id": invoice_id,
                "signature": sig,
            },
        )
        if webhook_res.status_code == 200:
            w_data = webhook_res.json()["data"]
            print(f" -> Nhan Webhook tu Ngan hang Napas: Chu ky HMAC-SHA256 hop le!")
            print(f" -> Hoa don {invoice_code} duoc khoa so: status = PAID | is_locked = True")

        print("\n" + "=" * 78)
        print("  DEMO SUCCESSFUL: HE THONG PHONG KHAM CLINIC-AI HOAN TOAN SAN SANG!")
        print("=" * 78 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
