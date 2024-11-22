//The purpose of this script is to demonstrate how to use the isAssociated function in the IHRC719 contract
const {ethers} = require("hardhat");
const { createNFT, mintNFT } = require("../utils.js");
const { Client, PrivateKey } = require("@hashgraph/sdk");


async function main() {
    signers = await ethers.getSigners(); 
    [deployer, otherWallet, treasury] = signers;

    //Create a fungible token with hedera sdk, you need to instantiate a client to correct network
    const client = Client.forTestnet();
    client.setOperator(process.env.OPERATOR_ID, PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY));
     //Create a fungible token with hashgraph sdk, deployer is admin, supply and treasury
    const tokenId = await createNFT(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY);
    const tokenAddress = '0x' + tokenId.toSolidityAddress();
    console.log("Token created at address", tokenAddress);  

    //Since the deployer is defined as the supplykey, we can mint tokens
    const mintTx = await mintNFT(tokenId, client);
    console.log("Token mint tx status", mintTx.status.toString());

    const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
    const associateTokenTx = await associateTokenInterface.connect(otherWallet).associate(
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token associated to account tx hash", associateTokenTx.hash);

    const checkAssociated = await associateTokenInterface.isAssociated();
    console.log("Is associated", checkAssociated);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();