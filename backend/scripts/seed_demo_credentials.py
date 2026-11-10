import asyncio
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.production_models import (
    DiagnosisICD10Production,
    DrugProduction,
    EncounterDiagnosisProduction,
    EncounterProduction,
    InvoiceProduction,
    ParaclinicalOrderProduction,
    PatientProduction,
    PrescriptionItemProduction,
    PrescriptionProduction,
    ServiceProduction,
    UserProduction,
)
from app.models.user import BacSi, NguoiDung, TaiKhoan, VaiTroEnum


async def seed():
    async with AsyncSessionLocal() as session:
        accounts = [
            ("admin@clinic.com", "Admin@123456", "Quản Trị Viên", VaiTroEnum.ADMIN.value, "ADMIN"),
            ("doctor@clinic.com", "Doctor@2026", "BS. Nguyễn Văn An", VaiTroEnum.BAC_SI.value, "DOCTOR"),
            ("thungan@clinic.com", "Cashier@2026", "Thu Ngân Lê Thị Mai", VaiTroEnum.THU_NGAN.value, "CASHIER"),
            ("tiepdon@clinic.com", "Reception@2026", "Tiếp Đón Hoàng Lan", VaiTroEnum.LE_TAN.value, "RECEPTIONIST"),
        ]

        for email, pwd, full_name, role_legacy, role_prod in accounts:
            stmt_tk = select(TaiKhoan).where(TaiKhoan.email == email)
            tk = (await session.execute(stmt_tk)).scalar_one_or_none()
            hashed = hash_password(pwd)
            if not tk:
                nd = NguoiDung(
                    ho_ten=full_name,
                    email=email,
                    so_dien_thoai=f"0988{email[:5]}",
                    gioi_tinh="Nam",
                )
                session.add(nd)
                await session.flush()
                tk = TaiKhoan(
                    nguoi_dung_id=nd.id,
                    email=email,
                    mat_khau_hash=hashed,
                    vai_tro=role_legacy,
                    is_active=True,
                )
                session.add(tk)
                await session.flush()
            else:
                tk.mat_khau_hash = hashed
                tk.is_active = True

            stmt_up = select(UserProduction).where(UserProduction.email == email)
            up = (await session.execute(stmt_up)).scalar_one_or_none()
            if not up:
                up = UserProduction(
                    username=email.split("@")[0],
                    hashed_password=hashed,
                    full_name=full_name,
                    email=email,
                    role=role_prod,
                    is_active=True,
                )
                session.add(up)
                await session.flush()
            else:
                up.hashed_password = hashed
                up.role = role_prod
                up.is_active = True

            if role_prod == "DOCTOR":
                stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == tk.nguoi_dung_id)
                bs = (await session.execute(stmt_bs)).scalar_one_or_none()
                if not bs:
                    bs = BacSi(
                        nguoi_dung_id=tk.nguoi_dung_id,
                        hoc_vi="Bác sĩ CKI",
                        chung_chi_hanh_nghe="CCHN-DEMO-001",
                        is_active=True,
                    )
                    session.add(bs)
                    await session.flush()

        services = [
            ("CLS-BLOOD-01", "Tổng phân tích tế bào máu ngoại vi", "LABORATORY", Decimal("120000.00"), "Khoa Xét Nghiệm"),
            ("CLS-XRAY-01", "Chụp X-Quang ngực thẳng kỹ thuật số", "IMAGING", Decimal("200000.00"), "Khoa Chẩn Đoán Hình Ảnh"),
            ("CLS-ECG-01", "Điện tâm đồ 12 chuyển đạo (ECG)", "PROCEDURE", Decimal("100000.00"), "Khoa Thăm Dò Chức Năng"),
        ]
        for code, name, cat, price, dept in services:
            stmt_s = select(ServiceProduction).where(ServiceProduction.service_code == code)
            s = (await session.execute(stmt_s)).scalar_one_or_none()
            if not s:
                session.add(
                    ServiceProduction(
                        service_code=code,
                        service_name=name,
                        category=cat,
                        unit_price=price,
                        department=dept,
                        is_active=True,
                    )
                )

        drugs = [
            ("DRUG-CIPRO-01", "Ciprofloxacin 500mg", "Ciprofloxacin", "Viên nén", "500mg", "Uống", "Viên", Decimal("15000.00"), "L01-CIPRO", 90, 200, Decimal("10000.00")),
            ("DRUG-PARA-01", "Paracetamol 500mg", "Paracetamol", "Viên sủi", "500mg", "Uống", "Viên", Decimal("2000.00"), "L02-PARA", 180, 500, Decimal("1200.00")),
            ("DRUG-AMOX-01", "Amoxicillin 500mg", "Amoxicillin", "Viên nang", "500mg", "Uống", "Viên", Decimal("5000.00"), "L03-AMOX", 60, 300, Decimal("3500.00")),
        ]
        for d_code, b_name, g_name, form, strg, route, unit, price, b_num, exp_days, qty, imp_price in drugs:
            stmt_d = select(DrugProduction).where(DrugProduction.drug_code == d_code)
            d = (await session.execute(stmt_d)).scalar_one_or_none()
            if not d:
                d = DrugProduction(
                    drug_code=d_code,
                    brand_name=b_name,
                    generic_name=g_name,
                    dosage_form=form,
                    strength=strg,
                    route_of_administration=route,
                    unit_of_measure=unit,
                    unit_selling_price=price,
                    is_active=True,
                )
                session.add(d)
                await session.flush()

        icd_codes = [
            ("J02.9", "X", "Viêm họng cấp không đặc hiệu"),
            ("I10", "IX", "Bệnh tăng huyết áp vô căn (nguyên phát)"),
            ("K29.7", "XI", "Viêm dạ dày không đặc hiệu"),
            ("J00", "X", "Viêm mũi họng cấp (Cảm thường)"),
        ]
        for code, chap, name in icd_codes:
            stmt_icd = select(DiagnosisICD10Production).where(DiagnosisICD10Production.code == code)
            icd = (await session.execute(stmt_icd)).scalar_one_or_none()
            if not icd:
                session.add(
                    DiagnosisICD10Production(
                        code=code,
                        chapter_code=chap,
                        name_vi=name,
                        is_active=True,
                    )
                )

        stmt_demo_p = select(PatientProduction).where(PatientProduction.patient_code == "BN-DEMO-2026")
        demo_p = (await session.execute(stmt_demo_p)).scalar_one_or_none()
        if not demo_p:
            demo_p = PatientProduction(
                patient_code="BN-DEMO-2026",
                cccd_number="001099008899",
                full_name="NGUYỄN VĂN AN",
                date_of_birth=date(1990, 5, 20),
                gender="MALE",
                phone_number="0912345678",
                address="123 Phố Huế, Hoàn Kiếm, Hà Nội",
            )
            session.add(demo_p)
            await session.flush()

        stmt_dr = select(UserProduction).where(UserProduction.email == "doctor@clinic.com")
        dr = (await session.execute(stmt_dr)).scalar_one()

        stmt_enc = select(EncounterProduction).where(EncounterProduction.encounter_code == "ENC-DEMO-2026")
        demo_enc = (await session.execute(stmt_enc)).scalar_one_or_none()
        if not demo_enc:
            demo_enc = EncounterProduction(
                encounter_code="ENC-DEMO-2026",
                patient_id=demo_p.id,
                doctor_id=dr.id,
                queue_number=1,
                clinic_room_number="PK-NOI-101",
                status="IN_CONSULTATION",
                chief_complaint="Sốt nhẹ, đau rát họng, ho khan 3 ngày",
            )
            session.add(demo_enc)
            await session.flush()

        await session.commit()
        print("Demo database successfully initialized!")


if __name__ == "__main__":
    asyncio.run(seed())
