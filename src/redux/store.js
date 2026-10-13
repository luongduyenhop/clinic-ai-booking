import { configureStore, combineReducers } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import uiReducer from './slices/uiSlice'
import userReducer from './slices/user/userSlice'
import adminReducer from './slices/admin/adminSlice'
import receptionReducer from './slices/reception/receptionSlice'

const appReducer = combineReducers({
    auth: authReducer,
    ui: uiReducer,
    admin: adminReducer,
})

const userAppReducer = combineReducers({
    user: userReducer,
})

const adminAppReducer = combineReducers({
    admin: adminReducer,
})

export const store = configureStore({
    reducer: {
        app: appReducer,
        user: userAppReducer,
        admin: adminAppReducer,
        reception: receptionReducer,
    },
})
