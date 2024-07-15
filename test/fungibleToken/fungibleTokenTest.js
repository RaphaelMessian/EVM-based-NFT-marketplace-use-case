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


describe('FungibleToken Test Suite', function () {

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
            "FungiblePrecompiled"
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

    describe('fungible Token with Precompiled contract, the contract will be the treasury, supply and admin of the fungible token', function () {
      it('should transfer a fungible token with Hbar Fix Fee (1Hbar) and Fractionnal fee 10% for fee collector', async function () {
        const createTokenTx = await tokenCreateContract.createFungibleTokenWithCustomFeePublic(
          tokenCreateAddress, // treasury
          feeCollector.address, // feeCollector
          true, // isFractional
          true, // isFixed
          BigInt(1e8),  // amount for fixedFee
          '0x0000000000000000000000000000000000000000', //address for token of fixedFee, if set to 0x0, the fee will be in hbars
          true, // if true the fee will be in Hbar
          false, // if true use the current token for fixed fee
          {
            value: '30000000000000000000', // = 30 hbars
            gasLimit: 3_000_000,
          }
        ); 
        const createTokenReceipt = await createTokenTx.wait();
        const tokenAddress = createTokenReceipt.logs.filter((e) => e.fragment.name === "CreatedToken")[0].args[0];
        console.log("Token created at address", tokenAddress);
        const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
        const tokenInterface = await ethers.getContractAt("IERC20", tokenAddress);
        await tokenCreateContract.mintTokenPublic(
          tokenAddress,
          100e8,
          [], 
          {
            gasLimit: 1_000_000,
          }
        );
        await associateTokenInterface.associate({ gasLimit: 1_000_000,});
        await tokenCreateContract.transferTokensPublic(
          tokenAddress,
          [tokenCreateAddress, deployer.address],
          [-100e8, 100e8],
          {
            gasLimit: 1_000_000,
          }
        );
        await associateTokenInterface.connect(otherWallet).associate({gasLimit: 1_000_000,});
        await tokenInterface.approve(tokenCreateAddress, 100e8, {gasLimit: 1_000_000});
        const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
        const transferTx = await tokenCreateContract.transferTokensPublic(
          tokenAddress,
          [deployer.address, otherWallet.address],
          [-100e8, 100e8],
          {
            gasLimit: 1_000_000,
          }
        );
        console.log("Token transfer tx hash", transferTx.hash);
        const balanceOfOW = await tokenInterface.balanceOf(otherWallet.address);
        const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
        const contractTokenBalanceAfterTransfer = await tokenInterface.balanceOf(tokenCreateAddress);
        expect(feeCollectorBalanceAfterTransfer === feeCollectorBalanceBeforeTransfer + BigInt(1e8), 'Balance of feeCollector should be increase by one');
        expect(balanceOfOW === BigInt(90e8), 'Balance of otherWallet should be 90');
        expect(contractTokenBalanceAfterTransfer === BigInt(10e8), 'Balance of contract should be 10');
      }).timeout(1000000);
  
      it('should transfer a fungible token with Hbar Fix Fee (1Hbar) for the contract and a second fee collector, fractionnal fee of 10%', async function () {
        const params = {
          feeCollector: tokenCreateAddress, // feeCollector
          isFractionalFee: true, // isFractional
          isFixedFee: true, // isFixed
          feeAmount: 1e8,  // amount for fixedFee
          fixedFeeTokenAddress: '0x0000000000000000000000000000000000000000', //address for token of fixedFee, if set to 0x0, the fee will be in hbars
          useHbarsForPayment: true, // if true the fee will be in Hbar
          useCurrentTokenForPayment: false, // if true use the current token for fixed fee
          isMultipleFixedFee: true, // if true mutliple fixed fee
          feeCollector2: secondFeeCollector.address,
          secondFixedFeeTokenAddress: '0x0000000000000000000000000000000000000000', //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
          useHbarsForPaymentSecondFixFee: true,
          useCurrentTokenForPaymentSecondFixFee: false,
        };
        const createTokenTx = await tokenCreateContract.createFungibleTokenWithMultipleCustomFeePublic(tokenCreateAddress, params, { value: BigInt(35e18), gasLimit: 4_000_000,}); //30Hbar
        const createTokenReceipt = await createTokenTx.wait();
        const tokenAddress = createTokenReceipt.logs.filter((e) => e.fragment.name === "CreatedToken")[0].args[0];
        console.log("Token created at address", tokenAddress);
        const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
        const tokenInterface = await ethers.getContractAt("IERC20", tokenAddress);
        await tokenCreateContract.mintTokenPublic(
          tokenAddress,
          100e8,
          [], 
          {
            gasLimit: 1_000_000,
          }
        );
        await associateTokenInterface.associate({ gasLimit: 1_000_000,});
        await tokenCreateContract.transferTokensPublic(
          tokenAddress,
          [tokenCreateAddress, deployer.address],
          [-100e8, 100e8],
          {
            gasLimit: 1_000_000,
          }
        );
        await associateTokenInterface.connect(otherWallet).associate({gasLimit: 1_000_000,});
        await tokenInterface.approve(tokenCreateAddress, 100e8, {gasLimit: 1_000_000});
        const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
        const secondFeeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(secondFeeCollector.address);
        const transferTx = await tokenCreateContract.transferTokensPublic(
          tokenAddress,
          [deployer.address, otherWallet.address],
          [-100e8, 100e8],
          {
            gasLimit: 1_000_000,
          }
        );
        console.log("Token transfer tx hash", transferTx.hash);
        const balanceOfOW = await tokenInterface.balanceOf(otherWallet.address);
        const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
        const secondFeeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(secondFeeCollector.address);
        const contractTokenBalanceAfterTransfer = await tokenInterface.balanceOf(tokenCreateAddress);
        expect(feeCollectorBalanceAfterTransfer === feeCollectorBalanceBeforeTransfer + BigInt(1e8), 'Balance of feeCollector should be increase by one');
        expect(secondFeeCollectorBalanceAfterTransfer === secondFeeCollectorBalanceBeforeTransfer + BigInt(1e8), 'Balance of secondFeeCollector should be increase by one');
        expect(balanceOfOW === BigInt(90e8), 'Balance of otherWallet should be 90');
        expect(contractTokenBalanceAfterTransfer === BigInt(10e8), 'Balance of contract should be 10');
      }).timeout(1000000);
  
      it('should transfer a fungible token with Hbar Fix Fee (1Hbar) for the contract and a 1 FTHTS for second fee collector, fractionnal fee of 10%', async function () {
        const tokenIdForFixedfee = await createToken(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY);
        const tokenAddressForFixedFee = '0x' + tokenIdForFixedfee.toSolidityAddress();
        await mintToken(tokenIdForFixedfee, client, 100);
        const fixFeeTokenInterface = await ethers.getContractAt("IERC20",  tokenAddressForFixedFee);
        const associateTokenInterfaceFixFee = await ethers.getContractAt("IHRC719", tokenAddressForFixedFee)
        await associateTokenInterfaceFixFee.connect(secondFeeCollector).associate({gasLimit: 1_000_000,});
        const params = {
          feeCollector: tokenCreateAddress, // feeCollector
          isFractionalFee: true, // isFractional
          isFixedFee: true, // isFixed
          feeAmount: BigInt(1e8),  // amount for fixedFee
          fixedFeeTokenAddress: '0x0000000000000000000000000000000000000000', //address for token of fixedFee, if set to 0x0, the fee will be in hbars
          useHbarsForPayment: true, // if true the fee will be in Hbar
          useCurrentTokenForPayment: false, // if true use the current token for fixed fee
          isMultipleFixedFee: true, // if true mutliple fixed fee
          feeCollector2: secondFeeCollector.address,
          secondFixedFeeTokenAddress: tokenAddressForFixedFee, //address for token of second fixedFee, if set to 0x0, the fee will be in hbars
          useHbarsForPaymentSecondFixFee: false,
          useCurrentTokenForPaymentSecondFixFee: false,
        };
        const createTokenTx = await tokenCreateContract.createFungibleTokenWithMultipleCustomFeePublic(tokenCreateAddress, params, { value: BigInt(35e18), gasLimit: 4_000_000,}); //30Hbar
        const createTokenReceipt = await createTokenTx.wait();
        const tokenAddress = createTokenReceipt.logs.filter((e) => e.fragment.name === "CreatedToken")[0].args[0];
        console.log("Token created at address", tokenAddress);
        const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
        const tokenInterface = await ethers.getContractAt("IERC20", tokenAddress);
        await tokenCreateContract.mintTokenPublic(
          tokenAddress,
          100e8,
          [], 
          {
            gasLimit: 1_000_000,
          }
        );
        await associateTokenInterface.associate({ gasLimit: 1_000_000,});
        await tokenCreateContract.transferTokensPublic(
          tokenAddress,
          [tokenCreateAddress, deployer.address],
          [-100e8, 100e8],
          {
            gasLimit: 1_000_000,
          }
        );
        await associateTokenInterface.connect(otherWallet).associate({gasLimit: 1_000_000,});
        await tokenInterface.approve(tokenCreateAddress, 100e8, {gasLimit: 1_000_000});
        const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
        const secondFeeCollectorBalanceBeforeTransfer = await fixFeeTokenInterface.balanceOf(secondFeeCollector.address);
        const transferTx = await tokenCreateContract.transferTokensPublic(
          tokenAddress,
          [deployer.address, otherWallet.address],
          [-100e8, 100e8],
          {
            gasLimit: 1_000_000,
          }
        );
        console.log("Token transfer tx hash", transferTx.hash);
        const balanceOfOW = await tokenInterface.balanceOf(otherWallet.address);
        const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
        const secondFeeCollectorBalanceAfterTransfer = await fixFeeTokenInterface.balanceOf(secondFeeCollector.address);
        const contractTokenBalanceAfterTransfer = await tokenInterface.balanceOf(tokenCreateAddress);
        expect(feeCollectorBalanceAfterTransfer === feeCollectorBalanceBeforeTransfer + BigInt(BigInt(1e8)), 'Balance of feeCollector should be increase by one');
        expect(secondFeeCollectorBalanceAfterTransfer === secondFeeCollectorBalanceBeforeTransfer + BigInt(1e8), 'Balance of secondFeeCollector should be increase by one');
        expect(balanceOfOW === BigInt(90e8), 'Balance of otherWallet should be 90');
        expect(contractTokenBalanceAfterTransfer === BigInt(10e8), 'Balance of contract should be 10');
      }).timeout(1000000);
    });

    describe('fungible Token with SDK and ERC20', function () {
      it('should transfer a fungible token with Hbar Fix Fee (1Hbar) for the fee collector fractionnal fee of 10%', async function () {
        const tokenId = await createTokenWithFees(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY, process.env.FEE_COLLECTOR_ID, process.env.FEE_COLLECTOR_KEY, null, true, true);
        const tokenAddress = '0x' + tokenId.toSolidityAddress();
        console.log("Token created at address", tokenAddress);
        const tokenInterface = await ethers.getContractAt("IERC20", tokenAddress);
        await mintToken(tokenId, client, 100);
        await transferHbar(client, process.env.OPERATOR_ID, tokenCreateAddress, 5);
        await tokenCreateContract.associateTokenPublic(
            tokenCreateAddress,
            tokenAddress,
          {
            gasLimit: 1_000_000,
          }
        );
        await tokenInterface.transfer(
            tokenCreateAddress,
            100e8,
          {
              gasLimit: 1_000_000,
          }
        );
        const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
        await associateTokenInterface.connect(otherWallet).associate({gasLimit: 1_000_000});
        await tokenCreateContract.approveFromERC20(tokenAddress, otherWallet.address, 100e8, {gasLimit: 2_000_000});
        const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
        const secondTransferTokenTx = await tokenInterface.connect(otherWallet).transferFrom(
          tokenCreateAddress,
          otherWallet.address,
          10e8,
          {
            gasLimit: 2_000_000,
          }
        );
        console.log("Token transfer tx hash", secondTransferTokenTx.hash);
        const balanceOfOW = await tokenInterface.balanceOf(otherWallet.address);
        const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
        const contractTokenBalanceAfterTransfer = await tokenInterface.balanceOf(tokenCreateAddress);
        expect(feeCollectorBalanceAfterTransfer === feeCollectorBalanceBeforeTransfer + BigInt(1e8), 'Balance of feeCollector should be increase by one');
        expect(balanceOfOW === BigInt(90e8), 'Balance of otherWallet should be 90');
        expect(contractTokenBalanceAfterTransfer === BigInt(10e8), 'Balance of contract should be 10');
      }).timeout(1000000);

      it('should transfer a fungible token with Hbar Fix Fee (1Hbar) for the fee collector and a second fee collector, fractionnal fee of 10%', async function () {
        const tokenId = await createTokenWithMultipleFees(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY, process.env.FEE_COLLECTOR_ID, process.env.FEE_COLLECTOR_KEY, null,
        process.env.SECOND_FEE_COLLECTOR_ID, process.env.SECOND_FEE_COLLECTOR_KEY, null);
        const tokenAddress = '0x' + tokenId.toSolidityAddress();
        console.log("Token created at address", tokenAddress);
        const tokenInterface = await ethers.getContractAt("IERC20", tokenAddress);
        await mintToken(tokenId, client, 100);
        await transferHbar(client, process.env.OPERATOR_ID, tokenCreateAddress, 5);
        await tokenCreateContract.associateTokenPublic(
            tokenCreateAddress,
            tokenAddress,
          {
            gasLimit: 1_000_000,
          }
        );
        await tokenInterface.transfer(
            tokenCreateAddress,
            100e8,
          {
              gasLimit: 1_000_000,
          }
        );
        const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
        await associateTokenInterface.connect(otherWallet).associate({gasLimit: 1_000_000});
        await tokenCreateContract.approveFromERC20(tokenAddress, otherWallet.address, 100e8, {gasLimit: 2_000_000});
        const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
        const secondFeeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(secondFeeCollector.address);
        const secondTransferTokenTx = await tokenInterface.connect(otherWallet).transferFrom(
          tokenCreateAddress,
          otherWallet.address,
          10e8,
          {
            gasLimit: 2_000_000,
          }
        );
        console.log("Token transfer tx hash", secondTransferTokenTx.hash);
        const balanceOfOW = await tokenInterface.balanceOf(otherWallet.address);
        const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
        const contractTokenBalanceAfterTransfer = await tokenInterface.balanceOf(tokenCreateAddress);
        const secondFeeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(secondFeeCollector.address);
        expect(feeCollectorBalanceAfterTransfer === feeCollectorBalanceBeforeTransfer + BigInt(1e8), 'Balance of feeCollector should be increase by one');
        expect(secondFeeCollectorBalanceAfterTransfer === secondFeeCollectorBalanceBeforeTransfer + BigInt(1e8), 'Balance of secondFeeCollector should be increase by one');
        expect(balanceOfOW === BigInt(90e8), 'Balance of otherWallet should be 90');
        expect(contractTokenBalanceAfterTransfer === BigInt(10e8), 'Balance of contract should be 10');
      }).timeout(1000000);

      it('should transfer a fungible token with Hbar Fix Fee (1Hbar) for the fee collector and a 1 FTHTS for second fee collector, fractionnal fee of 10%', async function () {
        const tokenIdForFixedfee = await createToken(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY);
        const tokenAddressForFixedFee = '0x' + tokenIdForFixedfee.toSolidityAddress();
        await mintToken(tokenIdForFixedfee, client, 100);
        const fixFeeTokenInterface = await ethers.getContractAt("IERC20",  tokenAddressForFixedFee);
        const associateTokenInterfaceFixFee = await ethers.getContractAt("IHRC719", tokenAddressForFixedFee)
        await associateTokenInterfaceFixFee.connect(secondFeeCollector).associate({gasLimit: 1_000_000,});
        const tokenId = await createTokenWithMultipleFees(client, process.env.OPERATOR_ID, process.env.OPERATOR_KEY, process.env.FEE_COLLECTOR_ID, process.env.FEE_COLLECTOR_KEY, null,
        process.env.SECOND_FEE_COLLECTOR_ID, process.env.SECOND_FEE_COLLECTOR_KEY, tokenIdForFixedfee);
        const tokenAddress = '0x' + tokenId.toSolidityAddress();
        console.log("Token created at address", tokenAddress);
        const tokenInterface = await ethers.getContractAt("IERC20", tokenAddress);
        await mintToken(tokenId, client, 100);
        await transferHbar(client, process.env.OPERATOR_ID, tokenCreateAddress, 5);
        await tokenCreateContract.associateTokenPublic(
            tokenCreateAddress,
            tokenAddress,
          {
            gasLimit: 1_000_000,
          }
        );
        await tokenCreateContract.associateTokenPublic(
          tokenCreateAddress,
          tokenAddressForFixedFee,
        {
          gasLimit: 1_000_000,
        }
      );
        await tokenInterface.transfer(
            tokenCreateAddress,
            100e8,
          {
              gasLimit: 1_000_000,
          }
        );
        const associateTokenInterface = await ethers.getContractAt("IHRC719", tokenAddress)
        await associateTokenInterface.connect(otherWallet).associate({gasLimit: 1_000_000});
        await tokenCreateContract.approveFromERC20(tokenAddress, otherWallet.address, 100e8, {gasLimit: 2_000_000});
        const erc20Interface = await ethers.getContractAt("IERC20", tokenAddressForFixedFee);
        await erc20Interface.transfer(tokenCreateAddress, BigInt(1e8), {gasLimit: 1_000_000});
        const feeCollectorBalanceBeforeTransfer = await ethers.provider.getBalance(feeCollector.address);
        const secondFeeCollectorBalanceBeforeTransfer = await fixFeeTokenInterface.balanceOf(secondFeeCollector.address);
        const secondTransferTokenTx = await tokenInterface.connect(otherWallet).transferFrom(
          tokenCreateAddress,
          otherWallet.address,
          10e8,
          {
            gasLimit: 2_000_000,
          }
        );
        console.log("Token transfer tx hash", secondTransferTokenTx.hash);
        const balanceOfOW = await tokenInterface.balanceOf(otherWallet.address);
        const feeCollectorBalanceAfterTransfer = await ethers.provider.getBalance(feeCollector.address);
        const contractTokenBalanceAfterTransfer = await tokenInterface.balanceOf(tokenCreateAddress);
        const secondFeeCollectorBalanceAfterTransfer = await fixFeeTokenInterface.balanceOf(secondFeeCollector.address);
        expect(feeCollectorBalanceAfterTransfer === feeCollectorBalanceBeforeTransfer + BigInt(1e8), 'Balance of feeCollector should be increase by one');
        expect(secondFeeCollectorBalanceAfterTransfer === secondFeeCollectorBalanceBeforeTransfer + BigInt(1e8), 'Balance of secondFeeCollector should be increase by one');
        expect(balanceOfOW === BigInt(90e8), 'Balance of otherWallet should be 90');
        expect(contractTokenBalanceAfterTransfer === BigInt(10e8), 'Balance of contract should be 10');
      }).timeout(1000000);
    });
    
});