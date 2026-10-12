import { createAsyncThunk } from '@reduxjs/toolkit'
import { adminService } from '../../../services/admin/AdminService'

export const getDashboardStatsAsync = createAsyncThunk(
    'admin/getDashboardStats',
    async (_, { rejectWithValue }) => {
        try {
            const response = await adminService.getDashboardStats()
            return response.data
        } catch (error) {
            return rejectWithValue(error.response?.data?.message || error.message)
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
            return rejectWithValue(error.message)
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
            return rejectWithValue(error.message)
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
            return rejectWithValue(error.message)
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
            return rejectWithValue(error.message)
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
            return rejectWithValue(error.message)
        }
    }
)

