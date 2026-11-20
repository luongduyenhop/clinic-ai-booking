import { createAsyncThunk } from '@reduxjs/toolkit'
import { aiTriageService } from '../../../services/user/AiTriageService'
import { toFriendlyErrorMessage } from '../../../utils/helpers/clientErrorHelper.js'

export const analyzeSymptomsAsync = createAsyncThunk('user/analyzeSymptoms', async (payload, { rejectWithValue }) => {
    try { return await aiTriageService.analyze(payload) } catch (error) { return rejectWithValue(toFriendlyErrorMessage(error, 'Chưa thể phân tích triệu chứng lúc này. Bạn thử lại sau ít phút hoặc gọi 1900 6868.')) }
})
