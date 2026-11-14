// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IIntentProtocolProperty {
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

/// @title INTENT Property Case Registry
/// @notice Demonstration module for multi-agent property verification workflows.
/// @dev This registry records evidence hashes and agent attestations; it does not determine legal title or transfer property.
contract PropertyCaseRegistry {
    enum Module { Title, Documents, Valuation, Inspection, Compliance }
    enum Verdict { None, Clear, Review, Failed }

    struct CaseFile {
        address coordinator;
        bytes32 propertyRef;
        uint8 requiredMask;
        uint8 completedMask;
        uint64 createdAt;
        bool readyForHumanReview;
        bool closed;
    }

    struct Attestation {
        uint256 agentId;
        uint32 policyVersion;
        Verdict verdict;
        bytes32 evidenceHash;
        uint64 createdAt;
        address submitter;
    }

    IIntentProtocolProperty public immutable protocol;
    uint256 public nextCaseId = 1;
    mapping(uint256 => CaseFile) public cases;
    mapping(uint256 => mapping(uint8 => Attestation)) public attestations;

    event CaseOpened(uint256 indexed caseId, address indexed coordinator, bytes32 indexed propertyRef, uint8 requiredMask);
    event ModuleAttested(uint256 indexed caseId, uint8 indexed moduleId, uint256 indexed agentId, uint32 policyVersion, Verdict verdict, bytes32 evidenceHash);
    event CaseReadyForHumanReview(uint256 indexed caseId);
    event CaseClosed(uint256 indexed caseId);

    constructor(address protocol_) {
        require(protocol_ != address(0), "ZERO_PROTOCOL");
        protocol = IIntentProtocolProperty(protocol_);
    }

    function openCase(bytes32 propertyRef, uint8 requiredMask) external returns (uint256 caseId) {
        require(propertyRef != bytes32(0), "EMPTY_PROPERTY_REF");
        require(requiredMask != 0 && requiredMask < 32, "BAD_MASK");
        caseId = nextCaseId++;
        cases[caseId] = CaseFile({
            coordinator: msg.sender,
            propertyRef: propertyRef,
            requiredMask: requiredMask,
            completedMask: 0,
            createdAt: uint64(block.timestamp),
            readyForHumanReview: false,
            closed: false
        });
        emit CaseOpened(caseId, msg.sender, propertyRef, requiredMask);
    }

    function submitAttestation(
        uint256 caseId,
        Module moduleId,
        uint256 agentId,
        Verdict verdict,
        bytes32 evidenceHash
    ) external {
        CaseFile storage c = cases[caseId];
        require(c.coordinator != address(0), "UNKNOWN_CASE");
        require(!c.closed, "CASE_CLOSED");
        require(verdict != Verdict.None, "EMPTY_VERDICT");
        require(evidenceHash != bytes32(0), "EMPTY_EVIDENCE");
        uint8 bit = uint8(1 << uint8(moduleId));
        require((c.requiredMask & bit) != 0, "MODULE_NOT_REQUIRED");
        require(attestations[caseId][uint8(moduleId)].agentId == 0, "MODULE_ALREADY_ATTESTED");

        IIntentProtocolProperty.Agent memory a = protocol.getAgent(agentId);
        require(a.owner != address(0), "UNKNOWN_AGENT");
        require(a.active, "AGENT_INACTIVE");
        require(msg.sender == a.owner || msg.sender == a.runner, "NOT_AGENT_CONTROLLER");

        attestations[caseId][uint8(moduleId)] = Attestation({
            agentId: agentId,
            policyVersion: a.policyVersion,
            verdict: verdict,
            evidenceHash: evidenceHash,
            createdAt: uint64(block.timestamp),
            submitter: msg.sender
        });
        c.completedMask |= bit;
        emit ModuleAttested(caseId, uint8(moduleId), agentId, a.policyVersion, verdict, evidenceHash);
    }

    function markReadyForHumanReview(uint256 caseId) external {
        CaseFile storage c = cases[caseId];
        require(c.coordinator == msg.sender, "NOT_COORDINATOR");
        require(!c.closed, "CASE_CLOSED");
        require((c.completedMask & c.requiredMask) == c.requiredMask, "MISSING_ATTESTATIONS");
        c.readyForHumanReview = true;
        emit CaseReadyForHumanReview(caseId);
    }

    function closeCase(uint256 caseId) external {
        CaseFile storage c = cases[caseId];
        require(c.coordinator == msg.sender, "NOT_COORDINATOR");
        c.closed = true;
        emit CaseClosed(caseId);
    }
}
