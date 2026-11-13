import test from 'node:test'
import assert from 'node:assert/strict'

const removeVietnameseTones = (str) =>
    String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim()

const checkDuplicateCode = (formData, currentList, key) => {
    let codeToCheck = ''
    let codeLabel = 'Mã'
    if (key === 'chuyenKhoa') {
        codeToCheck = (formData.maChuyenKhoa || formData.ma || '').trim().toUpperCase()
        codeLabel = 'Mã chuyên khoa'
    } else if (key === 'danhMucBenh') {
        codeToCheck = (formData.maICD || '').trim().toUpperCase()
        codeLabel = 'Mã bệnh ICD-10'
    } else if (key === 'thuocVatTu') {
        codeToCheck = (formData.maThuoc || '').trim().toUpperCase()
        codeLabel = 'Mã thuốc'
    } else if (key === 'dichVu') {
        codeToCheck = (formData.maDV || '').trim().toUpperCase()
        codeLabel = 'Mã dịch vụ'
    } else if (key === 'khoaPhong') {
        codeToCheck = (formData.maPhong || '').trim().toUpperCase()
        codeLabel = 'Mã phòng'
    } else if (key === 'diaChi') {
        codeToCheck = (formData.maTinh || '').trim().toUpperCase()
        codeLabel = 'Mã Tỉnh / TP'
    } else {
        codeToCheck = (formData.ma || '').trim().toUpperCase()
        codeLabel = 'Mã danh mục'
    }

    if (!codeToCheck) {
        return `${codeLabel} không được để trống!`
    }

    const isDup = currentList.some((item) => {
        if (item.id === formData.id && formData.id) return false
        const itemCode = (
            item.maChuyenKhoa ||
            item.maICD ||
            item.maThuoc ||
            item.maDV ||
            item.maPhong ||
            item.maTinh ||
            item.ma ||
            ''
        )
            .trim()
            .toUpperCase()
        return itemCode === codeToCheck
    })

    if (isDup) {
        return `${codeLabel} "${codeToCheck}" đã tồn tại trong hệ thống! Vui lòng chọn hoặc nhập mã khác.`
    }
    return null
}

const filterCatalogList = (list, searchText) => {
    if (!searchText.trim()) return list
    const searchRaw = searchText.toLowerCase().trim()
    const searchNorm = removeVietnameseTones(searchText)
    return list.filter((item) => {
        const rawJson = JSON.stringify(item).toLowerCase()
        const normJson = removeVietnameseTones(rawJson)
        return rawJson.includes(searchRaw) || normJson.includes(searchNorm)
    })
}

test('Tìm kiếm không dấu tiếng Việt hoạt động chính xác cho ICD-10 và Thuốc', () => {
    const mockList = [
        { maICD: 'I10', tenBenh: 'Bệnh tăng huyết áp vô căn' },
        { maICD: 'J02.9', tenBenh: 'Viêm họng cấp không xác định' },
        { maThuoc: 'TH001', tenThuoc: 'Amlodipin 5mg', hoatChat: 'Amlodipin besylat' },
        { maThuoc: 'TH003', tenThuoc: 'Augmentin 1g', hoatChat: 'Amoxicillin + Acid Clavulanic' },
    ]

    const res1 = filterCatalogList(mockList, 'tang huyet ap')
    assert.equal(res1.length, 1)
    assert.equal(res1[0].maICD, 'I10')

    const res2 = filterCatalogList(mockList, 'viem hong')
    assert.equal(res2.length, 1)
    assert.equal(res2[0].maICD, 'J02.9')

    const res3 = filterCatalogList(mockList, 'AUGMENTIN')
    assert.equal(res3.length, 1)
    assert.equal(res3[0].maThuoc, 'TH003')
})

test('Validation chặn trùng mã ICD-10, Thuốc và Dịch vụ', () => {
    const mockIcdList = [
        { id: '1', maICD: 'I10', tenBenh: 'Tăng huyết áp' },
        { id: '2', maICD: 'J00', tenBenh: 'Viêm mũi họng cấp' },
    ]

    const errDup = checkDuplicateCode({ id: '', maICD: 'i10' }, mockIcdList, 'danhMucBenh')
    assert.ok(errDup.includes('đã tồn tại'))

    const errValid = checkDuplicateCode({ id: '', maICD: 'E11' }, mockIcdList, 'danhMucBenh')
    assert.equal(errValid, null)

    const errSelf = checkDuplicateCode({ id: '1', maICD: 'I10' }, mockIcdList, 'danhMucBenh')
    assert.equal(errSelf, null)

    const errEmpty = checkDuplicateCode({ id: '', maICD: '' }, mockIcdList, 'danhMucBenh')
    assert.ok(errEmpty.includes('không được để trống'))
})

test('Kiểm tra trạng thái bôi xám (Soft Delete / Inactive) bảo toàn bản ghi', () => {
    const itemActive = { id: 'PK01', maPhong: 'PK01', trangThai: true, is_active: true }
    const itemInactive = { id: 'PK02', maPhong: 'PK02', trangThai: false, is_active: false }

    assert.equal(itemActive.trangThai !== false && itemActive.is_active !== false, true)
    assert.equal(itemInactive.trangThai !== false && itemInactive.is_active !== false, false)
})

test('Lọc bác sĩ chặt chẽ theo chuyên khoa và không xổ hết danh sách khi chưa chọn khoa', () => {
    const mockStaff = [
        { hoTen: 'BS.CKII Nguyễn Minh Hoàng', vaiTro: 'Admin / Phụ trách chuyên môn', chuyenKhoa: 'Khoa Nội tổng quát' },
        { hoTen: 'ThS.BS Trần Quốc Tuấn', vaiTro: 'Bác sĩ khám bệnh', chuyenKhoa: 'Khoa Tai Mũi Họng' },
        { hoTen: 'BS.CKI Lê Thu Trang', vaiTro: 'Bác sĩ khám bệnh', chuyenKhoa: 'Cơ xương khớp' },
        { hoTen: 'ThS. BS Đặng Hải Phương', vaiTro: 'Bác sĩ khám bệnh', chuyenKhoa: 'Khoa Ngoại' },
        { hoTen: 'Nguyễn Mai Phương', vaiTro: 'Lễ tân - Tiếp đón', chuyenKhoa: 'Hành chính' },
    ]

    const filterDoctors = (staff, selectedChuyenKhoa) => {
        const onlyDoctors = staff.filter((s) => {
            const role = String(s.vaiTro || '').toLowerCase()
            if (role.includes('lễ tân') || role.includes('hành chính')) return false
            return role.includes('bác sĩ') || role.includes('chuyên môn')
        })
        if (!selectedChuyenKhoa || !selectedChuyenKhoa.trim()) return []

        const norm = (str) =>
            String(str || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .toLowerCase()
                .replace(/khoa\s*/g, '')
                .trim()

        const selectedDept = norm(selectedChuyenKhoa)
        return onlyDoctors.filter((doc) => {
            const docDept = norm(doc.chuyenKhoa)
            return docDept && (docDept.includes(selectedDept) || selectedDept.includes(docDept))
        })
    }

    const emptyDeptDocs = filterDoctors(mockStaff, '')
    assert.equal(emptyDeptDocs.length, 0)

    const ngoaiDocs = filterDoctors(mockStaff, 'Khoa Ngoại')
    assert.equal(ngoaiDocs.length, 1)
    assert.equal(ngoaiDocs[0].hoTen, 'ThS. BS Đặng Hải Phương')

    const tmhDocs = filterDoctors(mockStaff, 'Khoa Tai Mũi Họng')
    assert.equal(tmhDocs.length, 1)
    assert.equal(tmhDocs[0].hoTen, 'ThS.BS Trần Quốc Tuấn')

    const allFiltered = filterDoctors(mockStaff, 'Hành chính')
    assert.equal(allFiltered.length, 0)
})

test('Độc nhất hóa định danh buồng khám: PK01 và P101 không bị chọn trùng cùng lúc', () => {
    const getItemUniqueKey = (item) => {
        if (!item) return ''
        return String(
            item.maPhong ||
            item.maDV ||
            item.maThuoc ||
            item.maICD ||
            item.maTinh ||
            item.ma ||
            item.id ||
            ''
        ).trim().toUpperCase()
    }

    const roomPK01 = { id: 'KP-01', maPhong: 'PK01', tenPhong: 'Phòng số 1 (Phòng khám Nội)' }
    const roomP101 = { id: 'KP-01', maPhong: 'P101', tenPhong: 'Phòng Khám Nội Tổng Quát 1' }

    const keyPK01 = getItemUniqueKey(roomPK01)
    const keyP101 = getItemUniqueKey(roomP101)

    assert.equal(keyPK01, 'PK01')
    assert.equal(keyP101, 'P101')
    assert.notEqual(keyPK01, keyP101)

    const selectedForm = { ...roomPK01 }
    const selectedKey = getItemUniqueKey(selectedForm)

    const isPK01Selected = Boolean(selectedKey && keyPK01 === selectedKey)
    const isP101Selected = Boolean(selectedKey && keyP101 === selectedKey)

    assert.equal(isPK01Selected, true)
    assert.equal(isP101Selected, false)
})

test('Danh mục Chuyên khoa lâm sàng: nhận diện định danh duy nhất và phát hiện trùng mã', () => {
    const getItemUniqueKey = (item) => {
        if (!item) return ''
        return String(
            item.maChuyenKhoa ||
            item.maPhong ||
            item.maDV ||
            item.maThuoc ||
            item.maICD ||
            item.maTinh ||
            item.ma ||
            item.id ||
            ''
        ).trim().toUpperCase()
    }

    const depts = [
        { id: 'CK-1', maChuyenKhoa: 'KHOA_NOI', tenChuyenKhoa: 'Khoa Nội tổng quát', trangThai: true },
        { id: 'CK-4', maChuyenKhoa: 'KHOA_TMH', tenChuyenKhoa: 'Khoa Tai Mũi Họng', trangThai: true },
        { id: 'CK-114', maChuyenKhoa: 'KHOA_NGOAI', tenChuyenKhoa: 'Khoa Ngoại', trangThai: true },
    ]

    assert.equal(getItemUniqueKey(depts[0]), 'KHOA_NOI')
    assert.equal(getItemUniqueKey(depts[1]), 'KHOA_TMH')

    const dup = checkDuplicateCode({ maChuyenKhoa: 'khoa_noi' }, depts, 'chuyenKhoa')
    assert.match(dup, /đã tồn tại trong hệ thống/)

    const valid = checkDuplicateCode({ maChuyenKhoa: 'KHOA_NHI' }, depts, 'chuyenKhoa')
    assert.equal(valid, null)
})

test('Lọc chuyên khoa hoạt động: chỉ hiển thị chuyên khoa đang hoạt động trong dropdown phòng khám', () => {
    const rawSpecialties = [
        { id: 1, ma_chuyen_khoa: 'KHOA_NOI', ten_chuyen_khoa: 'Khoa Nội tổng quát', is_active: true, trangThai: true },
        { id: 2, ma_chuyen_khoa: 'KHOA_TIM_MACH', ten_chuyen_khoa: 'Tim mạch', is_active: false, trangThai: false },
        { id: 3, ma_chuyen_khoa: 'KHOA_TIEU_HOA', ten_chuyen_khoa: 'Tiêu hóa', is_active: false, trangThai: false },
        { id: 4, ma_chuyen_khoa: 'KHOA_TMH', ten_chuyen_khoa: 'Khoa Tai Mũi Họng', is_active: true, trangThai: true },
        { id: 114, ma_chuyen_khoa: 'KHOA_NGOAI', ten_chuyen_khoa: 'Khoa Ngoại', is_active: true, trangThai: true },
        { id: 115, ma_chuyen_khoa: 'KHOA_RANG', ten_chuyen_khoa: 'Khoa Răng', is_active: true, trangThai: true },
        { id: 116, ma_chuyen_khoa: 'KHOA_MAT', ten_chuyen_khoa: 'Khoa Mắt', is_active: true, trangThai: true },
        { id: 5, ma_chuyen_khoa: 'KHOA_THAN_KINH', ten_chuyen_khoa: 'Thần kinh', is_active: false, trangThai: false },
    ]

    const activeSpecialties = rawSpecialties.filter(
        (dept) => dept.is_active !== false && dept.trangThai !== false
    )

    assert.equal(activeSpecialties.length, 5)
    assert.deepEqual(
        activeSpecialties.map((d) => d.ten_chuyen_khoa),
        ['Khoa Nội tổng quát', 'Khoa Tai Mũi Họng', 'Khoa Ngoại', 'Khoa Răng', 'Khoa Mắt']
    )

    assert.equal(activeSpecialties.some((d) => d.ten_chuyen_khoa === 'Tim mạch'), false)
    assert.equal(activeSpecialties.some((d) => d.ten_chuyen_khoa === 'Tiêu hóa'), false)
    assert.equal(activeSpecialties.some((d) => d.ten_chuyen_khoa === 'Thần kinh'), false)
})

test('getNavigationConfig đảm bảo luôn có Danh mục Chuyên khoa trong sidebarSections', async () => {
    const { getNavigationConfig } = await import('../src/utils/helpers/clinicConfigHelpers.js')

    const legacyClinicData = {
        navigationConfig: {
            sidebarSections: [
                { id: 'pillar-executive', title: '1. ĐIỀU HÀNH & THỐNG KÊ BI', menus: [] },
                {
                    id: 'pillar-catalogs',
                    title: '2. QUẢN TRỊ DANH MỤC Y TẾ',
                    menus: [
                        {
                            id: 'catalogs',
                            title: 'Danh mục Nền tảng',
                            children: [
                                { label: 'Khoa phòng & Buồng khám', path: '/admin/danh-muc/khoa-phong' },
                                { label: 'Dịch vụ & Giá niêm yết', path: '/admin/danh-muc/dich-vu' },
                            ],
                        },
                    ],
                },
                { id: 'pillar-iam-hr', title: '3. NHÂN SỰ & PHÂN QUYỀN (IAM)', menus: [] },
                { id: 'pillar-compliance-settings', title: '4. TUÂN THỦ & CẤU HÌNH HỆ THỐNG', menus: [] },
            ],
        },
    }

    const config = getNavigationConfig(legacyClinicData)
    const catalogMenu = config.sidebarSections
        .find((s) => s.id === 'pillar-catalogs')
        ?.menus.find((m) => m.id === 'catalogs')

    assert.ok(catalogMenu)
    const hasChuyenKhoa = catalogMenu.children.some(
        (c) => c.path === '/admin/danh-muc/chuyen-khoa'
    )
    assert.equal(hasChuyenKhoa, true)
    assert.equal(catalogMenu.children[0].path, '/admin/danh-muc/chuyen-khoa')
})

test('Không bao giờ lặp bác sĩ trong dropdown chọn bác sĩ phụ trách buồng khám khi có khoảng trắng khác biệt', () => {
    const normDocKey = (str) =>
        String(str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .toLowerCase()
            .replace(/^(bs\.?|ths\.?|pgs\.?|ts\.?|cki{1,2}|ck1|ck2|\s)+/g, '')
            .replace(/[\s\.\-_]+/g, '')
            .trim()

    const doctorsForDepartment = [
        { id: 805, hoTen: 'BS. CKII Nguyễn Minh Hoàng', chuyenKhoa: 'Khoa Nội tổng quát' },
        { id: 1, hoTen: 'BS. CKI Nguyễn Văn An', chuyenKhoa: 'Khoa Nội tổng quát' },
        { id: 2, hoTen: 'ThS. BS Trần Thị Bích', chuyenKhoa: 'Khoa Nội tổng quát' },
    ]

    const formBacSiPhuTrach = 'BS.CKII Nguyễn Minh Hoàng'

    const targetKey = normDocKey(formBacSiPhuTrach)
    const matchedDoctorInList = doctorsForDepartment.find((d) => {
        const dName = d.hoTen || d.ho_ten || d.name || ''
        return normDocKey(dName) === targetKey
    })

    assert.ok(matchedDoctorInList)
    assert.equal(matchedDoctorInList.hoTen, 'BS. CKII Nguyễn Minh Hoàng')

    const selectValue = matchedDoctorInList ? matchedDoctorInList.hoTen : formBacSiPhuTrach
    assert.equal(selectValue, 'BS. CKII Nguyễn Minh Hoàng')

    const shouldRenderFallback = Boolean(formBacSiPhuTrach && !matchedDoctorInList)
    assert.equal(shouldRenderFallback, false)
})

test('Thông báo lỗi khi không xóa được bản ghi do có liên kết bắt buộc phải bắt đầu bằng tiền tố chuẩn', () => {
    const errorPrefix = 'Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác:'

    const sampleErrors = [
        'Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: 1 bác sĩ thuộc chuyên khoa, 3 phòng khám trực thuộc, 5 lịch khám hẹn của bệnh nhân. Vui lòng hủy liên kết hoặc chuyển sang trạng thái Tạm ngưng!',
        'Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: 2 bác sĩ đang phụ trách/phân công, 10 lịch khám hẹn của bệnh nhân. Vui lòng hủy liên kết hoặc chuyển sang trạng thái Tạm ngưng!',
        'Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: 4 chỉ định cận lâm sàng trong hồ sơ bệnh án. Vui lòng hủy liên kết hoặc chuyển sang trạng thái Tạm ngưng!',
        'Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: 8 đơn thuốc đã kê cho bệnh nhân. Vui lòng hủy liên kết hoặc chuyển sang trạng thái Tạm ngưng!',
        'Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: 15 hồ sơ chẩn đoán bệnh án của bệnh nhân. Vui lòng hủy liên kết hoặc chuyển sang trạng thái Tạm ngưng!',
        'Dữ liệu này không xóa được vì đang được liên kết với dữ liệu khác: Ràng buộc toàn vẹn cơ sở dữ liệu y tế.',
    ]

    for (const err of sampleErrors) {
        assert.equal(
            err.startsWith(errorPrefix),
            true,
            `Lỗi "${err}" phải bắt đầu bằng "${errorPrefix}"`
        )
    }
})

test('Thao tác xóa bản ghi không có liên kết lọc bỏ đúng phần tử khỏi danh sách mà không ảnh hưởng phần tử khác', () => {
    const currentList = [
        { id: 'CK-01', maChuyenKhoa: 'CK01', tenChuyenKhoa: 'Khoa Nội tổng quát' },
        { id: 'CK-99', maChuyenKhoa: 'CK99', tenChuyenKhoa: 'Khoa Thử nghiệm' },
        { id: 'CK-02', maChuyenKhoa: 'CK02', tenChuyenKhoa: 'Khoa Ngoại tổng quát' },
    ]

    const itemToDelete = { id: 'CK-99', maChuyenKhoa: 'CK99', tenChuyenKhoa: 'Khoa Thử nghiệm' }
    const formKey = (itemToDelete.maChuyenKhoa || itemToDelete.id).trim().toUpperCase()

    const updated = currentList.filter((item) => {
        const k = (item.maChuyenKhoa || item.id || '').trim().toUpperCase()
        return k !== formKey
    })

    assert.equal(updated.length, 2)
    assert.equal(updated.some((i) => i.maChuyenKhoa === 'CK99'), false)
    assert.equal(updated[0].maChuyenKhoa, 'CK01')
    assert.equal(updated[1].maChuyenKhoa, 'CK02')
})

test('Danh mục Chương bệnh ICD-10 chuẩn hóa dropdown 21-22 chương và tự động nhận diện theo mã ICD', () => {
    const detectIcdChapter = (code) => {
        const c = String(code || '').trim().toUpperCase()
        if (!c) return ''
        const ch = c[0]
        if (ch === 'A' || ch === 'B') return 'Chương I: Bệnh nhiễm trùng và ký sinh trùng'
        if (ch === 'C' || (ch === 'D' && c.length > 1 && '01234'.includes(c[1]))) return 'Chương II: Tân sinh (Khối u)'
        if (ch === 'D') return 'Chương III: Bệnh của máu và cơ quan tạo máu'
        if (ch === 'E') return 'Chương IV: Bệnh nội tiết, dinh dưỡng và chuyển hóa'
        if (ch === 'F') return 'Chương V: Rối loạn tâm thần và hành vi'
        if (ch === 'G') return 'Chương VI: Bệnh hệ thần kinh'
        if (ch === 'H' && c.length > 1 && '012345'.includes(c[1])) return 'Chương VII: Bệnh của mắt và phần phụ'
        if (ch === 'H') return 'Chương VIII: Bệnh của tai và xương chũm'
        if (ch === 'I') return 'Chương IX: Bệnh hệ tuần hoàn'
        if (ch === 'J') return 'Chương X: Bệnh hệ hô hấp'
        if (ch === 'K') return 'Chương XI: Bệnh hệ tiêu hóa'
        if (ch === 'L') return 'Chương XII: Bệnh của da và mô dưới da'
        if (ch === 'M') return 'Chương XIII: Bệnh hệ cơ-xương-khớp'
        if (ch === 'N') return 'Chương XIV: Bệnh hệ sinh dục - tiết niệu'
        if (ch === 'O') return 'Chương XV: Thai nghén, sinh đẻ và hậu sản'
        if (ch === 'P') return 'Chương XVI: Một số tình trạng trong chu sinh'
        if (ch === 'Q') return 'Chương XVII: Dị tật bẩm sinh, biến dạng'
        if (ch === 'R') return 'Chương XVIII: Triệu chứng & dấu hiệu bất thường'
        if (ch === 'S' || ch === 'T') return 'Chương XIX: Tổn thương, ngộ độc'
        if (['V', 'W', 'X', 'Y'].includes(ch)) return 'Chương XX: Nguyên nhân ngoại lai của bệnh tật'
        if (ch === 'Z') return 'Chương XXI: Yếu tố tiếp xúc dịch vụ y tế'
        if (ch === 'U') return 'Chương XXII: Mã dùng cho mục đích đặc biệt'
        return ''
    }

    assert.equal(detectIcdChapter('J02.9'), 'Chương X: Bệnh hệ hô hấp')
    assert.equal(detectIcdChapter('J20'), 'Chương X: Bệnh hệ hô hấp')
    assert.equal(detectIcdChapter('I10'), 'Chương IX: Bệnh hệ tuần hoàn')
    assert.equal(detectIcdChapter('K29.7'), 'Chương XI: Bệnh hệ tiêu hóa')
    assert.equal(detectIcdChapter('A09'), 'Chương I: Bệnh nhiễm trùng và ký sinh trùng')
    assert.equal(detectIcdChapter('E11'), 'Chương IV: Bệnh nội tiết, dinh dưỡng và chuyển hóa')
    assert.equal(detectIcdChapter('M17'), 'Chương XIII: Bệnh hệ cơ-xương-khớp')
    assert.equal(detectIcdChapter('C50'), 'Chương II: Tân sinh (Khối u)')
    assert.equal(detectIcdChapter('H81'), 'Chương VIII: Bệnh của tai và xương chũm')
    assert.equal(detectIcdChapter('H10'), 'Chương VII: Bệnh của mắt và phần phụ')
    assert.equal(detectIcdChapter('Z00.0'), 'Chương XXI: Yếu tố tiếp xúc dịch vụ y tế')
    assert.equal(detectIcdChapter('R50'), 'Chương XVIII: Triệu chứng & dấu hiệu bất thường')
    assert.equal(detectIcdChapter(''), '')
})

test('Đồng bộ Đơn vị tính (ĐVT) giữa Danh mục chung và Form Thuốc, Dịch vụ kỹ thuật', () => {
    const mockDonViTinhList = [
        { id: 'DVT-01', ma: 'VIEN', ten: 'Viên', loai: 'THUOC', trangThai: true },
        { id: 'DVT-02', ma: 'ONG', ten: 'Ống', loai: 'THUOC', trangThai: true },
        { id: 'DVT-03', ma: 'CHAI', ten: 'Chai / Lọ', loai: 'THUOC', trangThai: true },
        { id: 'DVT-04', ma: 'LAN', ten: 'Lần / Lượt', loai: 'DICH_VU', trangThai: true },
        { id: 'DVT-05', ma: 'VI', ten: 'Vỉ 10 viên', loai: 'THUOC', trangThai: true },
        { id: 'DVT-06', ma: 'CUON', ten: 'Cuộn băng gạc', loai: 'THUOC', trangThai: false },
        { id: 'DVT-07', ma: 'GOI', ten: 'Gói', loai: 'CHUNG', trangThai: true },
    ]

    const medicineUnitOptions = Array.from(
        new Set(
            mockDonViTinhList
                .filter((u) => u.trangThai !== false && u.is_active !== false)
                .filter((u) => {
                    const scope = String(u.loai || u.phamVi || '').toUpperCase()
                    return !scope || scope === 'THUOC' || scope === 'CHUNG'
                })
                .map((u) => (u.ten || u.noiDung || u.ma || '').trim())
                .filter(Boolean)
        )
    )

    assert.ok(medicineUnitOptions.includes('Vỉ 10 viên'))

    assert.ok(medicineUnitOptions.includes('Gói'))

    assert.equal(medicineUnitOptions.includes('Cuộn băng gạc'), false)

    assert.equal(medicineUnitOptions.includes('Lần / Lượt'), false)

    const oldUnit = 'Viên'
    const newUnit = 'Viên nén'
    const mockThuocList = [
        { id: 'TH001', tenThuoc: 'Augmentin 1g', dvt: 'Viên' },
        { id: 'TH002', tenThuoc: 'Paracetamol 500mg', dvt: 'Viên' },
        { id: 'TH003', tenThuoc: 'Siro Ho Prospan', dvt: 'Chai' },
    ]

    const updatedThuocList = mockThuocList.map((th) => {
        if (th.dvt === oldUnit) {
            return { ...th, dvt: newUnit }
        }
        return th
    })

    assert.equal(updatedThuocList[0].dvt, 'Viên nén')
    assert.equal(updatedThuocList[1].dvt, 'Viên nén')
    assert.equal(updatedThuocList[2].dvt, 'Chai')
})
