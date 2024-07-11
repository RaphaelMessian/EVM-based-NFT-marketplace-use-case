require('dotenv').config({ path: '../.env' });
const axios = require("axios");

const { TokenCreateTransaction, TokenType, TokenSupplyType,TokenInfoQuery, AccountBalanceQuery, TokenMintTransaction, TransferTransaction,
     TokenAssociateTransaction, CustomRoyaltyFee, Hbar,
     PrivateKey,
     CustomFixedFee,
     CustomFractionalFee,
     AccountId} = require("@hashgraph/sdk");

async function tokenAssociate(client, accountId, tokenIds, accountKey) {
    const tokenAssociateTx = await new TokenAssociateTransaction()
      .setAccountId(accountId)
      .setTokenIds([tokenIds])
      .freezeWith(client);
    const signTx = await tokenAssociateTx.sign(accountKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    console.log(`- Token Associated: ${receipt.status} \n`);
} 

async function transferHbar(client, senderId, receiverId, amount) {

  const transferTransaction = new TransferTransaction()
    .addHbarTransfer(senderId, -amount)
    .addHbarTransfer(receiverId, amount)
    .freezeWith(client);

  const transferHbar = await transferTransaction.execute(client);
  const receipt = await transferHbar.getReceipt(client);
  console.log("Transaction receipt", receipt.status.toString());
}

async function createToken(client, treasuryId, privateKey) {

  let tokenCreateTx = await new TokenCreateTransaction()
    .setTokenName("MyToken")
    .setTokenSymbol("MYT")
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(8)
    .setInitialSupply(0)
    .setTreasuryAccountId(treasuryId)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(PrivateKey.fromStringECDSA(privateKey))
    .setAdminKey(PrivateKey.fromStringECDSA(privateKey))
    .setMaxTransactionFee(new Hbar(40))
    .freezeWith(client);

  let tokenCreateSubmit = await tokenCreateTx.execute(client);
  // console.log("- Executed");
  let tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
  let tokenId = tokenCreateRx.tokenId;
  return tokenId;
}


async function createNFT(client, treasuryId, privateKey) {

  let tokenCreateTx = await new TokenCreateTransaction()
    .setTokenName("MyNFT")
    .setTokenSymbol("MNFT")
    .setTokenType(TokenType.NonFungibleUnique)
    .setInitialSupply(0)
    .setTreasuryAccountId(treasuryId)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(PrivateKey.fromStringECDSA(privateKey))
    .setAdminKey(PrivateKey.fromStringECDSA(privateKey))
    .freezeWith(client);

  // let tokenCreateSign = await tokenCreateTx.sign(PrivateKey.fromStringECDSA(collectorFeePKey));
  let tokenCreateSubmit = await tokenCreateTx.execute(client);
  let tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
  let tokenId = tokenCreateRx.tokenId;
  return tokenId;
}   

async function createTokenWithFees(client, treasuryId, privateKey, collectorFeeId, collectorFeeKey, fixFeeToken, isFixedFee, isFractionalFee) {

  let fractionalFee;
  let fixedFee;

  if(isFixedFee) {
  fixedFee = new CustomFixedFee()
    .setAmount(1e8)
    .denominatingTokenId(fixFeeToken)
    .setFeeCollectorAccountId(collectorFeeId)
    .setAllCollectorsAreExempt(false);
  }
  if(isFractionalFee) {
  fractionalFee = new CustomFractionalFee()
    .setFeeCollectorAccountId(collectorFeeId)
    .setNumerator(1)
    .setDenominator(10)
    .setMin(1e8)
    .setMax(10e8)
  }

  let tokenCreateTx = await new TokenCreateTransaction()
    .setTokenName("MyToken")
    .setTokenSymbol("MYT")
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(8)
    .setInitialSupply(0)
    .setTreasuryAccountId(treasuryId)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(PrivateKey.fromStringECDSA(privateKey))
    .setAdminKey(PrivateKey.fromStringECDSA(privateKey))
    if(isFixedFee) {
      tokenCreateTx.setCustomFees([fixedFee]);
    };
    if(isFractionalFee) {
      tokenCreateTx.setCustomFees([fractionalFee]);
    };
    if(isFixedFee && isFractionalFee) {
      tokenCreateTx.setCustomFees([fixedFee, fractionalFee]);
    };
    tokenCreateTx.setMaxTransactionFee(new Hbar(40))
    tokenCreateTx.freezeWith(client);

  let signTx = await tokenCreateTx.sign(PrivateKey.fromStringECDSA(collectorFeeKey));
  let tokenCreateSubmit = await signTx.execute(client);
  // console.log("- Executed");
  let tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
  let tokenId = tokenCreateRx.tokenId;
  return tokenId;
}


async function createNFTWithFees(client, treasuryId, privateKey, collectorFeeId, fixFeeToken, isRoyalties, isFixedFee) {

  let royaltiesFee;
  let fixedFee;

  if(isRoyalties) {
    const fixedFeeForRoyalties = new CustomFixedFee()
      .setAmount(1)
      .setFeeCollectorAccountId(collectorFeeId)
      .setDenominatingTokenId(fixFeeToken)
      .setAllCollectorsAreExempt(false);

    royaltiesFee = new CustomRoyaltyFee()
      .setNumerator(1) // The numerator of the fraction
      .setDenominator(10) // The denominator of the fraction
      .setFallbackFee(fixedFeeForRoyalties) // The fallback fee
      .setFeeCollectorAccountId(collectorFeeId); // The account that will receive the royalty fee
  }

  if(isFixedFee) {
    fixedFee = new CustomFixedFee()
      .setAmount(1)
      .setFeeCollectorAccountId(collectorFeeId)
      .setDenominatingTokenId(fixFeeToken)
      .setAllCollectorsAreExempt(false);
  }

  let tokenCreateTx = await new TokenCreateTransaction()
    .setTokenName("MyNFT")
    .setTokenSymbol("MNFT")
    .setTokenType(TokenType.NonFungibleUnique)
    .setInitialSupply(0)
    .setTreasuryAccountId(treasuryId)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(PrivateKey.fromStringECDSA(privateKey))
    .setAdminKey(PrivateKey.fromStringECDSA(privateKey))
    if(isRoyalties) {
      tokenCreateTx.setCustomFees([royaltiesFee]);
    };
    if(isFixedFee) {
      tokenCreateTx.setCustomFees([fixedFee]);
    };
    if(isRoyalties && isFixedFee) {
      tokenCreateTx.setCustomFees([royaltiesFee, fixedFee]);
    };
    tokenCreateTx.freezeWith(client);

  // let tokenCreateSign = await tokenCreateTx.sign(PrivateKey.fromStringECDSA(collectorFeePKey));
  let tokenCreateSubmit = await tokenCreateTx.execute(client);
  let tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
  let tokenId = tokenCreateRx.tokenId;
  return tokenId;
}    


async function mintToken(tokenId, client, amount) {
    const tokenMintTx = await new TokenMintTransaction()
        .setTokenId(tokenId)
        .setAmount(amount*1e8)
        .freezeWith(client)

    const tokenMintExec = await tokenMintTx.execute(client);
    const tokenMintRx = await tokenMintExec.getReceipt(client);

    return tokenMintRx;
}

async function mintNFT(tokenId, client) {
    const mintTx = await new TokenMintTransaction()
      .setTokenId(tokenId)
      .setMetadata([
        Buffer.from("ipfs://QmTzWcVfk88JRqjTpVwHzBeULRTNzHY7mnBSG42CpwHmPa"),
      ])
      .execute(client);
    const mintRx = await mintTx.getReceipt(client);

    return mintRx;
  }

async function tokenQuery(tokenId, client) {
    const info = await new TokenInfoQuery().setTokenId(tokenId).execute(client);
    return info;
}

async function tokenTransfer(tokenId, sender, receiver, amount, client) {

    const transferToken = await new TransferTransaction()
        .addTokenTransfer(tokenId, sender, -(amount*1e8))
        .addTokenTransfer(tokenId, receiver, amount*1e8)
        .freezeWith(client)
    
    const transferTokenSubmit = await transferToken.execute(client);
    const transferTokenRx = await transferTokenSubmit.getReceipt(client);

    return transferTokenRx;
}

async function tokenBalance(accountId, client) {
    const query = new AccountBalanceQuery()
                .setAccountId(accountId);
    const tokenBalance = await query.execute(client);

    return tokenBalance
}

async function contractInfoFromMirrorNode(contractAddress) {
  const response = await axios.get(
      `https://${process.env.HEDERA_NETWORK}.mirrornode.hedera.com/api/v1/contracts/${contractAddress}`
  );
  return response.data;
}


module.exports = {
    createNFT,
    mintToken,
    tokenQuery,
    tokenTransfer,
    tokenBalance,
    tokenAssociate,
    mintNFT,
    createNFTWithFees,
    createToken,
    transferHbar,
    contractInfoFromMirrorNode,
    createTokenWithFees
}
