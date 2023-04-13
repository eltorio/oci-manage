import db from "./config/oci.json" assert {type: "json"}
import { getAcpetorAll, getRequestorUniversal, getRpcLinkAll } from "./oci.js"

getRequestorUniversal(db).forEach((policy) => {
    console.log(`For ${policy.requestor}\n${policy.policy}\n\n`)
})

getAcpetorAll(db).forEach((policy) => {
    console.log(`acceptor_rpc_${policy.requestor} (${policy.acceptor} accept RPC ${policy.requestor})\n${policy.policy}\n\n`)
})

getRpcLinkAll(db).forEach(link => {
    console.log(`requestor ${link.requestor} to ${link.remotevcn}: ${link.remoteocid}`)
})