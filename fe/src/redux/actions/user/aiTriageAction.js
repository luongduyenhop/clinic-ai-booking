import { createAsyncThunk } from '@reduxjs/toolkit'
import { aiTriageService } from '../../../services/user/AiTriageService'

export const analyzeSymptomsAsync = createAsyncThunk('user/analyzeSymptoms', async (payload, { rejectWithValue }) => {
    try { return await aiTriageService.analyze(payload) } catch (error) { return rejectWithValue(error.message || 'Không thể phân tích triệu chứng') }
})
