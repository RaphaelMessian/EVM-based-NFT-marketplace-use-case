//The purpose of this script is to demonstrate how to create a fungible token with fix both fees using the IERC20
//The token is created with a fixed fee of 1 hbars for the feeCollector account and a fractional fee of 10%
const {ethers} = require("hardhat");
const { createTokenWithFees, mintToken, transferHbar } = require("../../../utils");
const { Client, PrivateKey } = require("@hashgraph/sdk");

async function main() {
    signers = await ethers.getSigners(); 
    [deployer, otherWallet, feeCollector] = signers;

    const tokenCreateFactory = await ethers.getContractFactory(
        "FungiblePrecompiled"
        );
    const tokenCreateContract = await tokenCreateFactory.deploy(
      {gasLimit: 1_000_000}
      );
    const tokenCreateAddress = await tokenCreateContract.getAddress();
    console.log("TokenCreateContract deployed to:", tokenCreateAddress);
    //const tokenCreateCustomContract = await ethers.getContractAt("FungiblePrecompiled", "0x1f61337E6b8837E75F64466b9618C986f3e571B9");

    //Create a fungible token with hedera sdk, you need to instantiate a client to correct network
    const client = Client.forTestnet();
    client.setOperator(process.env.OPERATOR_ID, PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY));
    //Create a fungible token with hashgraph sdk, deployer is admin, supply and treasury
    const tokenId = await createTokenWithFees(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY, process.env.FEE_COLLECTOR_ID, process.env.FEE_COLLECTOR_KEY, true, true);
    const tokenAddress = '0x' + tokenId.toSolidityAddress();
    console.log("Token created at address", tokenAddress);

    await delay(5000);
    //We can use the IERC721 interface also to interact with the token
    const tokenInterface = await ethers.getContractAt("IERC20", tokenAddress);
    const balanceOfDeployer = await tokenInterface.balanceOf(deployer.address);
    console.log("Balance of deployer", balanceOfDeployer.toString());

    //Since the deployer is defined as the supplykey, we can mint tokens
    const mintTokenTx = await mintToken(tokenId, client, 100, {gasLimit: 1_000_000});
    console.log("Minted 100 tokens to treasury", mintTokenTx.hash);

    await delay(5000);
    const balanceOfDeployerAfterMint = await tokenInterface.balanceOf(deployer.address);
    console.log("Balance of deployer after mint", balanceOfDeployerAfterMint.toString());

    //We can transfer tokens from the treasury to the contract, first the contract need to associate the token
    //We will use the associate function in the contract to associate the token with it
    const associateTokenTx = await tokenCreateContract.associateTokenPublic(
        tokenCreateAddress,
        tokenAddress,
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token associated to contract tx hash", associateTokenTx.hash);

    //Check the balance of the otherWallet
    const balanceOfContract = await tokenInterface.balanceOf(tokenCreateAddress);
    console.log("Balance of Contract before transfer", balanceOfContract.toString());

    //We can now transfer tokens from the treasury to another account
    const transferTokenTx = await tokenInterface.transfer(
    tokenCreateAddress,
    100e8,
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

    //Check the balance of the deployer after the mint
    const balanceOfContractAfterTransfer = await tokenInterface.balanceOf(tokenCreateAddress);
    console.log("Balance of contract after", balanceOfContractAfterTransfer.toString());

    //We will use the IHRC719 so that an account can associate a token using a smart contract
    const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
    const associateTokenWithOtherWalletTx = await associateTokenInterface.connect(otherWallet).associate(
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token associated to account tx hash", associateTokenWithOtherWalletTx.hash);

    //We need to transfer some hbar to the contract so that he can pay the fixed fee
    const transferHbarTx = await transferHbar(client, process.env.OPERATOR_ID, tokenCreateAddress, 5);

    //Balance of the feeCollector and contract before transfer
    const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
    console.log("Balance of feeCollector before the Transfer", feeCollectorBalanceBeforeTransfer.toString());
    const contractTokenBalanceBeforeTransfer = await tokenInterface.balanceOf(tokenCreateAddress);
    console.log("Token balance of contract before the Transfer", contractTokenBalanceBeforeTransfer.toString());

    //We can now transfer tokens from the treasury to another account
    const secondTransferTokenTx = await tokenCreateContract.transferTokensPublic(
      tokenAddress,
      [tokenCreateAddress, otherWallet.address],
      [-100e8, 100e8],
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token transfer tx hash", secondTransferTokenTx.hash);

    //Balance of the otherWallet should be 90
    const balanceOfOW = await tokenInterface.balanceOf(otherWallet.address);
    console.log("Balance of otherWallet after the transfer", balanceOfOW.toString());

    //Balance should be increase by 1Hbar
    const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
    console.log("Hbar balance of feeCollector after the transfer", feeCollectorBalanceAfterTransfer.toString());

    //Balance of the fee collector should be 10% of the amount transferred
    const contractTokenBalanceAfterTransfer = await tokenInterface.balanceOf(feeCollector.address);
    console.log("Token balance of fee collector after the transfer", contractTokenBalanceAfterTransfer.toString());

 
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  

main();