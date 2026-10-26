import fs from 'fs'
const p = 'd:/dowload/tailieu/clinic-ai/src/redux/actions/doctor/clinicalAction.js'
let c = fs.readFileSync(p, 'utf8')
if (!c.includes('postponeTicketAsync')) {
    c = c.replace(
        "export const recallPatientAsync = thunk('clinical/recall', (ticketId) => clinicalService.recall(ticketId))",
        "export const recallPatientAsync = thunk('clinical/recall', (ticketId) => clinicalService.recall(ticketId))\nexport const postponeTicketAsync = thunk('clinical/postpone', (ticketId) => clinicalService.postponeTicket(ticketId))"
    )
    fs.writeFileSync(p, c, 'utf8')
    console.log('Added postponeTicketAsync')
}
