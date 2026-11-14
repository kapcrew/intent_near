// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IIntentProtocolReviewDesk {
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

interface IPropertyCaseRegistryReviewDesk {
    function cases(uint256 caseId) external view returns (
        address coordinator,
        bytes32 propertyRef,
        uint8 requiredMask,
        uint8 completedMask,
        uint64 createdAt,
        bool readyForHumanReview,
        bool closed
    );
}

/// @title INTENT Human Review Desk
/// @notice Human decision layer for PropertyCaseRegistry cases.
/// @dev This module records review decisions and supplemental agent evidence.
///      It does not transfer legal title, funds, or perform regulated settlement.
contract HumanReviewDesk {
    enum Decision { None, Approved, AdditionalReview, Rejected }
    enum Verdict { None, Clear, Review, Failed }

    struct ReviewRecord {
        address reviewer;
        Decision decision;
        bytes32 reviewHash;
        uint64 decidedAt;
        uint8 requestedModule;
        uint16 round;
    }

    struct SupplementalAttestation {
        uint256 agentId;
        uint32 policyVersion;
        Verdict verdict;
        bytes32 evidenceHash;
        uint64 createdAt;
        address submitter;
        uint16 revision;
    }

    IIntentProtocolReviewDesk public immutable protocol;
    IPropertyCaseRegistryReviewDesk public immutable propertyRegistry;

    mapping(uint256 => ReviewRecord) public reviews;
    mapping(uint256 => uint16) public reviewRounds;
    mapping(uint256 => bool) public finalized;
    mapping(uint256 => bool) public supplementalPending;
    mapping(uint256 => uint8) public requestedModule;
    mapping(uint256 => mapping(uint8 => SupplementalAttestation)) public supplementalAttestations;
    mapping(uint256 => mapping(uint8 => uint16)) public supplementalRevisions;

    event HumanDecisionSubmitted(
        uint256 indexed caseId,
        address indexed reviewer,
        Decision decision,
        uint8 requestedModule,
        bytes32 reviewHash,
        uint16 round
    );
    event SupplementalReviewRequested(uint256 indexed caseId, uint8 indexed moduleId, uint16 indexed round);
    event SupplementalAttested(
        uint256 indexed caseId,
        uint8 indexed moduleId,
        uint256 indexed agentId,
        uint32 policyVersion,
        Verdict verdict,
        bytes32 evidenceHash,
        uint16 revision
    );
    event CaseReadyForSettlement(uint256 indexed caseId, address indexed reviewer, uint16 indexed round);
    event CaseRejected(uint256 indexed caseId, address indexed reviewer, uint16 indexed round);

    constructor(address protocol_, address propertyRegistry_) {
        require(protocol_ != address(0), "ZERO_PROTOCOL");
        require(propertyRegistry_ != address(0), "ZERO_PROPERTY_REGISTRY");
        protocol = IIntentProtocolReviewDesk(protocol_);
        propertyRegistry = IPropertyCaseRegistryReviewDesk(propertyRegistry_);
    }

    function submitDecision(
        uint256 caseId,
        Decision decision,
        bytes32 reviewHash,
        uint8 moduleId
    ) external {
        (
            address coordinator,
            ,
            uint8 requiredMask,
            uint8 completedMask,
            ,
            bool readyForHumanReview,
            bool closed
        ) = propertyRegistry.cases(caseId);

        require(coordinator != address(0), "UNKNOWN_CASE");
        require(msg.sender == coordinator, "NOT_COORDINATOR");
        require(readyForHumanReview, "CASE_NOT_READY");
        require(!closed, "PROPERTY_CASE_CLOSED");
        require(!finalized[caseId], "REVIEW_FINALIZED");
        require(!supplementalPending[caseId], "SUPPLEMENTAL_PENDING");
        require(decision != Decision.None, "EMPTY_DECISION");
        require(reviewHash != bytes32(0), "EMPTY_REVIEW_HASH");
        require((completedMask & requiredMask) == requiredMask, "MISSING_ATTESTATIONS");

        uint16 round = ++reviewRounds[caseId];

        if (decision == Decision.AdditionalReview) {
            require(moduleId < 5, "BAD_MODULE");
            uint8 bit = uint8(1 << moduleId);
            require((requiredMask & bit) != 0, "MODULE_NOT_REQUIRED");
            supplementalPending[caseId] = true;
            requestedModule[caseId] = moduleId;
            emit SupplementalReviewRequested(caseId, moduleId, round);
        } else if (decision == Decision.Approved) {
            finalized[caseId] = true;
            emit CaseReadyForSettlement(caseId, msg.sender, round);
        } else if (decision == Decision.Rejected) {
            finalized[caseId] = true;
            emit CaseRejected(caseId, msg.sender, round);
        }

        reviews[caseId] = ReviewRecord({
            reviewer: msg.sender,
            decision: decision,
            reviewHash: reviewHash,
            decidedAt: uint64(block.timestamp),
            requestedModule: moduleId,
            round: round
        });

        emit HumanDecisionSubmitted(caseId, msg.sender, decision, moduleId, reviewHash, round);
    }

    function submitSupplementalAttestation(
        uint256 caseId,
        uint256 agentId,
        Verdict verdict,
        bytes32 evidenceHash
    ) external {
        require(supplementalPending[caseId], "NO_SUPPLEMENTAL_REQUEST");
        require(!finalized[caseId], "REVIEW_FINALIZED");
        require(verdict != Verdict.None, "EMPTY_VERDICT");
        require(evidenceHash != bytes32(0), "EMPTY_EVIDENCE");

        IIntentProtocolReviewDesk.Agent memory agent = protocol.getAgent(agentId);
        require(agent.owner != address(0), "UNKNOWN_AGENT");
        require(agent.active, "AGENT_INACTIVE");
        require(msg.sender == agent.owner || msg.sender == agent.runner, "NOT_AGENT_CONTROLLER");

        uint8 moduleId = requestedModule[caseId];
        uint16 revision = ++supplementalRevisions[caseId][moduleId];
        supplementalAttestations[caseId][moduleId] = SupplementalAttestation({
            agentId: agentId,
            policyVersion: agent.policyVersion,
            verdict: verdict,
            evidenceHash: evidenceHash,
            createdAt: uint64(block.timestamp),
            submitter: msg.sender,
            revision: revision
        });
        supplementalPending[caseId] = false;

        emit SupplementalAttested(caseId, moduleId, agentId, agent.policyVersion, verdict, evidenceHash, revision);
    }
}
