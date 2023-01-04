// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title Bytes Helper
 * @dev Different operations with bytes
 */
library BytesHelper {
    /**
     * @notice Get pointer to bytes array
     * @param bts Bytes array
     */
    function _getPointer(bytes memory bts) internal pure returns (uint) {
        uint ptr;
        assembly {
            ptr := bts
        }
        return ptr;
    }

    // MARK: - Bytes32 conversions

    /**
     * @notice Cut first 32 bytes
     * @param data Bytes array
     */
    function _bytesToBytes32(bytes memory data) internal pure returns (bytes32 result) {
        assembly {
            result := mload(add(data, 0x20))
        }
    }

    /**
     * @notice Convert address type to the bytes type shifting left
     * @param addr Address to convert
     */
    function _addressToBytes32ShiftLeft(address addr) internal pure returns (bytes32 bts) {
        return bytes32(uint(uint160(addr)) << 96);
    }

    /**
     * @notice Convert address type to the bytes type
     * @param addr Address to convert
     */
    function _addressToBytes32(address addr) internal pure returns (bytes32 bts) {
        return bytes32(uint(uint160(addr)));
    }

    /**
     * @notice Change bytes to upper case
     * @param data Bytes
     */
    function _bytes32toUpper(bytes32 data) internal pure returns (bytes32 bts) {
        bytes32 pointer;
        assembly {
            pointer := mload(0x40)
        }
        bytes memory baseBytes = new bytes(32);
        for (uint i = 0; i < 32; i++) {
            bytes1 b1 = data[i];
            if (b1 >= 0x61 && b1 <= 0x7A) {
                b1 = bytes1(uint8(b1) - 32);
            }
            baseBytes[i] = b1;
        }

        assembly {
            bts := mload(add(pointer, 0x20))
        }
    }

    /**
     * @notice Bytes32 value to address
     * @param value Value to be converted to address
     */
    function _bytes32ToAddress(bytes32 value) internal pure returns (address) {
        return address(uint160(uint(value) >> 96));
    }

    /**
     * @notice Extract 32 bytes from the bytes array by provided offset
     * @param input Input bytes
     * @param offset Offset from which will be extracted 32 bytes
     */
    function _extractBytes32(bytes memory input, uint offset) internal pure returns (bytes32 result) {
        require(offset + 32 <= input.length, "_extractBytes32: Wrong offset");
        assembly {
            result := mload(add(add(0x20, input), offset))
        }
    }

    /**
     * @notice Calculates length without empty bytes
     * @param x Value
     */
    function _countPureLengthForBytes32(bytes32 x) internal pure returns (uint) {
        uint charCount = 0;
        for (uint j = 0; j < 32; j++) {
            bytes1 char = bytes1(bytes32(uint(x) << (j * 8)));
            if (char != 0) {
                charCount++;
            }
        }

        return charCount;
    }

    /**
     * @notice removes empty bytes from the 32 bytes value
     * @param x Value to be converted
     * @return trimmed value bytes
     */
    function _trimBytes32(bytes32 x) internal pure returns (bytes memory) {
        bytes memory bytesArray = new bytes(32);
        uint charCount = 0;
        for (uint j = 0; j < 32; j++) {
            bytes1 char = bytes1(bytes32(uint(x) << (j * 8)));
            if (char != 0) {
                bytesArray[charCount] = char;
                charCount++;
            }
        }

        bytes memory bytesTrimmed = new bytes(charCount);
        for (uint j = 0; j < charCount; j++) {
            bytesTrimmed[j] = bytesArray[j];
        }

        return bytesTrimmed;
    }

    // MARK: - Address conversions

    /**
     * @notice Convert address type to the bytes type
     * @param addr Address to convert
     */
    function _addressToBytesPacked(address addr) internal pure returns (bytes memory bts) {
        assembly {
            let m := mload(0x40)
            mstore(add(m, 20), xor(0x140000000000000000000000000000000000000000, addr))
            mstore(0x40, add(m, 52))
            bts := m
        }
    }

    /**
     * @notice bytes value to address
     * @param value Value to be converted to address
     */
    function _bytesToAddress(bytes memory value) internal pure returns (address) {
        return address(uint160(uint(_bytesToBytes32(value)) >> 96));
    }

    // MARK: - Uint256 conversions

    /**
     * @notice Cut first 32 bytes and converts it to uint
     * @param data Bytes array
     */
    function _bytesToUint(bytes memory data) internal pure returns (uint result) {
        assembly {
            result := mload(add(data, 0x20))
        }
    }

    // MARK: - Boolean conversion

    /**
     * @notice Converts boolean to bytes
     * @param value Boolean value
     */
    function _boolToBytes(bool value) internal pure returns (bytes[] memory) {
        bytes[] memory bvalue = new bytes[](1);
        bvalue[0] = abi.encodePacked(value);

        return bvalue;
    }

    // MARK: - Uint8 conversions

    /**
     * @notice Converts bytes to uint8
     * @param data Bytes array
     * @param start Start index
     */
    function _bytesToUint8(bytes memory data, uint start) internal pure returns (uint8 result) {
        require(data.length >= (start + 1), "_bytesToUint8: Wrong start");

        assembly {
            result := mload(add(add(data, 0x1), start))
        }
    }

    /**
     * @notice Converts bytes to uint8 unsafely
     * @param data Bytes array
     */
    function _bytesToUint8UNSAFE(bytes memory data) internal pure returns (uint8 result) {
        assembly {
            result := mload(add(data, 0x1))
        }
    }

    // MARK: - Int256 conversions

    /**
     * @notice Cut first 32 bytes and converts it to int
     * @param data Bytes array
     */
    function _bytesToInt(bytes memory data) internal pure returns (int result) {
        assembly {
            result := mload(add(data, 0x20))
        }
    }

    // MARK: - Slices

    /**
     * @notice Returns slice from bytes with fixed length
     * @param data Bytes array
     * @param start Start index
     * @param length Slice length
     */
    function _getSlice(
        bytes memory data,
        uint start,
        uint length
    ) internal pure returns (bytes memory result) {
        require(data.length >= (start + length), "_getSlice: Wrong start or length");

        assembly {
            switch iszero(length)
            case 0 {
                result := mload(0x40)

                let lengthmod := and(length, 31)

                let mc := add(add(result, lengthmod), mul(0x20, iszero(lengthmod)))
                let end := add(mc, length)

                for {
                    let cc := add(add(add(data, lengthmod), mul(0x20, iszero(lengthmod))), start)
                } lt(mc, end) {
                    mc := add(mc, 0x20)
                    cc := add(cc, 0x20)
                } {
                    mstore(mc, mload(cc))
                }

                mstore(result, length)

                mstore(0x40, and(add(mc, 31), not(31)))
            }
            default {
                result := mload(0x40)

                mstore(0x40, add(result, 0x20))
            }
        }
    }

    /**
     * @notice Returns slice of bytes32 array from range
     * @param data Bytes32 array
     * @param start Start index
     * @param end End index
     */
    function _getSliceBytes32(
        bytes32[] memory data,
        uint start,
        uint end
    ) internal pure returns (bytes32[] memory) {
        bytes32[] memory result = new bytes32[](end - start);
        for (uint i = 0; i < end - start; i++) {
            result[i] = data[i + start];
        }
        return result;
    }

    /**
     * @notice Returns slice from range
     * @param data Bytes array
     * @param start Start index
     * @param end End index
     */
    function _getSlice(
        bytes[] memory data,
        uint start,
        uint end
    ) internal pure returns (bytes[] memory) {
        bytes[] memory result = new bytes[](end - start);
        for (uint i = 0; i < end - start; i++) {
            result[i] = data[i + start];
        }
        return result;
    }

    // MARK: - ASCII conversions

    /**
     * @notice Converts 32 bytes to uint
     * @param data Bytes array
     */
    function _asciiBytesToUint(bytes memory data) internal pure returns (uint result) {
        require(data.length <= 32, "_asciiBytesToUint: Overflow");

        return _asciiBytesToUintImpl(data);
    }

    /**
     * @notice Converts 32 bytes to int
     * @param data Bytes array
     */
    function _asciiBytesToInt(bytes memory data) internal pure returns (int result) {
        require(data.length > 0 && data.length <= 32, "_asciiBytesToInt: Overflow");
        bool isNegative = false;
        if (data[0] == "-") {
            isNegative = true;
            data[0] = "0";
        }

        uint uintResult = _asciiBytesToUintImpl(data);

        return isNegative ? int(uintResult) * -1 : int(uintResult);
    }

    function _asciiBytesToUintImpl(bytes memory data) internal pure returns (uint result) {
        for (uint i = 0; i < data.length; i++) {
            uint char = uint(uint8(data[i]));
            require(char >= 48 && char <= 57, "_asciiBytesToUint: Wrong char");
            result = result * 10 + (char - 48);
        }
        return result;
    }

    /**
     * @notice Original Copyright (c) 2015-2016 Oraclize SRL
     * @notice Original Copyright (c) 2016 Oraclize LTD
     * @notice Modified Copyright (c) 2020 SECURRENCY INC.
     * @dev Converts an unsigned integer to its bytes representation
     * @notice https://github.com/provable-things/ethereum-api/blob/master/oraclizeAPI_0.5.sol#L1045
     * @param num The number to be converted
     * @return Bytes representation of the number
     */
    function _uintToASCIIBytes(uint num) internal pure returns (bytes memory) {
        uint _i = num;
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        while (_i != 0) {
            bstr[len - 1] = bytes1(uint8(48 + (_i % 10)));
            _i /= 10;
            len--;
        }
        return bstr;
    }

    /**
     * @notice Modified version from https://gitter.im/ethereum/solidity?at=56b085b5eaf741c118d65198
     * @notice In the original there is no necessary conversion in ASCII. Also added leading 0x
     */
    function _addressToASCIIBytes(address addr) internal pure returns (bytes memory) {
        bytes memory res = new bytes(40);

        for (uint i = 0; i < 20; i++) {
            uint8 symbol = uint8(uint(uint160(addr)) >> (8 * (19 - i)));

            (bytes1 high, bytes1 low) = _uint8ConvertToAscii(symbol);
            res[2 * i] = high;
            res[2 * i + 1] = low;
        }

        return abi.encodePacked("0x", res);
    }

    /**
     * @notice Converts bytes32 array to ASCII Bytes
     */
    function _bytes32ArrayToASCIIBytes(bytes32[] memory input) internal pure returns (bytes memory) {
        bytes memory result;
        uint length = input.length;

        if (length > 0) {
            result = abi.encodePacked(_bytes32ToASCIIBytes(input[0]));
            for (uint i = 1; i < length; i++) {
                result = abi.encodePacked(result, ", ", _bytes32ToASCIIBytes(input[i]));
            }
        }

        return result;
    }

    /**
     * @notice Modified version from https://gitter.im/ethereum/solidity?at=56b085b5eaf741c118d65198
     * @notice In the original there is no necessary conversion in ASCII. Also added leading 0x
     */
    function _bytes32ToASCIIBytes(bytes32 input) internal pure returns (bytes memory) {
        bytes memory res = new bytes(64);

        for (uint i = 0; i < 32; i++) {
            uint8 symbol = uint8(uint(input) >> (8 * (31 - i)));

            (bytes1 high, bytes1 low) = _uint8ConvertToAscii(symbol);
            res[2 * i] = high;
            res[2 * i + 1] = low;
        }

        return abi.encodePacked("0x", res);
    }

    /**
     * @notice Modified version from https://gitter.im/ethereum/solidity?at=56b085b5eaf741c118d65198
     * @notice In the original there is no necessary conversion in ASCII. Also added leading 0x
     */
    function _bytesToASCIIBytes(bytes memory input) internal pure returns (bytes memory) {
        uint inputLen = input.length;
        bytes memory res = new bytes(inputLen * 2);

        for (uint i = 0; i < inputLen; i++) {
            uint8 symbol = uint8(input[i]);
            (bytes1 high, bytes1 low) = _uint8ConvertToAscii(symbol);
            res[2 * i] = high;
            res[2 * i + 1] = low;
        }

        return abi.encodePacked("0x", res);
    }

    // MARK: - Strings

    /**
     * @notice takes an array of strings and a separator
     * @notice and merge all strings into a single string
     * @param strArray, array containing all the strings to be concatenated
     * @param separator, separator to place between each concatenation
     * @return res string merged with separators
     */
    function _append(string[] memory strArray, string memory separator) internal pure returns (string memory res) {
        uint length = strArray.length;
        if (length > 0) {
            for (uint i = 0; i < length; i++) {
                if (i == 0) {
                    res = string(abi.encodePacked(res, strArray[i]));
                } else {
                    res = string(abi.encodePacked(res, separator, strArray[i]));
                }
            }
        } else {
            res = "";
        }
    }

    /**
     * @notice takes an array of bytes and a separator
     * @notice and merge all bytes into a single string
     * @param bytesArray, array containing all the bytes to be concatenated
     * @param separator, separator to place between each concatenation
     * @return res string merged with separators
     */
    function _append(bytes[] memory bytesArray, string memory separator) internal pure returns (string memory res) {
        uint length = bytesArray.length;
        if (length > 0) {
            for (uint i = 0; i < length; i++) {
                if (i == 0) {
                    res = string(abi.encodePacked(res, string(bytesArray[i])));
                } else {
                    res = string(abi.encodePacked(res, separator, string(bytesArray[i])));
                }
            }
        } else {
            res = "";
        }
    }

    // MARK: - Bytes[] values conversions

    /**
     * @notice Converts bytes[] value to uint[]
     * @param valuesArray Value to convert
     * @return uint[] value
     */
    function _toUint(bytes[] memory valuesArray) internal pure returns (uint[] memory) {
        uint length = valuesArray.length;
        uint[] memory result = new uint[](length);
        for (uint i = 0; i < length; i++) {
            result[i] = _bytesToUint(valuesArray[i]);
        }
        return result;
    }

    /**
     * @notice Converts bytes[] value to int[]
     * @param valuesArray Value to convert
     * @return int[] value
     */
    function _toInt(bytes[] memory valuesArray) internal pure returns (int[] memory) {
        uint length = valuesArray.length;
        int[] memory result = new int[](length);
        for (uint i = 0; i < length; i++) {
            result[i] = _bytesToInt(valuesArray[i]);
        }
        return result;
    }

    /**
     * @notice Converts bytes[] value to bool[]
     * @param valuesArray Value to convert
     * @return bool[] value
     */
    function _toBoolean(bytes[] memory valuesArray) internal pure returns (bool[] memory) {
        uint length = valuesArray.length;
        bool[] memory result = new bool[](length);
        for (uint i = 0; i < length; i++) {
            require(valuesArray[i].length == 1, "_toBoolean: Wrong values length");
            result[i] = (valuesArray[i][0] == bytes1(0x01)) ? true : false;
        }
        return result;
    }

    /**
     * @notice Converts bytes[] value to bytes32[]
     * @param valuesArray Value to convert
     * @return bytes32[] value
     */
    function _toBytes32(bytes[] memory valuesArray) internal pure returns (bytes32[] memory) {
        uint length = valuesArray.length;
        bytes32[] memory result = new bytes32[](length);
        for (uint i = 0; i < length; i++) {
            result[i] = _bytesToBytes32(valuesArray[i]);
        }
        return result;
    }

    /**
     * @notice Converts bytes[] value to string[]
     * @param valuesArray Value to convert
     * @return string[] value
     */
    function _toString(bytes[] memory valuesArray) internal pure returns (string[] memory) {
        uint length = valuesArray.length;
        string[] memory result = new string[](length);
        for (uint i = 0; i < length; i++) {
            result[i] = string(valuesArray[i]);
        }
        return result;
    }

    // MARK: - Comparizon
    /**
     * @return bool - true if values are equal
     * @param expectedValue Value expected
     * @param gotValue Value got
     */
    function _isEqual(bytes[] memory expectedValue, bytes[] memory gotValue) internal pure returns (bool) {
        return keccak256(abi.encode(expectedValue)) == keccak256(abi.encode(gotValue));
    }

    // MARK: - Memory manipulations

    /**
     * @dev Adds val to the list
     */
    function _pushBytes(bytes[] memory arr, bytes memory val) internal pure returns (bytes[] memory) {
        uint length = arr.length;
        assembly {
            mstore(arr, add(mload(arr), 1))
            mstore(0x40, add(mload(0x40), 0x32))
        }
        arr[length] = val;
        return arr;
    }

    /**
     * @dev Adds val to the list
     */
    function _pushBytes32(bytes32[] memory arr, bytes32 val) internal pure returns (bytes32[] memory) {
        uint length = arr.length;
        assembly {
            mstore(arr, add(mload(arr), 1))
            mstore(0x40, add(mload(0x40), 0x32))
        }
        arr[length] = val;
        return arr;
    }

    /**
     * @dev Adds val to the list
     */
    function _pushAddress(address[] memory arr, address val) internal pure returns (address[] memory) {
        uint length = arr.length;
        assembly {
            mstore(arr, add(mload(arr), 1))
            mstore(0x40, add(mload(0x40), 0x32))
        }
        arr[length] = val;
        return arr;
    }

    /**
     * @dev Removes val from the list
     */
    function _popBytes(bytes[] memory arr) internal pure returns (bytes[] memory) {
        require(arr.length > 0, "_popByte2: empty");
        assembly {
            mstore(arr, sub(mload(arr), 1))
        }
        return arr;
    }

    /**
     * @dev Removes val from the list
     */
    function _popBytes32(bytes32[] memory arr) internal pure returns (bytes32[] memory) {
        require(arr.length > 0, "_popBytes32: empty");
        assembly {
            mstore(arr, sub(mload(arr), 1))
        }
        return arr;
    }

    /**
     * @dev Removes val from the list
     */
    function _popAddress(address[] memory arr) internal pure returns (address[] memory) {
        require(arr.length > 0, "_popAddress: empty");
        assembly {
            mstore(arr, sub(mload(arr), 1))
        }
        return arr;
    }

    // MARK: - Privates

    /**
     * @notice Converts symbol to acsii
     */
    function _uint8ConvertToAscii(uint8 symbol) private pure returns (bytes1 high, bytes1 low) {
        uint8 _high = symbol / 16;
        uint8 _low = symbol - 16 * _high;

        high = _high < 10 ? bytes1(_high + 0x30) : bytes1(_high + 0x57);
        low = _low < 10 ? bytes1(_low + 0x30) : bytes1(_low + 0x57);
    }
}
