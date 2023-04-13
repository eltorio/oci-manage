import db from "./config/oci.json" assert {type: "json"}

export type RequestorPolicy = {
    requestor: string;
    policy: string;
}
export type AcceptorPolicy = {
    requestor: string;
    acceptor: string;
    policy: string;
}
export type RPCLink = {
    requestor: string
    remotevcn: string;
    remoteocid: string;
}

export type DB = typeof db;
export type OCITenancy = typeof db[0];

export function getAcpetorAll(db: DB) {
    // Define tenancy Requestor as <requestor-tenancy-ocid>
    // Define group ReqAdministrators as <requestor-group-ocid>
    // Admit group ReqAdministrators  of tenancy Requestor to manage remote-peering-to in compartment <acceptor-compartment-name>
    const policies = [] as AcceptorPolicy[];
    db.forEach((accLocation) => {
        db.forEach((reqLocation) => {
            if (accLocation.tenancy != reqLocation.tenancy) {
                let policy = `Define tenancy Requestor as ${reqLocation.ocid}\n`;
                policy += `Define group ReqAdministrators as ${reqLocation.administrators.ocid}\n`;
                policy += `Admit group ReqAdministrators  of tenancy Requestor to manage remote-peering-to in compartment ${accLocation.compartment}`;
                policies.push(
                    {
                        acceptor: accLocation.tenancy,
                        requestor: reqLocation.tenancy,
                        policy: policy
                    })
            }
        })
    })
    return policies;
}

export function getRpcLinkAll(db: DB) {
    let rpcLinks = [] as RPCLink[];
    db.forEach((reqLocation) => {
        db.forEach((accLocation) => {
            if (accLocation.tenancy != reqLocation.tenancy) {
                accLocation.lpg.rpc.forEach((rpcLink) => {
                    if (rpcLink.to == reqLocation.vcn.name) {
                        rpcLinks.push({
                            remoteocid: rpcLink.ocid,
                            remotevcn: accLocation.vcn.name,
                            requestor: reqLocation.tenancy
                        })
                    }
                })
            }
        })
    })
    return rpcLinks;
}

export function getRequestorUniversal(_db: DB) {
    // Allow group Administrators to manage remote-peering-from in compartment <requestor-compartment-name>
    // Endorse group Administrators to manage remote-peering-to in any-tenancy
    const policies = [] as RequestorPolicy[];
    _db.forEach((reqLocation) => {
        let policy = `Allow group Administrators to manage remote-peering-from in compartment ${reqLocation.compartment}\n`;
        policy += `Endorse group Administrators to manage remote-peering-to in any-tenancy`
        policies.push({ requestor: reqLocation.tenancy, policy: policy });
    })
    return policies;
}

export function getRequestorLPGUniversalALL(_db: DB) {
    // Allow group Administrators to manage local-peering-from in compartment <requestor-compartment>
    // Endorse group Administrators to manage local-peering-to in any-tenancy
    // Endorse group Administrators to associate local-peering-gateways in compartment <requestor-compartment> with local-peering-gateways in any-tenancy
    const policies = [] as RequestorPolicy[];
    _db.forEach((reqLocation) => {
        policies.push({ requestor: reqLocation.tenancy, policy: getRequestorLPGUniversal(db, reqLocation.tenancy) });
    })
    return policies;
}

export function getAcpetorLPGAll(db: DB) {
   const policies = [] as AcceptorPolicy[];
    db.forEach((accLocation) => {
        db.forEach((reqLocation) => {
            if (accLocation.tenancy != reqLocation.tenancy) {
                policies.push(
                    {
                        acceptor: accLocation.tenancy,
                        requestor: reqLocation.tenancy,
                        policy: getAcceptorLPGasString(db, accLocation.tenancy, reqLocation.tenancy)
                    })
            }
        })
    })
    return policies;
}

export function getLocation(db: DB, tenancy: string) {
    return db.filter(location => location.tenancy == tenancy)[0];
}

export function getAcceptorLPGasString(db: DB, acceptorTenancy: string, requestorTenancy: string) {
    let ret = '';
    getAcceptorLPG(db, acceptorTenancy, requestorTenancy).forEach(statement=>{
        ret += `${statement}\n`
    })
    return ret;
}
export function getAcceptorLPG(db: DB, acceptorTenancy: string, requestorTenancy: string) {
    // Define tenancy Requestor as <requestor_tenancy_OCID>
    // Define group <requestor-group-name> as <RequestorGrp_OCID>
    // Admit group <requestor-group-name> of tenancy Requestor to manage local-peering-to in compartment <acceptor-compartment>
    // Admit group <requestor-group-name> of tenancy Requestor to associate local-peering-gateways in tenancy Requestor with local-peering-gateways in compartment <acceptor-compartment>
    const accLocation = getLocation(db, acceptorTenancy);
    const reqLocation = getLocation(db, requestorTenancy);
    let policy = [`Define tenancy Requestor as ${reqLocation.ocid}`];
    policy.push (`Define group Administrators as ${reqLocation.administrators.ocid}`);
    policy.push(`Admit group Administrators of tenancy Requestor to manage local-peering-to in compartment ${accLocation.compartment}`);
    policy.push(`Admit group Administrators of tenancy Requestor to associate local-peering-gateways in tenancy Requestor with local-peering-gateways in compartment ${accLocation.compartment}`);
    return policy;
}

export function getRequestorLPGUniversal(db: DB, requestorTenancy: string) {
    const reqLocation = getLocation(db, requestorTenancy);
    // Allow group <requestor-group-name> to manage local-peering-from in compartment <requestor-compartment>
    // Endorse group <requestor-group-name> to manage local-peering-to in any-tenancy
    // Endorse group <requestor-group-name> to associate local-peering-gateways in compartment <requestor-compartment> with local-peering-gateways in any-tenancy
    let policy = `Allow group Administrators to manage local-peering-from in compartment ${reqLocation.compartment}\n`;
    policy += `Endorse group Administrators to manage local-peering-to in any-tenancy\n`;
    policy += `Endorse group Administrators to associate local-peering-gateways in compartment ${reqLocation.compartment} with local-peering-gateways in any-tenancy`;
    return policy;
}