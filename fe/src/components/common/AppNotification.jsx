import { toast } from 'react-toastify'

export const AppToast = {
    success: (msg, opts = {}) => toast.success(msg, { toastId: typeof msg === 'string' ? msg : undefined, ...opts }),
    error: (msg, opts = {}) => toast.error(msg, { toastId: typeof msg === 'string' ? msg : undefined, ...opts }),
    info: (msg, opts = {}) => toast.info(msg, { toastId: typeof msg === 'string' ? msg : undefined, ...opts }),
    warning: (msg, opts = {}) => toast.warning(msg, { toastId: typeof msg === 'string' ? msg : undefined, ...opts }),
}

export default AppToast
