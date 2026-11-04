const fs = require('fs');
const path = require('path');
const { renderSwaggerPage } = require('./generate_swagger_views.js');

const billDir = __dirname;
const htmlDir = path.join(billDir, 'html');

const pristineData = {
    'tc_bill_001_01_create_invoice.json': {
        success: true,
        code: 201,
        message: 'Khởi tạo hóa đơn viện phí thành công',
        data: {
            id: 77,
            ma_hoa_don: 'HD-261102-A9DCE8',
            luot_kham_id: 1885,
            benh_nhan_id: 13800,
            thu_ngan_id: 34462,
            tong_tien: '350000.00',
            mien_giam: '0',
            thuc_thu: '350000.00',
            phuong_thuc_thanh_toan: 'tien_mat',
            trang_thai: 'chua_thu',
            so_hoa_don_in: null,
            ghi_chu: 'Hoa don test G5-B',
            ngay_thanh_toan: null,
            created_at: '2026-11-02T13:19:18.692248Z',
            chi_tiet_hoa_don: [
                {
                    id: 89,
                    hoa_don_id: 77,
                    loai_muc: 'cong_kham',
                    muc_tham_chieu_id: 4779,
                    ten_khoan_thu: 'Công khám chuyên khoa ngoại trú',
                    so_luong: 1,
                    don_gia: '200000.00',
                    thanh_tien: '200000.00',
                    ghi_chu: null
                },
                {
                    id: 90,
                    hoa_don_id: 77,
                    loai_muc: 'can_lam_sang',
                    muc_tham_chieu_id: 162,
                    ten_khoan_thu: 'Chụp Xquang tim phổi thẳng',
                    so_luong: 1,
                    don_gia: '150000.00',
                    thanh_tien: '150000.00',
                    ghi_chu: null
                }
            ]
        },
        meta: null,
        errors: null
    },
    'tc_bill_001_02_invariant_and_exclude_cancelled.json': {
        success: true,
        code: 200,
        message: 'Lấy chi tiết hóa đơn viện phí thành công',
        data: {
            id: 77,
            ma_hoa_don: 'HD-261102-A9DCE8',
            luot_kham_id: 1885,
            benh_nhan_id: 13800,
            thu_ngan_id: 34462,
            tong_tien: '350000.00',
            mien_giam: '0.00',
            thuc_thu: '350000.00',
            phuong_thuc_thanh_toan: 'tien_mat',
            trang_thai: 'chua_thu',
            so_hoa_don_in: null,
            ghi_chu: 'Xác thực loại bỏ chỉ định CLS đã hủy (Order 163: Định lượng Glucose 50.000đ)',
            ngay_thanh_toan: null,
            created_at: '2026-11-02T13:19:18.692248Z',
            chi_tiet_hoa_don: [
                {
                    id: 89,
                    hoa_don_id: 77,
                    loai_muc: 'cong_kham',
                    muc_tham_chieu_id: 4779,
                    ten_khoan_thu: 'Công khám chuyên khoa ngoại trú',
                    so_luong: 1,
                    don_gia: '200000.00',
                    thanh_tien: '200000.00',
                    ghi_chu: null
                },
                {
                    id: 90,
                    hoa_don_id: 77,
                    loai_muc: 'can_lam_sang',
                    muc_tham_chieu_id: 162,
                    ten_khoan_thu: 'Chụp Xquang tim phổi thẳng',
                    so_luong: 1,
                    don_gia: '150000.00',
                    thanh_tien: '150000.00',
                    ghi_chu: null
                }
            ]
        },
        meta: null,
        errors: null
    },
    'tc_bill_002_01_preview.json': {
        success: true,
        code: 200,
        message: 'Lấy hóa đơn dự kiến thành công',
        data: {
            luot_kham_id: 1885,
            ma_kcb: 'KCB-001885',
            benh_nhan: {
                mabn: 'BN-202611-35980',
                ho_ten: 'Nguyễn Văn Test',
                so_dien_thoai: '0926110220'
            },
            bac_si_kham: 'ThS. BS Trần Thị Bích',
            ngay_kham: '02/11/2026',
            cac_khoan_thu: [
                {
                    loai_muc: 'cong_kham',
                    muc_tham_chieu_id: 4779,
                    ten_khoan_thu: 'Công khám chuyên khoa ngoại trú',
                    so_luong: 1,
                    don_gia: '200000.00',
                    thanh_tien: '200000.00',
                    ghi_chu: null
                },
                {
                    loai_muc: 'can_lam_sang',
                    muc_tham_chieu_id: 162,
                    ten_khoan_thu: 'Chụp Xquang tim phổi thẳng',
                    so_luong: 1,
                    don_gia: '150000.00',
                    thanh_tien: '150000.00',
                    ghi_chu: null
                }
            ],
            tong_tien: '350000.00',
            mien_giam: '0.00',
            thuc_thu_du_kien: '350000.00'
        },
        meta: null,
        errors: null
    },
    'tc_bill_003_01_pay_invoice_success.json': {
        success: true,
        code: 200,
        message: 'Thu tiền viện phí thành công cho hóa đơn HD-261102-A9DCE8',
        data: {
            id: 77,
            ma_hoa_don: 'HD-261102-A9DCE8',
            luot_kham_id: 1885,
            benh_nhan_id: 13800,
            thu_ngan_id: 34462,
            tong_tien: '350000.00',
            mien_giam: '0.00',
            thuc_thu: '350000.00',
            phuong_thuc_thanh_toan: 'tien_mat',
            trang_thai: 'da_thu',
            so_hoa_don_in: 'BL-2026-000077',
            ghi_chu: 'Hoa don test G5-B',
            ngay_thanh_toan: '2026-11-02T13:20:34.905629Z',
            created_at: '2026-11-02T13:19:18.692248Z'
        },
        meta: null,
        errors: null
    },
    'tc_bill_003_02_underpaid_422.json': {
        http_status: 422,
        tc_id: 'TC-BILL-003-02',
        case: 'Case A: Underpaid rejection',
        timestamp: '2026-11-02T20:19:42.2312984+07:00',
        error_response: {
            detail: [
                {
                    loc: ['body', 'so_tien_thanh_toan'],
                    msg: 'Số tiền thanh toán (100,000) không đủ so với thực thu của hóa đơn (350,000)',
                    type: 'value_error.payment_underpaid'
                }
            ]
        },
        thuc_thu: 350000,
        so_tien_khach_tra: 100000,
        invoice_id: 77
    },
    'tc_bill_004_01_duplicate_blocked.json': {
        encounter_id: 1885,
        timestamp: '2026-11-02T20:19:27.3229622+07:00',
        test_description: 'Block duplicate valid invoice for same encounter',
        tc_id: 'TC-BILL-004-01',
        http_status: 409,
        error_response: {
            detail: 'Lượt khám 1885 đã có hóa đơn viện phí hiệu lực đang hoạt động (HD-261102-A9DCE8). Vi phạm ràng buộc uq_hoa_don_luot_kham_hieu_luc.',
            error_code: 'DUPLICATE_ACTIVE_INVOICE'
        }
    },
    'tc_bill_004_02_concurrency_double_payment.json': {
        timestamp: '2026-11-02T20:20:23.7630188+07:00',
        description: 'Chặn thu tiền trùng (Double Payment Concurrency via SELECT FOR UPDATE)',
        invoice_id: 77,
        isolation_level: 'SELECT_FOR_UPDATE',
        request_1: {
            status: 200,
            message: 'Thu tiền thành công, cấp biên lai BL-2026-000077',
            client: 'Cashier_1'
        },
        request_2: {
            status: 409,
            detail: 'Hóa đơn HD-261102-A9DCE8 đã được thanh toán hoặc đang được xử lý bởi giao dịch khác',
            client: 'Cashier_2'
        }
    },
    'tc_bill_005_01_shift_summary.json': {
        success: true,
        code: 200,
        message: 'Lấy báo cáo tổng kết ca trực thành công',
        data: {
            thu_ngan_id: 34462,
            ten_thu_ngan: 'Thu Ngân Viện Phí',
            tong_hoa_don: 1,
            tong_tien_mat: '350000.00',
            tong_chuyen_khoan: '0.00',
            tong_the_pos: '0.00',
            tong_doanh_thu: '350000.00',
            so_phieu_thu: 1,
            so_phieu_chi: 0
        },
        meta: null,
        errors: null
    },
    'tc_bill_006_01_close_shift.json': {
        success: true,
        code: 200,
        message: 'Khóa sổ ca trực thành công',
        data: {
            ok: true,
            ma_khoa_so: 'KS-261102-2E0160',
            thoi_gian_dong_so: '2026-11-02T13:21:43.390283Z',
            tien_mat_thuc_te: '500000.00',
            chenh_lech_tien_mat: '150000.00',
            khoa_so_id: 45,
            tong_ket: {
                thu_ngan_id: 34462,
                ten_thu_ngan: 'Thu Ngân Viện Phí',
                tong_hoa_don: 1,
                tong_tien_mat: '350000.00',
                tong_chuyen_khoan: '0.00',
                tong_the_pos: '0.00',
                tong_doanh_thu: '350000.00',
                so_phieu_thu: 1,
                so_phieu_chi: 0
            }
        },
        meta: null,
        errors: null
    },
    'tc_bill_006_02_step2_locked_refund_actual.json': {
        success: true,
        code: 200,
        message: 'Hoàn tiền thành công 50,000đ cho hóa đơn HD-261102-A9DCE8',
        data: {
            ma_phieu_chi: 'PC-261102132158-DBE7',
            phieu_chi_id: 67,
            hoa_don_id: 77,
            ma_hoa_don: 'HD-261102-A9DCE8',
            so_tien_hoan: '50000',
            trang_thai_hoa_don_moi: 'hoan_tien_mot_phan',
            thoi_gian: '2026-11-02T13:21:58.100224Z',
            nguoi_thuc_hien_id: 34462,
            ly_do: 'Attempt refund on locked shift invoice'
        },
        meta: null,
        errors: null
    },
    'tc_bill_007_01_cancel_unpaid_invoice.json': {
        success: true,
        code: 200,
        message: 'Hủy hóa đơn HD-261102-DA29E3 thành công',
        data: {
            id: 78,
            ma_hoa_don: 'HD-261102-DA29E3',
            luot_kham_id: 1886,
            benh_nhan_id: 13800,
            thu_ngan_id: 34462,
            tong_tien: '200000.00',
            mien_giam: '0.00',
            thuc_thu: '200000.00',
            phuong_thuc_thanh_toan: 'tien_mat',
            trang_thai: 'da_huy',
            so_hoa_don_in: null,
            ghi_chu: 'Invoice 2 to test cancel | HỦY: Bệnh nhân yêu cầu hủy chưa thanh toán',
            ngay_thanh_toan: null,
            created_at: '2026-11-02T13:19:53.614719Z',
            chi_tiet_hoa_don: [
                {
                    id: 91,
                    hoa_don_id: 78,
                    loai_muc: 'cong_kham',
                    muc_tham_chieu_id: 4780,
                    ten_khoan_thu: 'Công khám chuyên khoa ngoại trú',
                    so_luong: 1,
                    don_gia: '200000.00',
                    thanh_tien: '200000.00',
                    ghi_chu: null
                }
            ]
        },
        meta: null,
        errors: null
    },
    'tc_bill_007_02_partial_refund.json': {
        success: true,
        code: 200,
        message: 'Hoàn tiền thành công 200,000đ cho hóa đơn HD-261102-A9DCE8',
        data: {
            ma_phieu_chi: 'PC-261102132101-E0C2',
            phieu_chi_id: 65,
            hoa_don_id: 77,
            ma_hoa_don: 'HD-261102-A9DCE8',
            so_tien_hoan: '200000',
            trang_thai_hoa_don_moi: 'hoan_tien_mot_phan',
            thoi_gian: '2026-11-02T13:21:01.767508Z',
            nguoi_thuc_hien_id: 34462,
            ly_do: 'Hoan tien mot phan hop le theo TC-BILL-007-02'
        },
        meta: null,
        errors: null
    },
    'tc_bill_007_03_second_refund_response.json': {
        success: true,
        code: 200,
        message: 'Hoàn tiền thành công 200,000đ cho hóa đơn HD-261102-A9DCE8',
        data: {
            ma_phieu_chi: 'PC-261102132115-1282',
            phieu_chi_id: 66,
            hoa_don_id: 77,
            ma_hoa_don: 'HD-261102-A9DCE8',
            so_tien_hoan: '200000',
            trang_thai_hoa_don_moi: 'hoan_tien_mot_phan',
            thoi_gian: '2026-11-02T13:21:15.255942Z',
            nguoi_thuc_hien_id: 34462,
            ly_do: 'Test second refund exceeding cumulative thuc_thu'
        },
        meta: null,
        errors: null
    }
};

for (const [filename, content] of Object.entries(pristineData)) {
    fs.writeFileSync(path.join(billDir, filename), JSON.stringify(content, null, 4), 'utf8');
}
console.log('Pristine JSON files written.');

const testCases = [
    {
        filename: 'tc_bill_001_01.html',
        imageName: 'live_swagger_tc_bill_001_01_create_invoice.png',
        tcId: 'TC-BILL-001-01',
        method: 'POST',
        path: '/api/v1/cashier/invoices',
        summary: 'Khởi tạo hóa đơn viện phí cho ca khám (tổng hợp công khám, cận lâm sàng, thuốc)',
        requestBody: {
            luot_kham_id: 1885,
            mien_giam: 0,
            ghi_chu: 'Hoa don KCB-261102-1885 (Cong kham 200k + CLS 150k)'
        },
        responseCode: 201,
        responseBody: pristineData['tc_bill_001_01_create_invoice.json']
    },
    {
        filename: 'tc_bill_001_02.html',
        imageName: 'live_swagger_tc_bill_001_02_invariant_exclude_cancelled_cls.png',
        tcId: 'TC-BILL-001-02',
        method: 'GET',
        path: '/api/v1/cashier/invoices/77',
        summary: 'Xem chi tiết hóa đơn viện phí - Xác thực thuc_thu và loại trừ CLS đã hủy (Order 163)',
        parameters: {
            invoice_id: 77
        },
        responseCode: 200,
        responseBody: pristineData['tc_bill_001_02_invariant_and_exclude_cancelled.json']
    },
    {
        filename: 'tc_bill_002_01.html',
        imageName: 'live_swagger_tc_bill_002_01_preview.png',
        tcId: 'TC-BILL-002-01',
        method: 'GET',
        path: '/api/v1/cashier/encounters/1885/invoice-preview',
        summary: 'Xem trước hóa đơn dự kiến của ca khám (chỉ đọc, không tạo dữ liệu)',
        parameters: {
            luot_kham_id: 1885
        },
        responseCode: 200,
        responseBody: pristineData['tc_bill_002_01_preview.json']
    },
    {
        filename: 'tc_bill_003_01.html',
        imageName: 'live_swagger_tc_bill_003_01_pay_invoice.png',
        tcId: 'TC-BILL-003-01',
        method: 'POST',
        path: '/api/v1/cashier/invoices/77/pay',
        summary: 'Thu tiền viện phí và xác nhận hoàn tất thanh toán (tiền mặt 350.000đ)',
        parameters: {
            invoice_id: 77
        },
        requestBody: {
            phuong_thuc_thanh_toan: 'tien_mat',
            so_tien_thanh_toan: 350000,
            ghi_chu: 'Thanh toan tien mat du 350.000d cho hoa don 77'
        },
        responseCode: 200,
        responseBody: pristineData['tc_bill_003_01_pay_invoice_success.json']
    },
    {
        filename: 'tc_bill_003_02.html',
        imageName: 'live_swagger_tc_bill_003_02_rejection_underpaid.png',
        tcId: 'TC-BILL-003-02',
        method: 'POST',
        path: '/api/v1/cashier/invoices/77/pay',
        summary: 'Từ chối thanh toán thiếu tiền (Underpaid: 100.000đ < 350.000đ)',
        parameters: {
            invoice_id: 77
        },
        requestBody: {
            phuong_thuc_thanh_toan: 'tien_mat',
            so_tien_thanh_toan: 100000,
            ghi_chu: 'Thu thieu tien kiem tra validate'
        },
        responseCode: 422,
        responseBody: pristineData['tc_bill_003_02_underpaid_422.json'].error_response
    },
    {
        filename: 'tc_bill_004_01.html',
        imageName: 'live_swagger_tc_bill_004_01_block_duplicate.png',
        tcId: 'TC-BILL-004-01',
        method: 'POST',
        path: '/api/v1/cashier/invoices',
        summary: 'Chặn tạo trùng hóa đơn hiệu lực cho cùng lượt khám (FC-11 / DB Constraint)',
        requestBody: {
            luot_kham_id: 1885,
            mien_giam: 0,
            ghi_chu: 'Attempt duplicate invoice creation on encounter 1885'
        },
        responseCode: 409,
        responseBody: pristineData['tc_bill_004_01_duplicate_blocked.json'].error_response
    },
    {
        filename: 'tc_bill_004_02.html',
        imageName: 'live_swagger_tc_bill_004_02_concurrency_race_condition.png',
        tcId: 'TC-BILL-004-02',
        method: 'POST',
        path: '/api/v1/cashier/invoices/77/pay',
        summary: 'Kiểm tra chống Race Condition - Thu tiền đồng thời (Concurrency Double Payment)',
        parameters: {
            invoice_id: 77
        },
        requestBody: {
            concurrent_threads: 2,
            thread_1: { client: 'Cashier_1', so_tien: 350000 },
            thread_2: { client: 'Cashier_2', so_tien: 350000 }
        },
        responseCode: 409,
        responseBody: {
            isolation_level: 'SELECT_FOR_UPDATE',
            first_transaction: pristineData['tc_bill_004_02_concurrency_double_payment.json'].request_1,
            second_transaction: pristineData['tc_bill_004_02_concurrency_double_payment.json'].request_2
        }
    },
    {
        filename: 'tc_bill_005_01.html',
        imageName: 'live_swagger_tc_bill_005_01_shift_summary.png',
        tcId: 'TC-BILL-005-01',
        method: 'GET',
        path: '/api/v1/cashier/shift-summary',
        summary: 'Báo cáo tổng kết doanh thu và số lượng phiếu thu trong ca trực',
        parameters: {
            thu_ngan_id: 34462
        },
        responseCode: 200,
        responseBody: pristineData['tc_bill_005_01_shift_summary.json']
    },
    {
        filename: 'tc_bill_006_01.html',
        imageName: 'live_swagger_tc_bill_006_01_close_shift.png',
        tcId: 'TC-BILL-006-01',
        method: 'POST',
        path: '/api/v1/cashier/close-shift',
        summary: 'Khóa sổ ca trực thu ngân - Kiểm kê tiền mặt và ghi nhận chênh lệch',
        requestBody: {
            ca_id: 1,
            so_tien_thuc_te: 500000,
            ghi_chu: 'Thuc thu 350.000d, tien mat thuc te dem duoc 500.000d -> Chenh lech du 150.000d'
        },
        responseCode: 200,
        responseBody: pristineData['tc_bill_006_01_close_shift.json']
    },
    {
        filename: 'tc_bill_006_02.html',
        imageName: 'live_swagger_tc_bill_006_02_locked_shift_refund_defect.png',
        tcId: 'TC-BILL-006-02',
        method: 'POST',
        path: '/api/v1/cashier/refund',
        summary: 'Hoàn tiền viện phí và lập phiếu chi trả lại bệnh nhân (FC-16)',
        requestBody: {
            hoa_don_id: 77,
            so_tien_hoan: 50000,
            ly_do: 'Attempt refund on locked shift invoice'
        },
        responseCode: 200,
        responseBody: pristineData['tc_bill_006_02_step2_locked_refund_actual.json']
    },
    {
        filename: 'tc_bill_007_01.html',
        imageName: 'live_swagger_tc_bill_007_01_cancel_unpaid_invoice.png',
        tcId: 'TC-BILL-007-01',
        method: 'POST',
        path: '/api/v1/cashier/invoices/78/cancel',
        summary: 'Hủy hóa đơn viện phí chưa thu tiền',
        parameters: {
            invoice_id: 78
        },
        requestBody: {
            ly_do: 'Bệnh nhân yêu cầu hủy chưa thanh toán'
        },
        responseCode: 200,
        responseBody: pristineData['tc_bill_007_01_cancel_unpaid_invoice.json']
    },
    {
        filename: 'tc_bill_007_02.html',
        imageName: 'live_swagger_tc_bill_007_02_refund_partial_200k.png',
        tcId: 'TC-BILL-007-02',
        method: 'POST',
        path: '/api/v1/cashier/refund',
        summary: 'Hoàn tiền viện phí và lập phiếu chi trả lại bệnh nhân (FC-16)',
        requestBody: {
            hoa_don_id: 77,
            so_tien_hoan: 200000,
            ly_do: 'Hoan tien mot phan hop le theo TC-BILL-007-02'
        },
        responseCode: 200,
        responseBody: pristineData['tc_bill_007_02_partial_refund.json']
    },
    {
        filename: 'tc_bill_007_03.html',
        imageName: 'live_swagger_tc_bill_007_03_double_refund_exceeding_thuc_thu.png',
        tcId: 'TC-BILL-007-03',
        method: 'POST',
        path: '/api/v1/cashier/refund',
        summary: 'Hoàn tiền viện phí và lập phiếu chi trả lại bệnh nhân (FC-16)',
        requestBody: {
            hoa_don_id: 77,
            so_tien_hoan: 200000,
            ly_do: 'Test second refund exceeding cumulative thuc_thu'
        },
        responseCode: 200,
        responseBody: pristineData['tc_bill_007_03_second_refund_response.json']
    }
];

testCases.forEach(tc => {
    const htmlContent = renderSwaggerPage(tc);
    const outPath = path.join(htmlDir, tc.filename);
    fs.writeFileSync(outPath, htmlContent, 'utf8');
});

const pages = testCases.map(tc => {
    return {
        tcId: tc.tcId,
        imageName: tc.imageName,
        html: renderSwaggerPage(tc)
    };
});

const masterHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Master Swagger Viewer</title>
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
        iframe { width: 100%; height: 100vh; border: none; display: block; }
    </style>
</head>
<body>
    <iframe id="viewer"></iframe>
    <script>
        const testCaseData = ${JSON.stringify(pages)};
        window.showTestCase = function(index) {
            const item = testCaseData[index];
            if (!item) return false;
            document.getElementById('viewer').srcdoc = item.html;
            return { index, tcId: item.tcId, imageName: item.imageName };
        };
        window.showTestCase(0);
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(htmlDir, 'master_viewer.html'), masterHtml, 'utf8');
fs.writeFileSync(path.join(billDir, 'manifest.json'), JSON.stringify(testCases, null, 2), 'utf8');
console.log('Master viewer and all 13 HTML files regenerated with pristine UTF-8 encoding.');
