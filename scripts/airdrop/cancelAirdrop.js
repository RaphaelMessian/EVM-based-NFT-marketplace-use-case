//The purpose of this script is to demonstrate how to cancel a token airdrop using the HTS SDK
const {ethers} = require("hardhat");
const { createAccount, createToken, mintToken } = require("../utils.js");
const { Client, PrivateKey, TransferTransaction, TokenAirdropTransaction, AccountId, TokenRejectTransaction, TokenClaimAirdropTransaction, AccountBalanceQuery, TokenAssociateTransaction, TokenCancelAirdropTransaction } = require("@hashgraph/sdk");


async function main() {
    //Create a fungible token with hedera sdk, you need to instantiate a client to correct network
    const client = Client.forName(process.env.HEDERA_NETWORK); 
    const myAccountId = AccountId.fromString(process.env.OPERATOR_ID);
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
      .addTokenTransfer(tokenId, myAccountId, -10)
      .addTokenTransfer(tokenId, newAccount, 10)
      .execute(client);
    
    const receipt = await aidropTx.getReceipt(client);
    const airDropRecord = await aidropTx.getRecord(client);
    console.log("Airdrop tx status", receipt.status.toString());

    console.log("Pending airdrops length", airDropRecord.newPendingAirdrops.length);

  const checkBalanceBeforeClaim = await new AccountBalanceQuery()
    .setAccountId(newAccount)
    .execute(client);
  
  console.log("New account balance before claim", checkBalanceBeforeClaim.tokens.get(tokenId));

  const cancelAirdropTx = await new TokenCancelAirdropTransaction()
    .addPendingAirdropId(airDropRecord.newPendingAirdrops[0].airdropId)
    .execute(client);

  const cancelReceipt = await cancelAirdropTx.getReceipt(client);
  console.log("Airdrop cancel tx status", cancelReceipt.status.toString());
}
main();