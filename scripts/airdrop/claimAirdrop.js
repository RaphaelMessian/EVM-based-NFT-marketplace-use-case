//The purpose of this script is to demonstrate how to claim a token airdrop using the HTS SDK
const {ethers} = require("hardhat");
const { createAccount, createToken, mintToken } = require("../utils.js");
const { Client, PrivateKey, TokenAirdropTransaction, AccountId, TokenClaimAirdropTransaction, AccountBalanceQuery } = require("@hashgraph/sdk");


async function main() {
    //Create a fungible token with hedera sdk, you need to instantiate a client to correct network
    const client = Client.forName(process.env.HEDERA_NETWORK); 
    const myAccountId = process.env.OPERATOR_ID;
    const myPrivateKey = PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY);
    client.setOperator(myAccountId, myPrivateKey);

    const privateKey = PrivateKey.generateED25519();    
    const newAccount = await createAccount(client, privateKey, 0);
    console.log("New account created with account id", newAccount.toString());

    //Create a fungible token with hashgraph sdk, deployer is admin, supply and treasury
    const tokenId = await createToken(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY);
    const tokenAddress = '0x' + tokenId.toSolidityAddress();
    console.log("Token created at address", tokenAddress);  

    const mintTokenTx = await mintToken(tokenId, client, 100);
    console.log("Minted 100 tokens to treasury", mintTokenTx.status.toString());

    const aidropTx = await new TokenAirdropTransaction()
      .addTokenTransfer(tokenId, AccountId.fromString(myAccountId), -10)
      .addTokenTransfer(tokenId, newAccount, 10)
      .execute(client);
    
    const receipt = await aidropTx.getReceipt(client);
    const airDropRecord = await aidropTx.getRecord(client);
    console.log("Airdrop tx hash", receipt.status.toString());

    console.log("Pending airdrops length", airDropRecord.newPendingAirdrops.length);

  const checkBalanceBeforeClaim = await new AccountBalanceQuery()
    .setAccountId(newAccount)
    .execute(client);
  
  console.log("New account balance before claim", checkBalanceBeforeClaim.tokens.get(tokenId));

  const claimTx = await new TokenClaimAirdropTransaction()
    .addPendingAirdropId(airDropRecord.newPendingAirdrops[0].airdropId)
    .freezeWith(client)
    .sign(privateKey);
  
  const executeClaimTx = await claimTx.execute(client);
  const claimReceipt = await executeClaimTx.getReceipt(client);
  console.log("Airdrop claim tx hash", claimReceipt.status.toString());

  const checkBalanceAfterClaim = await new AccountBalanceQuery()
    .setAccountId(newAccount)
    .execute(client);
  
  console.log("New account balance after claim", checkBalanceAfterClaim.tokens.get(tokenId));    
}
main();