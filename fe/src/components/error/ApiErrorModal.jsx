import { Modal } from 'antd'
import { useSelector, useDispatch } from 'react-redux'
import { clearApiError } from '../../redux/slices/uiSlice'

export default function ApiErrorModal() {
    const dispatch = useDispatch()
    const apiError = useSelector((state) => state.app.ui.apiError)

    const handleClose = () => {
        dispatch(clearApiError())
    }

    return (
        <Modal
            title={
                <span className="text-red-600 font-bold text-base flex items-center gap-2">
                    Thông báo lỗi hệ thống
                </span>
            }
            open={Boolean(apiError)}
            onOk={handleClose}
            onCancel={handleClose}
            okText="Đóng"
            cancelButtonProps={{ style: { display: 'none' } }}
            centered
        >
            <div className="py-2 text-slate-700 text-sm leading-relaxed">
                {typeof apiError === 'string'
                    ? apiError
                    : apiError?.message || 'Có lỗi xảy ra khi kết nối đến máy chủ.'}
            </div>
        </Modal>
    )
}
