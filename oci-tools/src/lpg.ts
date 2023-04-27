// This is an automatically generated code sample.
// To make this code sample work in your Oracle Cloud tenancy,
// please replace the values for any parameters whose current values do not fit
// your use case (such as resource IDs, strings containing ‘EXAMPLE’ or ‘unique_id’, and
// boolean, number, and enum parameters with values not fitting your use case).

import * as core from "oci-core";
import * as identity from "oci-identity";
import * as common from "oci-common";
import db from "./config/oci.json" assert {type: "json"}
import { getAcceptorLPG, getLocation, getRequestorLPGUniversal } from "./oci.js";
export type DB = typeof db;
export type OCITenancy = typeof db[0];

const configurationFilePath = "~/.oci/config";
const WAITs = 10;

// Create a default authentication provider that uses the DEFAULT
// profile in the configuration file.
// Refer to <see href="https://docs.cloud.oracle.com/en-us/iaas/Content/API/Concepts/sdkconfig.htm#SDK_and_CLI_Configuration_File>the public documentation</see> on how to prepare a configuration file.

function sleep(ms:number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

function getProvider(configProfile: string): common.ConfigFileAuthenticationDetailsProvider {
    return new common.ConfigFileAuthenticationDetailsProvider(configurationFilePath, configProfile);
}

async function createAcceptorLPG(acceptor: string, name: string) {
    const location = getLocation(db, acceptor)
    try {
        const provider = getProvider(acceptor);
        const client = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
        const compartmentId = location.compartments[0].ocid;
        const listVcnsRequest: core.requests.ListVcnsRequest = {
            compartmentId: compartmentId,
            limit: 1,
        };
        const listVcnsResponse = await client.listVcns(listVcnsRequest);
        const vcnId = listVcnsResponse.items[0].id;
        console.log(`vcnId=${vcnId}`);
        // Create a request and dependent object(s).
        const createLocalPeeringGatewayDetails = {
            compartmentId: compartmentId,
            vcnId: vcnId,
            displayName: name
        };
        const createLocalPeeringGatewayRequest: core.requests.CreateLocalPeeringGatewayRequest = {
            createLocalPeeringGatewayDetails: createLocalPeeringGatewayDetails
        };

        // Send request to the Client.
        const createLocalPeeringGatewayResponse = await client.createLocalPeeringGateway(
            createLocalPeeringGatewayRequest
        );
        console.log(`PeeringGatewayId= ${createLocalPeeringGatewayResponse.localPeeringGateway.id}`)
        return createLocalPeeringGatewayResponse.localPeeringGateway
    } catch (error) {
        console.log("createLocalPeeringGateway Failed with error  " + error);
    }
}

async function createPolicyAcceptorLPG(requestor: string, acceptor: string) {
    try {
        // Create a service client
        const accLocation = getLocation(db, acceptor)
        const provider = getProvider(acceptor);
        const client = new identity.IdentityClient({ authenticationDetailsProvider: provider });

        // Create a request and dependent object(s).
        const createPolicyDetails = {
            compartmentId: accLocation.ocid,
            name: `acceptor_lpg_${requestor}`,
            statements: getAcceptorLPG(db, acceptor, requestor),
            description: `acceptor_lpg_${requestor}`
        };

        const createPolicyRequest: identity.requests.CreatePolicyRequest = {
            createPolicyDetails: createPolicyDetails
        };

        // Send request to the Client.
        const createPolicyResponse = await client.createPolicy(createPolicyRequest);
        // console.log(createPolicyResponse)
    } catch (error) {
        console.log("createPolicy Failed with error  " + error);
    }
}

async function linkLPG(requestor: string, localPeeringGateway: string, distantPeeringGateway: string) {
    const provider = getProvider(requestor);
    try {
        // Create a service client
        const client = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });

        const connectLocalPeeringGatewaysRequest: core.requests.ConnectLocalPeeringGatewaysRequest = {
            localPeeringGatewayId: localPeeringGateway,
            connectLocalPeeringGatewaysDetails: {
                peerId: distantPeeringGateway
            }
        };

        // Send request to the Client.
        const connectLocalPeeringGatewaysResponse = await client.connectLocalPeeringGateways(
            connectLocalPeeringGatewaysRequest
        );

    } catch (error) {
        console.log("connectLocalPeeringGateways Failed with error  " + error);
    }
}

async function getLPG(tenancy: string, ocid: string) {
    const provider = getProvider(tenancy);
    try {
        const getLocalPeeringGatewayRequest: core.requests.GetLocalPeeringGatewayRequest = {
            localPeeringGatewayId: ocid
        };
        const client = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
        // Send request to the Client.
        const getLocalPeeringGatewayResponse = await client.getLocalPeeringGateway(
            getLocalPeeringGatewayRequest
        );
        console.log(getLocalPeeringGatewayResponse.localPeeringGateway.displayName)
    } catch (error) {
        console.log("getLocalPeeringGatewayRequest Failed with error  " + error);
    }
}

async function link2VCN(requestor: string, acceptor: string) {
    await createPolicyAcceptorLPG(requestor, acceptor)
    const requestorSideLPGId = await createAcceptorLPG(requestor, `lpg-${requestor}-${acceptor}`)
    if (requestorSideLPGId != undefined &&
        requestorSideLPGId.id.length > 0) {
        console.log(`requestorSideLPGId= ${requestorSideLPGId.id}`)
        const acceptorSideLPGId = await createAcceptorLPG(acceptor, `lpg-${acceptor}-${requestor}`)
        if (acceptorSideLPGId != undefined &&
            acceptorSideLPGId.id.length > 0) {
            console.log(`acceptorSideLPGId= ${acceptorSideLPGId.id}`)
            await getLPG(requestor, requestorSideLPGId.id)
            await getLPG(acceptor, acceptorSideLPGId.id)
            console.log(`Ready to connect:\n${requestorSideLPGId.id} with ${acceptorSideLPGId.id}`)
            console.log(`With:  linkLPG("${requestor}", "${requestorSideLPGId.id}","${acceptorSideLPGId.id})`)
            console.log(`Wait ${WAITs}s for being sure the LPGs are available`)
            await sleep(WAITs*1000);
            await linkLPG(requestor, requestorSideLPGId.id, acceptorSideLPGId.id)
        }
    }


}
// usage link2VCN("newtenancy","othertenancy")
const args = process.argv.slice(2);
if (args.length == 2 && typeof args[0] == "string" && typeof args[1] == "string") {
    console.log(`Building a LPG for ${args[0]}↔${args[1]} `);
    link2VCN(args[0], args[1]);
} else if (args.length == 1 && typeof args[0] == "string") {
    console.log(getRequestorLPGUniversal(db, args[0]))
} else {
    console.log("for retrieving the universal requestor")
    console.log("node --loader ts-node/esm lpg.ts  newtenancy ")
    console.log("for peering two tenancies")
    console.log("node --loader ts-node/esm lpg.ts  newtenancy othertenancy");
}