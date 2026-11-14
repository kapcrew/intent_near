// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Tiny testnet service used to make the MVP's paid-provider flow observable on-chain.
contract MockPaidService {
    string public providerName;
    bytes32 public immutable serviceId;
    uint256 public fulfilledCount;
    bytes32 public lastPayloadHash;

    event ServiceFulfilled(
        uint256 indexed agentId,
        uint256 indexed intentId,
        bytes32 indexed actionHash,
        bytes32 payloadHash
    );

    constructor(string memory name_, bytes32 serviceId_) {
        providerName = name_;
        serviceId = serviceId_;
    }

    function onPaid(uint256 agentId, uint256 intentId, bytes32 actionHash) external returns (bytes32 payloadHash) {
        fulfilledCount += 1;
        payloadHash = keccak256(
            abi.encodePacked(serviceId, agentId, intentId, actionHash, fulfilledCount, block.number, block.timestamp)
        );
        lastPayloadHash = payloadHash;
        emit ServiceFulfilled(agentId, intentId, actionHash, payloadHash);
    }
}
