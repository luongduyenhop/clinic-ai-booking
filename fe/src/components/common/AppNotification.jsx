import { toast } from 'react-toastify'

export const AppToast = {
    success: (msg) => toast.success(msg),
    error: (msg) => toast.error(msg),
    info: (msg) => toast.info(msg),
    warning: (msg) => toast.warning(msg),
}

export default AppToast
