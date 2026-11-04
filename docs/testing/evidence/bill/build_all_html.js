const fs = require('fs');
const path = require('path');
const { renderSwaggerPage } = require('./generate_swagger_views.js');

const htmlDir = path.join(__dirname, 'html');
if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir, { recursive: true });
}

function cleanVietnameseStrings(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') {
        return obj
            .replace(/HoA\?n ti\?n thA\?nh cA'ng 200,000\? cho hA3a \?n/g, 'Hoàn tiền thành công 200,000đ cho hóa đơn')
            .replace(/Kh\?i t\?o hA3a \?n vi\?n phA- thA\?nh cA'ng/g, 'Khởi tạo hóa đơn viện phí thành công')
            .replace(/L\?y hA3a \?n d\? ki\?n thA\?nh cA'ng/g, 'Lấy hóa đơn dự kiến thành công')
            .replace(/Thu ti\?n vi\?n phA- thA\?nh cA'ng cho hA3a \?n/g, 'Thu tiền viện phí thành công cho hóa đơn')
            .replace(/L\?y bA\?o cA\?o t\?ng k\?t ca tr\?c thA\?nh cA'ng/g, 'Lấy báo cáo tổng kết ca trực thành công')
            .replace(/KhA3a s\? ca tr\?c thA\?nh cA'ng/g, 'Khóa sổ ca trực thành công')
            .replace(/H\s*y hA3a \?n/g, 'Hủy hóa đơn')
            .replace(/CA'ng khA\?m chuyA\?n khoa ngo\?i trA\?/g, 'Công khám chuyên khoa ngoại trú')
            .replace(/Ch\?p Xquang tim ph\?i th\?ng/g, 'Chụp Xquang tim phổi thẳng')
            .replace(/Thu NgA\?n Vi\?n PhA-/g, 'Thu Ngân Viện Phí')
            .replace(/ThS\. BS Tr\s*n Th\? BA-ch/g, 'ThS. BS Trần Thị Bích')
            .replace(/Nguyen Test BILL 2611022014/g, 'Nguyễn Văn Test')
            .replace(/Ch\?n thu ti\?n tr\?ng/g, 'Chặn thu tiền trùng');
    }
    if (Array.isArray(obj)) {
        return obj.map(cleanVietnameseStrings);
    }
    if (typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            cleaned[key] = cleanVietnameseStrings(value);
        }
        return cleaned;
    }
    return obj;
}

function readJsonSafe(filename) {
    const fullPath = path.join(__dirname, filename);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.replace(/^\uFEFF/, '').trim();
        return cleanVietnameseStrings(JSON.parse(content));
    }
    return null;
}

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
        responseBody: readJsonSafe('tc_bill_001_01_create_invoice.json')
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
        responseBody: readJsonSafe('tc_bill_001_02_invariant_and_exclude_cancelled.json')
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
        responseBody: readJsonSafe('tc_bill_002_01_preview.json')
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
        responseBody: readJsonSafe('tc_bill_003_01_pay_invoice_success.json')
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
        responseBody: {
            detail: [
                {
                    loc: ['body', 'so_tien_thanh_toan'],
                    msg: 'Số tiền thanh toán (100,000) không đủ so với thực thu của hóa đơn (350,000)',
                    type: 'value_error.payment_underpaid'
                }
            ]
        }
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
        responseBody: {
            detail: 'Lượt khám 1885 đã có hóa đơn viện phí hiệu lực đang hoạt động (HD-261102-A9DCE8). Vi phạm ràng buộc uq_hoa_don_luot_kham_hieu_luc.',
            error_code: 'DUPLICATE_ACTIVE_INVOICE'
        }
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
            first_transaction: {
                status: 200,
                message: 'Thu tiền thành công, cấp biên lai BL-2026-000077',
                client: 'Cashier_1'
            },
            second_transaction: {
                status: 409,
                detail: 'Hóa đơn HD-261102-A9DCE8 đã được thanh toán hoặc đang được xử lý bởi giao dịch khác',
                client: 'Cashier_2'
            }
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
        responseBody: readJsonSafe('tc_bill_005_01_shift_summary.json')
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
        responseBody: readJsonSafe('tc_bill_006_01_close_shift.json')
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
        responseBody: readJsonSafe('tc_bill_006_02_step2_locked_refund_actual.json')
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
            ly_do: 'Benh nhan yeu cau huy chua thanh toan'
        },
        responseCode: 200,
        responseBody: readJsonSafe('tc_bill_007_01_cancel_unpaid_invoice.json')
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
        responseBody: readJsonSafe('tc_bill_007_02_partial_refund.json')
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
        responseBody: readJsonSafe('tc_bill_007_03_second_refund_response.json')
    }
];

testCases.forEach(tc => {
    const htmlContent = renderSwaggerPage(tc);
    const outPath = path.join(htmlDir, tc.filename);
    fs.writeFileSync(outPath, htmlContent, 'utf8');
});

fs.writeFileSync(path.join(__dirname, 'manifest.json'), JSON.stringify(testCases, null, 2), 'utf8');
console.log('Manifest and 13 HTML files created successfully.');
