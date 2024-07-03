//The purpose of this script is to demonstrate who to create - mint - transfer and listen to events created by HTS using precompiled contract.
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
    
    await delay(5000);
    //We can use the IERC721 interface also to interact with the token
    const tokenInterface = await ethers.getContractAt("IERC721", tokenAddress);
    const balanceOfDeployer = await tokenInterface.balanceOf(deployer.address);
    console.log("Balance of deployer", balanceOfDeployer.toString());

    //Since the deployer is defined as the supplykey, we can mint tokens
    const mintTx = await mintNFT(tokenId, client);
    console.log("Token mint tx status", mintTx.status.toString());
    
    await delay(5000);
    const balanceOfDeployerAfter = await tokenInterface.balanceOf(deployer.address);
    console.log("Balance of deployer after mint", balanceOfDeployerAfter.toString());

    //We can transfer tokens from the treasury to another account, first the account need to associate the token
    //We will use the IHRC719 so that an account can associate a token using a smart contract
    const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
    const associateTokenTx = await associateTokenInterface.connect(otherWallet).associate(
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token associated to account tx hash", associateTokenTx.hash);

    //Check the balance of the otherWallet
    const balanceOfOtherWallet = await tokenInterface.balanceOf(otherWallet.address);
    console.log("Balance of otherwallet", balanceOfOtherWallet.toString());

    //We can now transfer tokens from the treasury to another account
    const transferTokenTx = await tokenInterface.transferFrom(
      deployer.address,
      otherWallet.address,
      1,
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token transfer tx hash", transferTokenTx.hash);
    // Wait for the transaction to be mined
    const receipt = await transferTokenTx.wait();

    // Find the Transfer event in the transaction receipt
    const transferEvent = receipt.logs.filter(
          (e) => e.fragment.name === "Transfer"
        )[0].args;
    console.log("Transfer event details:", transferEvent);

    //Check the balance of the deployer after the mint
    const balanceOfOtherWalletAfterTransfer = await tokenInterface.balanceOf(otherWallet.address);
    console.log("Balance of otherwallet after", balanceOfOtherWalletAfterTransfer.toString());
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();