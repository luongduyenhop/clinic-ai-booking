import fs from 'fs'
const p = 'd:/dowload/tailieu/clinic-ai/src/App.jsx'
let c = fs.readFileSync(p, 'utf8')
c = c.replace(/<Route path="kham-benh" element={<ClinicalExamPage \/>} \/>/g, '<Route path="kham-benh" element={<ExamWorkstationPage />} />')
c = c.replace(/<Route path="khambenh" element={<ClinicalExamPage \/>} \/>/g, '<Route path="khambenh" element={<ExamWorkstationPage />} />')
fs.writeFileSync(p, c, 'utf8')
console.log('App.jsx updated with ExamWorkstationPage')
