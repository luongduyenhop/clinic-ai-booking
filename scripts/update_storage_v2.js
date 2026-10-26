import fs from 'fs'
const p = 'd:/dowload/tailieu/clinic-ai/src/mock/reception/receptionStorage.js'
let c = fs.readFileSync(p, 'utf8')
c = c.replace(/_v1'/g, "_v2'")
fs.writeFileSync(p, c, 'utf8')
console.log('receptionStorage.js updated to v2')
