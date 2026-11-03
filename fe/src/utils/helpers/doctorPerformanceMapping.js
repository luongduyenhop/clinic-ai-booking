export function mapDoctorPerformanceItems(response) {
    if (!Array.isArray(response?.items)) return null

    return response.items.map((item) => ({
        id: item.bac_si_id,
        name: item.ho_ten,
        specialty: item.chuyen_khoa,
        degree: item.hoc_vi,
        completedCases: Number(item.so_ca_kham_xong) || 0,
        revenue: Number(item.doanh_thu_mang_lai) || 0,
    }))
}
