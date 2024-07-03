//The purpose of this script is to demonstrate who to create - mint - transfer and listen to events created by HTS using precompiled contract.
const {ethers} = require("hardhat");
const { createToken, mintToken } = require("../../utils.js");
const { Client, PrivateKey } = require("@hashgraph/sdk");


async function main() {
    signers = await ethers.getSigners(); 
    [deployer, otherWallet, treasury] = signers;

    //Create a fungible token with hedera sdk, you need to instantiate a client to correct network
    const client = Client.forTestnet();
    client.setOperator(process.env.OPERATOR_ID, PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY));
     //Create a fungible token with hashgraph sdk, deployer is admin, supply and treasury
    const tokenId = await createToken(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY);
    const tokenAddress = '0x' + tokenId.toSolidityAddress();
    console.log("Token created at address", tokenAddress);  

    //We can use the ERC20 interface also to interact with the token
    const tokenInterface = await ethers.getContractAt("IERC20", tokenAddress);

    //Since the deployer is defined as the supplykey, we can mint tokens
    const mintTokenTx = await mintToken(tokenId, client, 100, {gasLimit: 1_000_000});
    console.log("Minted 100 tokens to treasury", mintTokenTx.hash);

    //We can transfer tokens from the treasury to another account, first the account need to associate the token
    //We will use the IHRC719 so that an account can associate a token using a smart contract
    const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
    const associateTokenTx = await associateTokenInterface.connect(otherWallet).associate(
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token associated to account tx hash", associateTokenTx.hash);

     //We can now transfer tokens from the treasury to another account
     const transferTokenTx = await tokenInterface.transfer(
        otherWallet.address,
        100,
        {
          gasLimit: 1_000_000,
        }
      );
      console.log("Token transfer tx hash", transferTokenTx.hash);
      const receipt = await transferTokenTx.wait();
  
      // Find the Transfer event in the transaction receipt
      const transferEvent = receipt.logs.filter(
            (e) => e.fragment.name === "Transfer"
          )[0].args;
      console.log("Transfer event details:", transferEvent);

    //We can use the ERC20 interface also to interact with the token
    const balanceOfDeployer = await tokenInterface.balanceOf(otherWallet.address);
    console.log("Balance of deployer", balanceOfDeployer.toString());
}

main();