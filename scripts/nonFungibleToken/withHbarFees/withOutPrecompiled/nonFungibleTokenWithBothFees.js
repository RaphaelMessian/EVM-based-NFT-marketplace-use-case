//The purpose of this script is to demonstrate how to create a non fungible token with both fees and transfer using the IERC721
//The token is created with a fixed fee of 1 hbars for the feeCollector account and 10% royalties fee for the feeCollector and fallback fee of 0.0001Hbar, 
//the treasury and the supply key is the deployer
const {ethers} = require("hardhat");
const { createNFTWithFees, mintNFT, transferHbar } = require("./../../../utils.js");
const { Client, PrivateKey } = require("@hashgraph/sdk");


async function main() {
    signers = await ethers.getSigners(); 
    [deployer, otherWallet, feeCollector] = signers;

    const tokenCreateFactory = await ethers.getContractFactory(
        "NonFungiblePrecompiled"
        );
    const tokenCreateContract = await tokenCreateFactory.deploy(
      {gasLimit: 1_000_000}
      );
    const tokenCreateAddress = await tokenCreateContract.getAddress();
    console.log("TokenCreateContract deployed to:", tokenCreateAddress);

    //Create a fungible token with hedera sdk, you need to instantiate a client to correct network
    const client = Client.forName(process.env.HEDERA_NETWORK); 
    client.setOperator(process.env.OPERATOR_ID, PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY));
     //Create a fungible token with hashgraph sdk, deployer is admin, supply and treasury
    const tokenId = await createNFTWithFees(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY, process.env.FEE_COLLECTOR_ID, true, true);
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
    const balanceOfOtherWallet = await tokenInterface.balanceOf(tokenCreateAddress);
    console.log("Balance of otherwallet", balanceOfOtherWallet.toString());

    //We can now transfer tokens from the treasury to another account
    const transferTokenTx = await tokenInterface.transferFrom(
      deployer.address,
      tokenCreateAddress,
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
    const balanceOfOtherWalletAfterTransfer = await tokenInterface.balanceOf(tokenCreateAddress);
    console.log("Balance of contract after", balanceOfOtherWalletAfterTransfer.toString());

    //Here since the transfer is from the treasury, the fees are not applied
    //If we want the fee to be applied the transfer must take place between 2 accounts that are not part of the feeCollector.
    // let associate first the token with the otherWallet
    //We will use the IHRC719 so that an account can associate a token using a smart contract
    const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
    const associateTokenWithOWTx = await associateTokenInterface.connect(otherWallet).associate(
        {
          gasLimit: 1_000_000,
        }
      );
    console.log("Token associated to account tx hash", associateTokenWithOWTx.hash);

    //Since we want to use the transferFrom function, we need to approve the otherWallet to spend the tokens
    const approveContract = await tokenCreateContract.approveFromERC721(tokenAddress, otherWallet.address, 1, {gasLimit: 2_000_000});
    console.log("Approval tx hash", approveContract.hash);

    //We need to transfer some hbar to the contract so that he can pay the fixed fee
    const transferHbarTx = await transferHbar(client, process.env.OPERATOR_ID, tokenCreateAddress, 5);

    delay(5000);
    //Balance of the feeCollector and contract before transfer
    const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
    console.log("Hbar Balance of feeCollector before the Transfer", feeCollectorBalanceBeforeTransfer.toString());
    const contractBalanceBeforeTransfer = await ethers.provider.getBalance(tokenCreateAddress);
    console.log("Hbar Balance of contract before the Transfer", contractBalanceBeforeTransfer.toString());
    const otherWalletBalanceBeforeTransfer = await ethers.provider.getBalance(otherWallet.address);
    console.log("Hbar Balance of otherWallet after the Transfer", otherWalletBalanceBeforeTransfer.toString());

    const secondTransferTokenTx = await tokenInterface.connect(otherWallet).transferFrom(
        tokenCreateAddress,
        otherWallet.address,
        1,
        {
          gasLimit: 1_000_000,
        }
      );
    console.log("Second Token transfer tx hash", secondTransferTokenTx.hash);

    const secondReceipt = await transferTokenTx.wait();

    // Find the Transfer event in the transaction receipt
    const SecondTransferEvent = secondReceipt.logs.filter(
          (e) => e.fragment.name === "Transfer"
        )[0].args;
    console.log("Second Transfer event details:", SecondTransferEvent);

    delay(5000);
    //Balance of the feeCollector and contract after transfer
    const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
    console.log("Hbar Balance of feeCollector after the Transfer", feeCollectorBalanceAfterTransfer.toString());
    const otherWalletBalanceAfterTransfer = await ethers.provider.getBalance(otherWallet.address);
    console.log("Hbar Balance of otherWallet after the Transfer", otherWalletBalanceAfterTransfer.toString());
    const contractBalanceAfterTransfer = await ethers.provider.getBalance(tokenCreateAddress);
    console.log("Hbar Balance of contract after the Transfer", contractBalanceAfterTransfer.toString());
    //Balance should be 10% of the amount transferred
    const otherWalletTokenBalanceAfterTransfer = await tokenInterface.balanceOf(otherWallet.address);
    console.log("NFT balance of otherWallet after the Transfer", otherWalletTokenBalanceAfterTransfer.toString());

    //Since we are using the transferFrom function, they are no value exchange during the transfer so only the fallback fee is applied
    //If we want to apply the royalties fee, we need to use the precompiled contract

}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
