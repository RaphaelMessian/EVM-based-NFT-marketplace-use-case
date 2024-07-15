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

    before(async function () {
        signers = await ethers.getSigners(); 
        [deployer, otherWallet, feeCollector, secondFeeCollector] = signers;
        const tokenCreateFactory = await ethers.getContractFactory(
            "NonFungiblePrecompiled"
            );
        tokenCreateContract = await tokenCreateFactory.deploy(
          {gasLimit: 1_000_000}
          );
        //const tokenCreateContract = await ethers.getContractAt("NonFungiblePrecompiled", "0x3E52d0e7EE6DE2669598D72aF37104D49B3999D1");
        tokenCreateAddress = await tokenCreateContract.getAddress();
        console.log("TokenCreateContract deployed to:", tokenCreateContract.target);
    });

    it('should transfer a non fungible token with Hbar Fix Fee (1Hbar) for the fee collector and a 1 FTHTS for second fee collector, royalties fee of 10% for the feeCollector', async function () {
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
            secondfeeAmount: 1e8,
            secondFixedFeeTokenAddress: tokenAddressForFixedFee, //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPaymentSecondFixFee: false,
            useCurrentTokenForPaymentSecondFixFee: false,
          };
        
          const royaltyParams = {
            feeCollector: feeCollector.address,
            isRoyaltyFee: true,
            feeAmount: 2e8,
            fixedFeeTokenAddress: '0x0000000000000000000000000000000000000000',
            useHbarsForPayment: true,
            isMultipleRoyaltyFee: false, // if true mutliple royalty fee
            feeCollector2: secondFeeCollector.address,
            secondfeeAmount: 1e8,
            secondFixedFeeTokenAddress: '0x0000000000000000000000000000000000000000', //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPaymentSecondFixFee: false,
            useCurrentTokenForPaymentSecondFixFee: false,
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
        expect(contractBalanceBeforeTransfer === contractBalanceAfterTransfer + BigInt(2e8), 'Balance of contract should be 2Hbar from the royalties');
        expect(feeCollectorBalanceBeforeTransfer === feeCollectorBalanceAfterTransfer + BigInt(2e8), 'Balance of feeCollector should be 1Hbar from the fix fee');
        expect(secondFeeCollectorBalanceAfterTransfer === BigInt(1e8), 'Balance of secondFeeCollector should be 1 token from the fix fee');
      }).timeout(1000000);

    it('should transfer a non fungible token with Hbar Fix Fee (1Hbar) for the fee collector and a 1 FTHTS for second fee collector, royalties fee of 10% for the fee collector and the second fee collector', async function () {
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
            secondfeeAmount: 1e8,
            secondFixedFeeTokenAddress: tokenAddressForFixedFee, //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPaymentSecondFixFee: false,
            useCurrentTokenForPaymentSecondFixFee: false,
        };
        
        const royaltyParams = {
            feeCollector: feeCollector.address,
            isRoyaltyFee: true,
            feeAmount: 2e8,
            fixedFeeTokenAddress: '0x0000000000000000000000000000000000000000',
            useHbarsForPayment: true,
            isMultipleRoyaltyFee: true, // if true mutliple fixed fee
            feeCollector2: secondFeeCollector.address,
            secondfeeAmount: 1e8,
            secondFixedFeeTokenAddress: tokenAddressForFixedFee, //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPaymentSecondFixFee: false,
            useCurrentTokenForPaymentSecondFixFee: false,
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
     expect(contractBalanceBeforeTransfer === contractBalanceAfterTransfer + BigInt(1e8), 'Balance of contract should be 2Hbar from the royalties');
     expect(feeCollectorBalanceBeforeTransfer === feeCollectorBalanceAfterTransfer + BigInt(1e8), 'Balance of feeCollector should be 1Hbar from the fix fee');
     expect(secondFeeCollectorBalanceAfterTransfer === BigInt(1e8), 'Balance of secondFeeCollector should be 1 token from the fix fee');
    }).timeout(1000000);

    it('should transfer a non fungible token with Hbar Fix Fee 3Hbar for the fee collector and a 1Hbar for second fee collector, no value exchange so fallback fee should be triggered (2hbar for feeC and 1Hbar for feeC2)', async function () {
        const client = Client.forTestnet();
        client.setOperator(process.env.OPERATOR_ID, PrivateKey.fromStringECDSA(process.env.OPERATOR_KEY));
        const params = {
            feeCollector: feeCollector.address, // feeCollector
            isFractionalFee: true, // isFractional
            isFixedFee: true, // isFixed
            feeAmount: 3e8,  // amount for fixedFee
            fixedFeeTokenAddress: '0x0000000000000000000000000000000000000000', //address for token of fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPayment: true, // if true the fee will be in Hbar
            useCurrentTokenForPayment: false, // if true use the current token for fixed fee
            isMultipleFixedFee: true, // if true mutliple fixed fee
            feeCollector2: secondFeeCollector.address,
            secondfeeAmount: 1e8,
            secondFixedFeeTokenAddress: "0x0000000000000000000000000000000000000000", //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPaymentSecondFixFee: true,
            useCurrentTokenForPaymentSecondFixFee: false,
        };
        
        const royaltyParams = {
            feeCollector: feeCollector.address,
            isRoyaltyFee: true,
            feeAmount: 2e8,
            fixedFeeTokenAddress: '0x0000000000000000000000000000000000000000',
            useHbarsForPayment: true,
            isMultipleRoyaltyFee: true, // if true mutliple fixed fee
            feeCollector2: secondFeeCollector.address,
            secondfeeAmount: 1e8,
            secondFixedFeeTokenAddress: "0x0000000000000000000000000000000000000000", //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPaymentSecondFixFee: true,
            useCurrentTokenForPaymentSecondFixFee: false,
        }

        const createTokenTx = await tokenCreateContract.createNonFungibleTokenWithMultipleCustomFeesPublic(tokenCreateAddress, params, royaltyParams, { value: BigInt(35e18), gasLimit: 3_000_000,}); //30Hbar
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
        const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
        const secondFeeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(secondFeeCollector.address);
        await tokenInterface.approve(otherWallet.address, 1, {gasLimit: 1_000_000});

        const transferTokenTx = await tokenInterface.connect(otherWallet).transferFrom(deployer.address, otherWallet.address, 1, {gasLimit: 1_000_000});
        console.log("Token transfer tx hash", transferTokenTx.hash);

        const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
        const secondFeeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(secondFeeCollector.address);
        const otherWalletTokenBalanceAfterTransfer = await tokenInterface.balanceOf(otherWallet.address);
        expect(otherWalletTokenBalanceAfterTransfer.toString()).to.equal("1");
        expect(secondFeeCollectorBalanceBeforeTransfer === secondFeeCollectorBalanceAfterTransfer + BigInt(3e8), 'Balance of contract should be 2Hbar from the royalties');
        expect(feeCollectorBalanceBeforeTransfer === feeCollectorBalanceAfterTransfer + BigInt(3e8), 'Balance of feeCollector should be 1Hbar from the fix fee');
    }).timeout(1000000);

    it('should transfer a non fungible token with Hbar Fix Fee 3Hbar for the fee collector and a 1Fungible HTS for second fee collector, no value exchange so fallback fee should be triggered (2Fungible HTS for feeC and 1Fungible HTS for feeC2)', async function () {
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
        await erc20Interface.transfer(otherWallet.address, 5e8, {gasLimit: 1_000_000});
        await associateTokenInterface.connect(secondFeeCollector).associate({ gasLimit: 1_000_000});
        await associateTokenInterface.connect(feeCollector).associate({ gasLimit: 1_000_000});
        await erc20Interface.transfer(feeCollector.address, 5e8, {gasLimit: 1_000_000});
        await tokenCreateContract.associateTokenPublic(tokenCreateAddress, tokenAddressForFixedFee, { gasLimit: 1_000_000 });
        const params = {
            feeCollector: feeCollector.address, // feeCollector
            isFractionalFee: true, // isFractional
            isFixedFee: true, // isFixed
            feeAmount: 3e8,  // amount for fixedFee
            fixedFeeTokenAddress: '0x0000000000000000000000000000000000000000', //address for token of fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPayment: true, // if true the fee will be in Hbar
            useCurrentTokenForPayment: false, // if true use the current token for fixed fee
            isMultipleFixedFee: true, // if true mutliple fixed fee
            feeCollector2: secondFeeCollector.address,
            secondfeeAmount: 1e8,
            secondFixedFeeTokenAddress: tokenAddressForFixedFee, //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPaymentSecondFixFee: false,
            useCurrentTokenForPaymentSecondFixFee: false,
        };
        
        const royaltyParams = {
            feeCollector: feeCollector.address,
            isRoyaltyFee: true,
            feeAmount: 2e8,
            fixedFeeTokenAddress: tokenAddressForFixedFee,
            useHbarsForPayment: false,
            isMultipleRoyaltyFee: true, // if true mutliple fixed fee
            feeCollector2: secondFeeCollector.address,
            secondfeeAmount: 1e8,
            secondFixedFeeTokenAddress: tokenAddressForFixedFee, //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPaymentSecondFixFee: false,
            useCurrentTokenForPaymentSecondFixFee: false,
        }

        const createTokenTx = await tokenCreateContract.createNonFungibleTokenWithMultipleCustomFeesPublic(tokenCreateAddress, params, royaltyParams, { value: BigInt(35e18), gasLimit: 3_000_000,}); //30Hbar
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
        const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
        const feeCollectorBalanceBeforeFTTransfer = await erc20Interface.balanceOf(feeCollector.address);
        const secondFeeCollectorBalanceFTBeforeTransfer = await erc20Interface.balanceOf(secondFeeCollector.address);
        await tokenInterface.approve(otherWallet.address, 1, {gasLimit: 1_000_000});

        const transferTokenTx = await tokenInterface.connect(otherWallet).transferFrom(deployer.address, otherWallet.address, 1, {gasLimit: 1_000_000});
        console.log("Token transfer tx hash", transferTokenTx.hash);

        const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
        const feeCollectorBalanceFTAfterTransfer = await erc20Interface.balanceOf(feeCollector.address)
        const secondFeeCollectorFTBalanceAfterTransfer = await erc20Interface.balanceOf(secondFeeCollector.address)
        const otherWalletTokenBalanceAfterTransfer = await tokenInterface.balanceOf(otherWallet.address);
        expect(otherWalletTokenBalanceAfterTransfer.toString()).to.equal("1");
        expect(secondFeeCollectorBalanceFTBeforeTransfer === secondFeeCollectorFTBalanceAfterTransfer + BigInt(3e8), 'Balance of contract should be 2Hbar from the royalties');
        expect(feeCollectorBalanceBeforeTransfer === feeCollectorBalanceAfterTransfer + BigInt(2e8), 'Balance of feeCollector should be increase by 2 FTHTS from the fallbackfee and the fixfee');
        expect(feeCollectorBalanceBeforeFTTransfer === feeCollectorBalanceFTAfterTransfer + BigInt(2e8), 'Balance of feeCollector should be increase by 2 FTHTS from the fallbackfee and the fixfee');
    }).timeout(1000000);

    it('Fix Fee > amount traded', async function () {
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
        await erc20Interface.transfer(otherWallet.address, 5e8, {gasLimit: 1_000_000});
        await associateTokenInterface.connect(secondFeeCollector).associate({ gasLimit: 1_000_000});
        await associateTokenInterface.connect(feeCollector).associate({ gasLimit: 1_000_000});
        await erc20Interface.transfer(feeCollector.address, 5e8, {gasLimit: 1_000_000});
        await tokenCreateContract.associateTokenPublic(tokenCreateAddress, tokenAddressForFixedFee, { gasLimit: 1_000_000 });
        const params = {
            feeCollector: feeCollector.address, // feeCollector
            isFractionalFee: true, // isFractional
            isFixedFee: true, // isFixed
            feeAmount: 15e8,  // amount for fixedFee
            fixedFeeTokenAddress: '0x0000000000000000000000000000000000000000', //address for token of fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPayment: true, // if true the fee will be in Hbar
            useCurrentTokenForPayment: false, // if true use the current token for fixed fee
            isMultipleFixedFee: true, // if true mutliple fixed fee
            feeCollector2: secondFeeCollector.address,
            secondfeeAmount: 1e8,
            secondFixedFeeTokenAddress: tokenAddressForFixedFee, //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPaymentSecondFixFee: false,
            useCurrentTokenForPaymentSecondFixFee: false,
        };
        
        const royaltyParams = {
            feeCollector: feeCollector.address,
            isRoyaltyFee: true,
            feeAmount: 2e8,
            fixedFeeTokenAddress: tokenAddressForFixedFee,
            useHbarsForPayment: false,
            isMultipleRoyaltyFee: true, // if true mutliple fixed fee
            feeCollector2: secondFeeCollector.address,
            secondfeeAmount: 1e8,
            secondFixedFeeTokenAddress: "0x0000000000000000000000000000000000000000", //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
            useHbarsForPaymentSecondFixFee: true,
            useCurrentTokenForPaymentSecondFixFee: false,
        }

        const createTokenTx = await tokenCreateContract.createNonFungibleTokenWithMultipleCustomFeesPublic(tokenCreateAddress, params, royaltyParams, { value: BigInt(35e18), gasLimit: 3_000_000,}); //30Hbar
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
        const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
        const secondFeeCollectorBalanceFTBeforeTransfer = await erc20Interface.balanceOf(secondFeeCollector.address);
        await tokenInterface.approve(tokenCreateAddress, 1, {gasLimit: 1_000_000});
        const hbarApprovePublic = await ethers.getContractAt("IHRC632", otherWallet.address)
        await hbarApprovePublic.connect(otherWallet).hbarApprove(tokenCreateAddress, BigInt(100e18), {gasLimit: 2_000_000});
        let cryptoTransfers = {
            transfers: [
            {
                accountID: otherWallet.address,
                amount: -10e8,
                isApproval: false,
            },
            {
                accountID: deployer.address,
                amount: 10e8,
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

        const transferTokenToOWTx = await tokenCreateContract.connect(otherWallet).cryptoTransferPublic(
        cryptoTransfers,
        tokenTransferList,
            {
            gasLimit: 1_000_000,
            }
        );
        console.log("Token transfer tx hash", transferTokenToOWTx.hash);
        const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
        const secondFeeCollectorFTBalanceAfterTransfer = await erc20Interface.balanceOf(secondFeeCollector.address)
        const otherWalletTokenBalanceAfterTransfer = await tokenInterface.balanceOf(otherWallet.address);
        expect(otherWalletTokenBalanceAfterTransfer.toString()).to.equal("1");
        expect(secondFeeCollectorBalanceFTBeforeTransfer === secondFeeCollectorFTBalanceAfterTransfer + BigInt(1e8), 'Balance of contract should be 1FT HTS from the fixfee');
        expect(feeCollectorBalanceBeforeTransfer === feeCollectorBalanceAfterTransfer + BigInt(16e8), 'Balance of feeCollector should be increase by 16Hbar from the fallbackfee (15) and the fixfee (1)');
    }).timeout(1000000);
});