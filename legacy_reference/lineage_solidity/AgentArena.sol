// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IIntentProtocolArena {
    struct Agent {
        address owner;
        address runner;
        bytes32 policyHash;
        uint96 maxPerTx;
        uint96 dailyLimit;
        uint96 vaultBalance;
        uint96 spentInWindow;
        uint32 policyVersion;
        uint64 windowStart;
        uint64 createdAt;
        bool active;
        bool reviewUnknownProviders;
    }

    function getAgent(uint256 agentId) external view returns (Agent memory);
}

/// @title INTENT Chronicle Arena
/// @notice Testnet-only, non-financial strategy trials for INTENT agents.
/// @dev No wagers, no transferable prizes. XP is non-transferable reputation-like game state.
contract AgentArena {
    enum Tactic { None, Scout, Guard, Strike }
    enum Challenge { None, Fog, Swarm, Fortress }

    struct Expedition {
        uint256 agentId;
        uint32 policyVersion;
        Tactic tactic;
        Challenge challenge;
        bytes32 missionHash;
        uint32 score;
        uint32 xpEarned;
        uint64 createdAt;
        address controller;
    }

    IIntentProtocolArena public immutable protocol;
    uint256 public nextExpeditionId = 1;

    mapping(uint256 => Expedition) public expeditions;
    mapping(uint256 => uint256) public agentXp;
    mapping(uint256 => uint256) public agentWins;
    mapping(uint256 => uint256) public agentTrials;

    event ExpeditionResolved(
        uint256 indexed expeditionId,
        uint256 indexed agentId,
        uint32 indexed policyVersion,
        Tactic tactic,
        Challenge challenge,
        uint32 score,
        uint32 xpEarned,
        bytes32 missionHash
    );

    constructor(address protocol_) {
        require(protocol_ != address(0), "ZERO_PROTOCOL");
        protocol = IIntentProtocolArena(protocol_);
    }

    function launchExpedition(
        uint256 agentId,
        Tactic tactic,
        bytes32 missionHash
    ) external returns (uint256 expeditionId) {
        require(tactic != Tactic.None, "NO_TACTIC");
        require(missionHash != bytes32(0), "EMPTY_MISSION");

        IIntentProtocolArena.Agent memory agent = protocol.getAgent(agentId);
        require(agent.owner != address(0), "UNKNOWN_AGENT");
        require(agent.active, "AGENT_INACTIVE");
        require(
            msg.sender == agent.owner || msg.sender == agent.runner,
            "NOT_AGENT_CONTROLLER"
        );

        expeditionId = nextExpeditionId++;

        Challenge challenge = _drawChallenge(agentId, expeditionId, missionHash);
        uint32 score = _score(tactic, challenge, agent.policyVersion);
        uint32 xpEarned = 5 + (score / 10);

        expeditions[expeditionId] = Expedition({
            agentId: agentId,
            policyVersion: agent.policyVersion,
            tactic: tactic,
            challenge: challenge,
            missionHash: missionHash,
            score: score,
            xpEarned: xpEarned,
            createdAt: uint64(block.timestamp),
            controller: msg.sender
        });

        agentXp[agentId] += xpEarned;
        agentTrials[agentId] += 1;

        if (_isCounter(tactic, challenge)) {
            agentWins[agentId] += 1;
        }

        _emitExpeditionResolved(expeditionId);
    }

    function _drawChallenge(
        uint256 agentId,
        uint256 expeditionId,
        bytes32 missionHash
    ) internal view returns (Challenge) {
        uint256 randomValue = uint256(
            keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    blockhash(block.number - 1),
                    block.timestamp,
                    agentId,
                    expeditionId,
                    missionHash
                )
            )
        );

        return Challenge(uint8((randomValue % 3) + 1));
    }

    function _score(
        Tactic tactic,
        Challenge challenge,
        uint32 policyVersion
    ) internal pure returns (uint32) {
        uint32 baseScore;

        if (_isCounter(tactic, challenge)) {
            baseScore = 100;
        } else if (uint8(tactic) == uint8(challenge)) {
            baseScore = 68;
        } else {
            baseScore = 42;
        }

        uint32 lineageBonus = policyVersion > 5 ? 5 : policyVersion;
        return baseScore + lineageBonus;
    }

    function _emitExpeditionResolved(uint256 expeditionId) internal {
        Expedition storage expedition = expeditions[expeditionId];

        emit ExpeditionResolved(
            expeditionId,
            expedition.agentId,
            expedition.policyVersion,
            expedition.tactic,
            expedition.challenge,
            expedition.score,
            expedition.xpEarned,
            expedition.missionHash
        );
    }

    function _isCounter(
        Tactic tactic,
        Challenge challenge
    ) internal pure returns (bool) {
        // Scout maps the Fog, Guard contains the Swarm, Strike breaks the Fortress.
        return (tactic == Tactic.Scout && challenge == Challenge.Fog)
            || (tactic == Tactic.Guard && challenge == Challenge.Swarm)
            || (tactic == Tactic.Strike && challenge == Challenge.Fortress);
    }
}
