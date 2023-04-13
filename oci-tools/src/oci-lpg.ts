import db from "./config/oci.json" assert {type: "json"}
import { getAcpetorLPGAll, getRequestorLPGUniversalALL } from "./oci.js"

getRequestorLPGUniversalALL(db).forEach((policy) => {
    console.log(`For ${policy.requestor}\n${policy.policy}\n\n`)
})

getAcpetorLPGAll(db).forEach((policy) => {
    console.log(`acceptor_lpg_${policy.requestor} (${policy.acceptor} accept LPG ${policy.requestor})\n${policy.policy}\n\n`)
})