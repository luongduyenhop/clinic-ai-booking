import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def seed_rooms():
    async with AsyncSessionLocal() as s:
        # 1. Create table phong_kham if not exists
        await s.execute(text("""
            CREATE TABLE IF NOT EXISTS phong_kham (
                id SERIAL PRIMARY KEY,
                ma_phong VARCHAR(50) UNIQUE NOT NULL,
                ten_phong VARCHAR(100) NOT NULL,
                chuyen_khoa_id INTEGER REFERENCES chuyen_khoa(id) ON DELETE SET NULL,
                tang VARCHAR(20) DEFAULT 'Tầng 1' NOT NULL,
                loai_phong VARCHAR(30) DEFAULT 'kham_benh' NOT NULL,
                thiet_bi_chinh TEXT,
                is_active BOOLEAN DEFAULT TRUE NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
            );
        """))

        # 2. Add columns to lich_lam_viec one by one
        await s.execute(text("ALTER TABLE lich_lam_viec ADD COLUMN IF NOT EXISTS phong_kham_id INTEGER REFERENCES phong_kham(id) ON DELETE SET NULL;"))
        await s.execute(text("ALTER TABLE lich_lam_viec ADD COLUMN IF NOT EXISTS han_muc_dat_truoc INTEGER DEFAULT 6 NOT NULL;"))
        await s.execute(text("ALTER TABLE lich_lam_viec ADD COLUMN IF NOT EXISTS han_muc_vang_lai INTEGER DEFAULT 2 NOT NULL;"))
        await s.execute(text("CREATE INDEX IF NOT EXISTS idx_lich_lam_viec_phong_kham ON lich_lam_viec (phong_kham_id);"))
        await s.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_room_shift ON lich_lam_viec (phong_kham_id, ngay_lam_viec, ca_lam_viec) 
            WHERE phong_kham_id IS NOT NULL AND is_active = true;
        """))

        # 3. Seed initial examination and clinical rooms
        depts = (await s.execute(text("SELECT id, ma_chuyen_khoa, ten_chuyen_khoa FROM chuyen_khoa;"))).fetchall()
        dept_map = {d[1]: d[0] for d in depts}
        print(f"Loaded {len(depts)} specialties from DB.")

        initial_rooms = [
            ('P101', 'Phòng Khám Nội Tổng Quát 1', dept_map.get('NOI_TONG_QUAT'), 'Tầng 1', 'kham_benh', 'Máy đo huyết áp, ống nghe chuyên dụng, giường khám tiêu chuẩn'),
            ('P102', 'Phòng Khám Nội Tổng Quát 2', dept_map.get('NOI_TONG_QUAT'), 'Tầng 1', 'kham_benh', 'Máy đo huyết áp, ống nghe, đèn soi khám'),
            ('P201', 'Phòng Khám Tim Mạch 1', dept_map.get('TIM_MACH'), 'Tầng 2', 'kham_benh', 'Máy điện tim 12 chuyển đạo, Holter huyết áp, máy siêu âm tim tại giường'),
            ('P202', 'Phòng Khám Tiêu Hóa 1', dept_map.get('TIEU_HOA'), 'Tầng 2', 'kham_benh', 'Giường khám tiêu hóa chuyên dụng, ống nghe'),
            ('P203', 'Phòng Khám Tai Mũi Họng 1', dept_map.get('TAI_MUI_HONG'), 'Tầng 2', 'kham_benh', 'Hệ thống nội soi TMH ống mềm Karl Storz, máy hút dịch'),
            ('P204', 'Phòng Khám Da Liễu 1', dept_map.get('DA_LIEU'), 'Tầng 2', 'kham_benh', 'Kính soi da Dermatoscope, đèn Wood kiểm tra nấm'),
            ('LAB01', 'Phòng Xét Nghiệm Trung Tâm', None, 'Tầng 1', 'xet_nghiem', 'Máy huyết học tự động 24 thông số, máy sinh hóa Roche Cobas'),
            ('CDHA01', 'Phòng Chẩn Đoán Hình Ảnh (X-Quang/Siêu Âm)', None, 'Tầng 1', 'chan_doan_hinh_anh', 'Máy X-quang kỹ thuật số DR, Máy siêu âm Doppler màu 4D'),
        ]

        for ma, ten, ck_id, tang, loai, tb in initial_rooms:
            await s.execute(text("""
                INSERT INTO phong_kham (ma_phong, ten_phong, chuyen_khoa_id, tang, loai_phong, thiet_bi_chinh, is_active)
                VALUES (:ma, :ten, :ck_id, :tang, :loai, :tb, true)
                ON CONFLICT (ma_phong) DO UPDATE SET 
                    ten_phong = EXCLUDED.ten_phong,
                    chuyen_khoa_id = EXCLUDED.chuyen_khoa_id,
                    thiet_bi_chinh = EXCLUDED.thiet_bi_chinh;
            """), {'ma': ma, 'ten': ten, 'ck_id': ck_id, 'tang': tang, 'loai': loai, 'tb': tb})

        # 4. Map existing shifts without rooms to rooms based on doctor specialty
        await s.execute(text("""
            UPDATE lich_lam_viec llv
            SET phong_kham_id = pk.id
            FROM bac_si bs
            JOIN phong_kham pk ON pk.chuyen_khoa_id = bs.chuyen_khoa_id
            WHERE llv.bac_si_id = bs.id AND llv.phong_kham_id IS NULL AND pk.ma_phong IN ('P101', 'P201', 'P202', 'P203', 'P204');
        """))

        await s.commit()

        rooms = (await s.execute(text("SELECT id, ma_phong, ten_phong, tang, loai_phong FROM phong_kham ORDER BY ma_phong;"))).fetchall()
        print(f"Successfully seeded {len(rooms)} clinic rooms:")
        for r in rooms:
            print(f" -> [{r[1]}] {r[2]} ({r[3]} - {r[4]})")

if __name__ == "__main__":
    asyncio.run(seed_rooms())
