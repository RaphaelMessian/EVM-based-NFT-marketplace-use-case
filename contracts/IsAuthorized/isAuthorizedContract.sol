// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.5.0 <0.9.0;
pragma experimental ABIEncoderV2;
import "../system-contracts/hedera-account-service/HederaAccountService.sol";

contract isAuthorizedTest is HederaAccountService {

    event ResponseCode(int responseCode);
    event IsAuthorizedRaw(address account, bool response);

    // function isAuthorizedWithPrefix(address account, bytes memory message, bytes memory signature) public returns (bool response) {
    //     bytes memory prefix =  "\x19Ethereum Signed Message:\n";
    //     bytes32 prefixedHashMessage = keccak256(abi.encodePacked(prefix, uintToString(message.length), message));
    //     return isAuthorizedRaw(account, bytes32ToBytes(prefixedHashMessage), signature);
    // }


    function isAuthorizedRawPublic(address account, bytes memory messageHash, bytes memory signature) public returns (int64 responseCode, bool response) {
        (responseCode, response) = HederaAccountService.isAuthorizedRaw(account, messageHash, signature);
        emit ResponseCode(responseCode);
        if (responseCode != HederaResponseCodes.SUCCESS) {
            revert("mehehehehe");
        }
        emit IsAuthorizedRaw(account, response);
    }

     function uintToString(uint value) public pure returns (string memory) {
        uint length = 1;
        uint v = value;
        while ((v /= 10) != 0) { length++; }
        bytes memory result = new bytes(length);
        while (true) {
            length--;
            result[length] = bytes1(uint8(0x30 + (value % 10)));
            value /= 10;
            if (length == 0) {
                break;
            }
        }
        return string(result);
    }

    function bytes32ToBytes(bytes32 data) public pure returns (bytes memory) {
        bytes memory result = new bytes(32);
        for (uint i = 0; i < 32; i++) {
            result[i] = data[i];
        }
        return result;
    }
}