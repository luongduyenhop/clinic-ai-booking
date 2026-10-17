// Ghép tối đa 4 ảnh thành 1 ảnh JPG lưới 2×2 (backend chỉ lưu 1 tệp đính kèm cho mỗi chỉ định)
const loadImage = (file) =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => resolve({ img, url })
        img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error(`Không đọc được ảnh ${file.name}`))
        }
        img.src = url
    })

export async function mergeImagesToGrid(files, { cellWidth = 640, cellHeight = 480, labels = [] } = {}) {
    const picked = files.slice(0, 4)
    const loaded = await Promise.all(picked.map(loadImage))
    const cols = picked.length > 1 ? 2 : 1
    const rows = Math.ceil(picked.length / cols)

    const canvas = document.createElement('canvas')
    canvas.width = cellWidth * cols
    canvas.height = cellHeight * rows
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    loaded.forEach(({ img, url }, i) => {
        const x = (i % cols) * cellWidth
        const y = Math.floor(i / cols) * cellHeight
        const scale = Math.min(cellWidth / img.width, cellHeight / img.height)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, x + (cellWidth - w) / 2, y + (cellHeight - h) / 2, w, h)
        if (labels[i]) {
            ctx.font = '600 20px Roboto, sans-serif'
            ctx.fillStyle = 'rgba(0, 53, 83, 0.75)'
            ctx.fillRect(x + 12, y + 12, ctx.measureText(labels[i]).width + 24, 36)
            ctx.fillStyle = '#FFFFFF'
            ctx.fillText(labels[i], x + 24, y + 37)
        }
        URL.revokeObjectURL(url)
    })

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return new File([blob], `noi-soi-${Date.now()}.jpg`, { type: 'image/jpeg' })
}
