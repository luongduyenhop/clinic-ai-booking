import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import App from './App.jsx'
import './index.css'
import { store } from './redux/store'
import { injectStore } from './services/BaseService'
import ErrorBoundary from './components/error/ErrorBoundary'

// Inject Redux Store vào Axios Service Layer
injectStore(store)

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ErrorBoundary>
            <Provider store={store}>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </Provider>
        </ErrorBoundary>
    </StrictMode>
)
