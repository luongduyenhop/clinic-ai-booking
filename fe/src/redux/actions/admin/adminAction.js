import { createAsyncThunk } from '@reduxjs/toolkit'
import { adminService } from '../../../services/admin/AdminService'
import { toFriendlyErrorMessage } from '../../../utils/helpers/clientErrorHelper.js'

export const getDashboardStatsAsync = createAsyncThunk(
    'admin/getDashboardStats',
    async (params = {}, { rejectWithValue }) => {
        try {
            const response = await adminService.getDashboardStats(params)
            return response.data
        } catch (error) {
            return rejectWithValue(toFriendlyErrorMessage(error, 'Không thể tải số liệu tổng quan.'))
        }
    }
)

export const loadClinicDataAsync = createAsyncThunk(
    'admin/loadClinicData',
    async (_, { rejectWithValue }) => {
        try {
            const response = await adminService.getAllClinicData()
            return response.data
        } catch (error) {
            return rejectWithValue(toFriendlyErrorMessage(error, 'Không thể tải dữ liệu phòng khám.'))
        }
    }
)

export const updateClinicCollectionAsync = createAsyncThunk(
    'admin/updateClinicCollection',
    async (payload, { rejectWithValue }) => {
        try {
            const response = await adminService.updateCollection(payload)
            return response.data
        } catch (error) {
            return rejectWithValue(toFriendlyErrorMessage(error, 'Không thể cập nhật dữ liệu phòng khám.'))
        }
    }
)

export const updateCatalogSubCollectionAsync = createAsyncThunk(
    'admin/updateCatalogSubCollection',
    async (payload, { rejectWithValue }) => {
        try {
            const response = await adminService.updateCatalogSubCollection(payload)
            return response.data
        } catch (error) {
            return rejectWithValue(toFriendlyErrorMessage(error, 'Không thể cập nhật danh mục.'))
        }
    }
)

export const resetClinicDemoDataAsync = createAsyncThunk(
    'admin/resetClinicDemoData',
    async (_, { rejectWithValue }) => {
        try {
            const response = await adminService.resetClinicDemoData()
            return response.data
        } catch (error) {
            return rejectWithValue(toFriendlyErrorMessage(error, 'Không thể khôi phục dữ liệu mẫu.'))
        }
    }
)

export const suggestSpecialtyByAIAsync = createAsyncThunk(
    'admin/suggestSpecialtyByAI',
    async (symptomsText, { rejectWithValue }) => {
        try {
            const response = await adminService.suggestSpecialtyByAI(symptomsText)
            return response.data
        } catch (error) {
            return rejectWithValue(toFriendlyErrorMessage(error, 'Chưa thể gợi ý chuyên khoa lúc này.'))
        }
    }
)

