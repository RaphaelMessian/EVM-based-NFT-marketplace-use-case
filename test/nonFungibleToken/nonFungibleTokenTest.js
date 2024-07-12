const { expect } = require("chai");
const { ethers } = require('hardhat');
const {
    Client,
    TransactionId,
    PublicKey,
    TokenSupplyType,
    AccountId,
    PrivateKey
  } = require('@hashgraph/sdk');
const { createToken, mintToken, createTokenWithFees, transferHbar, createTokenWithMultipleFees } = require("../../scripts/utils");

describe('NonFungibleToken Test Suite', function () {

    let tokenCreateContract;
    let tokenCreateAddress;
    let signers;
    let deployer;
    let otherWallet;
    let feeCollector;
    let secondFeeCollector;
    let client;

    before(async function () {
        signers = await ethers.getSigners(); 
        [deployer, otherWallet, feeCollector, secondFeeCollector] = signers;
        const tokenCreateFactory = await ethers.getContractFactory(
            "NonFungiblePrecompiled"
            );
        tokenCreateContract = await tokenCreateFactory.deploy(
          {gasLimit: 1_000_000}
          );
        //const tokenCreateContract = await ethers.getContractAt("FungiblePrecompiled", "0x99625E9f612594db52aF7e76f43c6C7241A57ab3");
        tokenCreateAddress = await tokenCreateContract.getAddress();
        console.log("TokenCreateContract deployed to:", tokenCreateContract.target);
        client = Client.forTestnet();
        client.setOperator(process.env.OPERATOR_ID, PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY));
    });

    it.only('should transfer a fungible token with Hbar Fix Fee (1Hbar) for the fee collector and a 1 FTHTS for second fee collector, fractionnal fee of 10%', async function () {
       //Create a fungible token with hedera sdk, you need to instantiate a client to correct network
        const client = Client.forTestnet();
        client.setOperator(process.env.OPERATOR_ID, PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY));
        //Create a fungible token with hashgraph sdk, deployer is admin, supply and treasury
        const tokenIdForFixedfee = await createToken(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY);
        const tokenAddressForFixedFee = '0x' + tokenIdForFixedfee.toSolidityAddress();
        console.log("Token for fixedFee created at address", tokenAddressForFixedFee);
        await mintToken(tokenIdForFixedfee, client, 100);
        const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddressForFixedFee)
        await associateTokenInterface.connect(otherWallet).associate({ gasLimit: 1_000_000 });
        const erc20Interface = await ethers.getContractAt("IERC20", tokenAddressForFixedFee);
        await erc20Interface.transfer(otherWallet.address, 1e8, {gasLimit: 1_000_000});
        await associateTokenInterface.connect(secondFeeCollector).associate({ gasLimit: 1_000_000});
        await tokenCreateContract.associateTokenPublic(tokenCreateAddress, tokenAddressForFixedFee, { gasLimit: 1_000_000 });
        const params = {
            feeCollector: feeCollector.address, // feeCollector
            isFractionalFee: true, // isFractional
            isFixedFee: true, // isFixed
            feeAmount: 1e8,  // amount for fixedFee
            fixedFeeTokenAddress: '0x0000000000000000000000000000000000000000', //address for token of fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPayment: true, // if true the fee will be in Hbar
            useCurrentTokenForPayment: false, // if true use the current token for fixed fee
            isMultipleFixedFee: true, // if true mutliple fixed fee
            feeCollector2: secondFeeCollector.address,
            secondFixedFeeTokenAddress: tokenAddressForFixedFee, //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPaymentSecondFixFee: false,
            useCurrentTokenForPaymentSecondFixFee: false,
          };
        
        const royaltyParams = {
            feeCollector: tokenCreateAddress,
            isRoyaltyFee: true,
            feeAmount: 1e8,
            fixedFeeTokenAddress: '0x0000000000000000000000000000000000000000',
            useHbarsForPayment: true,
        }

        const createTokenTx = await tokenCreateContract.createNonFungibleTokenWithMultipleCustomFeesPublic(tokenCreateAddress, params, royaltyParams, { value: BigInt(35e18), gasLimit: 4_000_000,}); //30Hbar
        const txReceipt = await createTokenTx.wait();
        const tokenAddress = txReceipt.logs.filter(
        (e) => e.fragment.name === "CreatedToken"
        )[0].args[0];
        console.log("Token created at address", tokenAddress);
        await tokenCreateContract.mintTokenPublic(
                tokenAddress,
                0,
                ["0x"], 
            {
                gasLimit: 1_000_000,
            }
        );
        const associateTokenInterfaceNFT = await ethers.getContractAt("IHRC719", tokenAddress)
        await associateTokenInterfaceNFT.associate({ gasLimit: 1_000_000, });
        await tokenCreateContract.transferNFTsPublic(
                tokenAddress,
                [tokenCreateAddress],
                [deployer.address],
                [1],
            {
                gasLimit: 1_000_000,
            }
        );
        const tokenInterface = await ethers.getContractAt("IERC721", tokenAddress);
        await associateTokenInterfaceNFT.connect(otherWallet).associate({ gasLimit: 1_000_000, });
        await tokenInterface.approve(tokenCreateAddress, 1, {gasLimit: 1_000_000});
        const hbarApprovePublic = await ethers.getContractAt("IHRC632", otherWallet.address)
        await hbarApprovePublic.connect(otherWallet).hbarApprove(tokenCreateAddress, BigInt(100e18), {gasLimit: 2_000_000});
        const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
        const contractBalanceBeforeTransfer = await ethers.provider.getBalance(tokenCreateAddress);
        let cryptoTransfers = {
            transfers: [
            {
                accountID: otherWallet.address,
                amount: -20e8,
                isApproval: false,
            },
            {
                accountID: deployer.address,
                amount: 20e8,
                isApproval: false,
            },
            ],
        };
        let tokenTransferList = [
            {
            token: tokenAddress,
            transfers: [],
            nftTransfers: [
                {
                senderAccountID: deployer.address,
                receiverAccountID: otherWallet.address,
                serialNumber: 1,
                isApproval: false,
                },
            ],
            },
        ];

        const transferTokenToOWTx = await tokenCreateContract.cryptoTransferPublic(
        cryptoTransfers,
        tokenTransferList,
            {
            gasLimit: 1_000_000,
            }
        );
        console.log("Token transfer tx hash", transferTokenToOWTx.hash);
        const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
        const contractBalanceAfterTransfer = await ethers.provider.getBalance(tokenCreateAddress);
        const deployerBalanceAfterTransfer = await ethers.provider.getBalance(deployer.address);
        const secondFeeCollectorBalanceAfterTransfer = await erc20Interface.balanceOf(secondFeeCollector.address);
        const otherWalletTokenBalanceAfterTransfer = await tokenInterface.balanceOf(otherWallet.address);
        expect(otherWalletTokenBalanceAfterTransfer.toString()).to.equal("1");
        expect(deployerBalanceAfterTransfer.toString() === '17e8', 'Balance of otherWallet should be 90% of 20 for the royalties - 1Hbar fix fee');
        expect(contractBalanceBeforeTransfer.toString() === contractBalanceAfterTransfer.toString() + 2e8, 'Balance of contract should be 2Hbar from the royalties');
        expect(feeCollectorBalanceBeforeTransfer.toString() === feeCollectorBalanceAfterTransfer.toString() + 1e8, 'Balance of feeCollector should be 1Hbar from the fix fee');
        expect(secondFeeCollectorBalanceAfterTransfer.toString() === 1e8, 'Balance of secondFeeCollector should be 1 token from the fix fee');
      }).timeout(1000000);
});