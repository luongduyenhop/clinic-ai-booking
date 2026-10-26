import fs from 'fs'
const p = 'd:/dowload/tailieu/clinic-ai/src/services/reception/receptionService.js'
let c = fs.readFileSync(p, 'utf8')

// Add http import if not present
if (!c.includes("import { http } from '../BaseService'")) {
    c = "import { http } from '../BaseService'\n" + c
}

// Replace fetchAllData and resetAllData
const oldFetch = `    async fetchAllData() {
        await delay()
        this.data = loadAllReceptionData()
        return JSON.parse(JSON.stringify(this.data))
    }`

const newFetch = `    async fetchAllData() {
        try {
            const res = await http.get('/api/v1/reception/overview')
            if (res.data && res.data.success && res.data.data) {
                const apiData = res.data.data
                this.data = {
                    ...this.data,
                    ...apiData,
                    activeRole: this.data?.activeRole || 'RECEPTIONIST',
                }
                this._persist()
                return JSON.parse(JSON.stringify(this.data))
            }
        } catch (err) {
            console.warn('Backend reception overview unavailable, fallback to local storage:', err)
        }
        await delay()
        this.data = loadAllReceptionData()
        return JSON.parse(JSON.stringify(this.data))
    }`

const oldReset = `    async resetAllData() {
        await delay()
        this.data = resetReceptionData()
        return JSON.parse(JSON.stringify(this.data))
    }`

const newReset = `    async resetAllData() {
        try {
            const res = await http.get('/api/v1/reception/overview')
            if (res.data && res.data.success && res.data.data) {
                this.data = {
                    ...res.data.data,
                    activeRole: 'RECEPTIONIST',
                }
                this._persist()
                return JSON.parse(JSON.stringify(this.data))
            }
        } catch (err) {
            console.warn('Backend reset overview fallback:', err)
        }
        await delay()
        this.data = resetReceptionData()
        return JSON.parse(JSON.stringify(this.data))
    }`

// Normalize CRLF to LF for matching
const isCRLF = c.includes('\r\n')
let normalized = c.replace(/\r\n/g, '\n')
let normalizedOldFetch = oldFetch.replace(/\r\n/g, '\n')
let normalizedOldReset = oldReset.replace(/\r\n/g, '\n')

if (normalized.includes(normalizedOldFetch)) {
    normalized = normalized.replace(normalizedOldFetch, newFetch.replace(/\r\n/g, '\n'))
}
if (normalized.includes(normalizedOldReset)) {
    normalized = normalized.replace(normalizedOldReset, newReset.replace(/\r\n/g, '\n'))
}

if (isCRLF) {
    normalized = normalized.replace(/\n/g, '\r\n')
}

fs.writeFileSync(p, normalized, 'utf8')
console.log('receptionService.js updated with backend API integration!')
