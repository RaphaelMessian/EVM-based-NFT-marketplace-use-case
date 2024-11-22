//The purpose of this script is to demonstrate how to create a non fungible token with both fees and transfer using the IERC721
//The token is created with a fixed fee of 1 hbars for the feeCollector account and 10% royalties fee for the feeCollector and fallback fee of 0.0001Hbar, 
//the treasury and the supply key is the deployer
const {ethers} = require("hardhat");
const { createNFTWithFees, createToken, mintNFT, transferHbar, mintToken } = require("./../../../utils.js");
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
    const tokenIdForFixedfee = await createToken(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY);
    const tokenAddressForFixedFee = '0x' + tokenIdForFixedfee.toSolidityAddress();
    console.log("Token created at address", tokenAddressForFixedFee);

    //Since the deployer is defined as the supplykey, we can mint tokens
    const mintFTokenTx = await mintToken(tokenIdForFixedfee, client, 100);
    console.log("Minted 100 tokens to treasury", mintFTokenTx.hash);

    //This token need to be associated with the fee collector account in order to create the token
    //We will use the IHRC719 so that an account can associate a token using a smart contract
    const associateTokenInterfaceFixFee = await ethers.getContractAt("IHRC719", tokenAddressForFixedFee)
    const associateFTokenWithFeeCollectorTx = await associateTokenInterfaceFixFee.connect(feeCollector).associate(
        {
          gasLimit: 1_000_000,
        }
      );
    console.log("Token associated to account tx hash", associateFTokenWithFeeCollectorTx.hash);

    //Create a fungible token with hashgraph sdk, deployer is admin, supply and treasury
    const tokenId = await createNFTWithFees(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY, process.env.FEE_COLLECTOR_ID, tokenIdForFixedfee, true, true);
    const tokenAddress = '0x' + tokenId.toSolidityAddress();
    console.log("Token created at address", tokenAddress);

    //Since the deployer is defined as the supplykey, we can mint the NFT
    const mintTx = await mintNFT(tokenId, client);
    console.log("Token mint tx status", mintTx.status.toString());

    // await delay(5000);
    // const balanceOfDeployerAfter = await tokenInterface.balanceOf(deployer.address);
    // console.log("Balance of deployer after mint", balanceOfDeployerAfter.toString());

    //We need to associate the fixFee token with the contract to be able to transfer a the NFTtoken from the contract with a fixFee
    const associateTokenTx = await tokenCreateContract.associateTokenPublic(
        tokenCreateAddress,
        tokenAddressForFixedFee,
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token associated to contract tx hash", associateTokenTx.hash);

    //We can transfer tokens from the treasury to the contract, first the contract need to associate the NFT
    //We will use the associate function in the contract to associate the token with it
    const associateFixFeeTokenTx = await tokenCreateContract.associateTokenPublic(
      tokenCreateAddress,
      tokenAddress,
    {
      gasLimit: 1_000_000,
    }
  );
  console.log("Token associated to contract tx hash", associateFixFeeTokenTx.hash);

    //We can now transfer tokens from the treasury to another account
    const tokenInterface = await ethers.getContractAt("IERC721", tokenAddress);
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

    //Since we want to use the transferFrom function, we need to approve the otherWallet to spend the tokens
    const approveContract = await tokenCreateContract.approveFromERC721(tokenAddress, otherWallet.address, 1, {gasLimit: 2_000_000});
    console.log("Approval tx hash", approveContract.hash);

    const associateFTokenWithOWTx = await associateTokenInterfaceFixFee.connect(otherWallet).associate(
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token associated to account tx hash", associateFTokenWithOWTx.hash);

    //We associate with the wallet the NFT in order to be received
    const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
    const associateTokenWithOWTx = await associateTokenInterface.connect(otherWallet).associate(
      {
        gasLimit: 1_000_000,
      }
    );
    console.log("Token associated to account tx hash", associateTokenWithOWTx.hash);

    //We can use the ERC20 interface also to interact with the token
    const erc20Interface = await ethers.getContractAt("IERC20", tokenAddressForFixedFee);
    //Transfer some fixfee token to the contract that will pay for the fix fee and the otherWallet for the fallback fee
    const tranferFixFeeTokentoContract = await erc20Interface.transfer(tokenCreateAddress, 1e8, {gasLimit: 1_000_000});
    console.log("Transfer fixed fee token tx hash", tranferFixFeeTokentoContract.hash);

    const tranferFixFeeTokentoOtherWallet = await erc20Interface.transfer(otherWallet, 1e8, {gasLimit: 1_000_000});
    console.log("Transfer fixed fee token tx hash", tranferFixFeeTokentoOtherWallet.hash);

    //We can now transfer the NFT from the contract to the otherWallet
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

}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
