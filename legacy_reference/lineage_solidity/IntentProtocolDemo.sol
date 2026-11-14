// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Demo {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IPaidServiceDemo {
    function onPaid(uint256 agentId, uint256 intentId, bytes32 actionHash) external returns (bytes32 payloadHash);
}

/// @title IntentProtocolDemo
/// @notice XDC Apothem product MVP: versioned constitutions, delegated runner authority,
///         deterministic policy evaluation, human approval, expiring intents, token vault,
///         execution receipts, emergency freeze and on-chain lineage snapshots.
/// @dev Demonstration contract only. Unaudited and intentionally simplified.
contract IntentProtocolDemo {
    enum IntentStatus { None, PendingApproval, Allowed, Blocked, Executed, Rejected }

    // Reason codes: 0=OK, 1=inactive, 2=per-tx limit, 3=daily limit,
    // 4=unknown provider, 5=insufficient vault balance, 6=policy changed, 7=expired.
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

    struct PolicySnapshot {
        bytes32 policyHash;
        bytes32 previousPolicyHash;
        uint96 maxPerTx;
        uint96 dailyLimit;
        uint64 activatedAt;
        bool reviewUnknownProviders;
    }

    struct Intent {
        uint256 agentId;
        address proposer;
        address target;
        uint96 amount;
        bytes32 actionHash;
        bytes32 intentHash;
        bytes32 executionHash;
        uint32 policyVersion;
        uint64 createdAt;
        uint64 expiresAt;
        uint64 executedAt;
        IntentStatus status;
        uint8 reason;
    }

    IERC20Demo public immutable token;
    uint256 public nextAgentId = 1;
    uint256 public nextIntentId = 1;
    uint64 public constant INTENT_TTL = 15 minutes;

    mapping(uint256 => Agent) public agents;
    mapping(uint256 => mapping(uint32 => PolicySnapshot)) public policySnapshots;
    mapping(uint256 => mapping(address => bool)) public approvedProviders;
    mapping(uint256 => Intent) public intents;

    event AgentCreated(uint256 indexed agentId,address indexed owner,address indexed runner,bytes32 policyHash,uint96 maxPerTx,uint96 dailyLimit,bool reviewUnknownProviders);
    event PolicyUpdated(uint256 indexed agentId,bytes32 policyHash,bytes32 previousPolicyHash,uint96 maxPerTx,uint96 dailyLimit,uint32 policyVersion,bool reviewUnknownProviders);
    event RunnerUpdated(uint256 indexed agentId,address indexed runner);
    event ProviderApprovalChanged(uint256 indexed agentId,address indexed provider,bool approved);
    event AgentFunded(uint256 indexed agentId,address indexed from,uint256 amount,uint256 vaultBalance);
    event AgentWithdrawal(uint256 indexed agentId,address indexed to,uint256 amount,uint256 vaultBalance);
    event AgentStatusChanged(uint256 indexed agentId,bool active);
    event IntentProposed(uint256 indexed intentId,uint256 indexed agentId,address indexed target,address proposer,uint96 amount,bytes32 actionHash,bytes32 intentHash,uint32 policyVersion,uint64 expiresAt,IntentStatus status,uint8 reason);
    event IntentReviewed(uint256 indexed intentId,uint256 indexed agentId,bool approved,bool rememberProvider);
    event IntentExecuted(uint256 indexed intentId,uint256 indexed agentId,address indexed target,uint96 amount,bytes32 executionHash,bytes32 providerPayloadHash);
    event ExternalIntentExecuted(uint256 indexed intentId,uint256 indexed agentId,address indexed target,uint96 amount,bytes32 executionHash,bytes32 settlementHash,bytes32 responseHash);

    modifier onlyOwner(uint256 agentId) {
        require(agents[agentId].owner == msg.sender, "NOT_AGENT_OWNER");
        _;
    }

    modifier onlyRunnerOrOwner(uint256 agentId) {
        Agent memory agent = agents[agentId];
        require(msg.sender == agent.runner || msg.sender == agent.owner, "NOT_AUTHORIZED_RUNNER");
        _;
    }

    constructor(address token_) {
        require(token_ != address(0), "ZERO_TOKEN");
        token = IERC20Demo(token_);
    }

    function createAgent(address runner,bytes32 policyHash,uint96 maxPerTx,uint96 dailyLimit,bool reviewUnknownProviders) external returns (uint256 agentId) {
        require(runner != address(0), "ZERO_RUNNER");
        require(policyHash != bytes32(0), "EMPTY_POLICY");
        require(maxPerTx > 0 && dailyLimit >= maxPerTx, "BAD_LIMITS");
        agentId = nextAgentId++;
        agents[agentId] = Agent({
            owner: msg.sender, runner: runner, policyHash: policyHash,
            maxPerTx: maxPerTx, dailyLimit: dailyLimit, vaultBalance: 0,
            spentInWindow: 0, policyVersion: 1, windowStart: uint64(block.timestamp),
            createdAt: uint64(block.timestamp), active: true,
            reviewUnknownProviders: reviewUnknownProviders
        });
        policySnapshots[agentId][1] = PolicySnapshot({
            policyHash: policyHash, previousPolicyHash: bytes32(0), maxPerTx: maxPerTx,
            dailyLimit: dailyLimit, activatedAt: uint64(block.timestamp),
            reviewUnknownProviders: reviewUnknownProviders
        });
        emit AgentCreated(agentId,msg.sender,runner,policyHash,maxPerTx,dailyLimit,reviewUnknownProviders);
    }

    function updatePolicy(uint256 agentId,bytes32 policyHash,uint96 maxPerTx,uint96 dailyLimit,bool reviewUnknownProviders) external onlyOwner(agentId) {
        require(policyHash != bytes32(0), "EMPTY_POLICY");
        require(maxPerTx > 0 && dailyLimit >= maxPerTx, "BAD_LIMITS");
        Agent storage a = agents[agentId];
        bytes32 previous = a.policyHash;
        a.policyHash = policyHash;
        a.maxPerTx = maxPerTx;
        a.dailyLimit = dailyLimit;
        a.reviewUnknownProviders = reviewUnknownProviders;
        a.policyVersion += 1;
        policySnapshots[agentId][a.policyVersion] = PolicySnapshot({
            policyHash: policyHash, previousPolicyHash: previous, maxPerTx: maxPerTx,
            dailyLimit: dailyLimit, activatedAt: uint64(block.timestamp),
            reviewUnknownProviders: reviewUnknownProviders
        });
        emit PolicyUpdated(agentId,policyHash,previous,maxPerTx,dailyLimit,a.policyVersion,reviewUnknownProviders);
    }

    function setRunner(uint256 agentId,address runner) external onlyOwner(agentId) {
        require(runner != address(0), "ZERO_RUNNER");
        agents[agentId].runner = runner;
        emit RunnerUpdated(agentId,runner);
    }

    function setProviderApproved(uint256 agentId,address provider,bool approved) external onlyOwner(agentId) {
        require(provider != address(0), "ZERO_PROVIDER");
        approvedProviders[agentId][provider] = approved;
        emit ProviderApprovalChanged(agentId,provider,approved);
    }

    function setAgentActive(uint256 agentId,bool active) external onlyOwner(agentId) {
        agents[agentId].active = active;
        emit AgentStatusChanged(agentId,active);
    }

    function deposit(uint256 agentId,uint96 amount) external onlyOwner(agentId) {
        require(amount > 0, "ZERO_AMOUNT");
        require(token.transferFrom(msg.sender,address(this),amount), "TRANSFER_FAILED");
        Agent storage a = agents[agentId];
        a.vaultBalance += amount;
        emit AgentFunded(agentId,msg.sender,amount,a.vaultBalance);
    }

    function withdraw(uint256 agentId,uint96 amount) external onlyOwner(agentId) {
        Agent storage a = agents[agentId];
        require(amount > 0 && amount <= a.vaultBalance, "BAD_AMOUNT");
        a.vaultBalance -= amount;
        require(token.transfer(msg.sender,amount), "TRANSFER_FAILED");
        emit AgentWithdrawal(agentId,msg.sender,amount,a.vaultBalance);
    }

    function evaluate(uint256 agentId,address target,uint96 amount) public view returns (IntentStatus status,uint8 reason) {
        Agent memory a = agents[agentId];
        if (a.owner == address(0) || !a.active) return (IntentStatus.Blocked,1);
        if (amount > a.maxPerTx) return (IntentStatus.Blocked,2);
        uint96 spent = a.spentInWindow;
        if (block.timestamp >= uint256(a.windowStart) + 1 days) spent = 0;
        if (uint256(spent) + amount > a.dailyLimit) return (IntentStatus.Blocked,3);
        if (amount > a.vaultBalance) return (IntentStatus.Blocked,5);
        if (approvedProviders[agentId][target]) return (IntentStatus.Allowed,0);
        if (a.reviewUnknownProviders) return (IntentStatus.PendingApproval,4);
        return (IntentStatus.Blocked,4);
    }

    function proposeIntent(uint256 agentId,address target,uint96 amount,bytes32 actionHash,bytes32 intentHash) external onlyRunnerOrOwner(agentId) returns (uint256 intentId) {
        require(target != address(0), "ZERO_TARGET");
        require(amount > 0, "ZERO_AMOUNT");
        require(actionHash != bytes32(0) && intentHash != bytes32(0), "EMPTY_HASH");
        (IntentStatus status,uint8 reason) = evaluate(agentId,target,amount);
        Agent memory a = agents[agentId];
        intentId = nextIntentId++;
        uint64 expiresAt = uint64(block.timestamp) + INTENT_TTL;
        intents[intentId] = Intent({
            agentId: agentId, proposer: msg.sender, target: target, amount: amount,
            actionHash: actionHash, intentHash: intentHash, executionHash: bytes32(0),
            policyVersion: a.policyVersion, createdAt: uint64(block.timestamp),
            expiresAt: expiresAt, executedAt: 0, status: status, reason: reason
        });
        emit IntentProposed(intentId,agentId,target,msg.sender,amount,actionHash,intentHash,a.policyVersion,expiresAt,status,reason);
    }

    function reviewIntent(uint256 intentId,bool approve,bool rememberProvider) external {
        Intent storage it = intents[intentId];
        require(it.agentId != 0, "UNKNOWN_INTENT");
        Agent storage a = agents[it.agentId];
        require(a.owner == msg.sender, "NOT_AGENT_OWNER");
        require(it.status == IntentStatus.PendingApproval, "NOT_PENDING");
        require(block.timestamp <= it.expiresAt, "INTENT_EXPIRED");
        require(it.policyVersion == a.policyVersion, "POLICY_CHANGED");
        if (approve) {
            it.status = IntentStatus.Allowed;
            it.reason = 0;
            if (rememberProvider) {
                approvedProviders[it.agentId][it.target] = true;
                emit ProviderApprovalChanged(it.agentId,it.target,true);
            }
        } else {
            it.status = IntentStatus.Rejected;
            it.reason = 4;
        }
        emit IntentReviewed(intentId,it.agentId,approve,rememberProvider);
    }

    function executeIntent(uint256 intentId) external returns (bytes32 executionHash,bytes32 providerPayloadHash) {
        Intent storage it = intents[intentId];
        require(it.agentId != 0, "UNKNOWN_INTENT");
        Agent storage a = agents[it.agentId];
        require(msg.sender == a.runner || msg.sender == a.owner, "NOT_AUTHORIZED_RUNNER");
        require(it.status == IntentStatus.Allowed, "INTENT_NOT_ALLOWED");
        require(block.timestamp <= it.expiresAt, "INTENT_EXPIRED");
        require(it.policyVersion == a.policyVersion, "POLICY_CHANGED");
        require(a.active, "AGENT_INACTIVE");
        if (block.timestamp >= uint256(a.windowStart) + 1 days) {
            a.windowStart = uint64(block.timestamp);
            a.spentInWindow = 0;
        }
        require(it.amount <= a.maxPerTx, "LIMIT_CHANGED");
        require(uint256(a.spentInWindow) + it.amount <= a.dailyLimit, "DAILY_LIMIT");
        require(it.amount <= a.vaultBalance, "INSUFFICIENT_VAULT");
        a.vaultBalance -= it.amount;
        a.spentInWindow += it.amount;
        it.status = IntentStatus.Executed;
        it.executedAt = uint64(block.timestamp);
        require(token.transfer(it.target,it.amount), "PAYMENT_FAILED");
        if (it.target.code.length > 0) {
            try IPaidServiceDemo(it.target).onPaid(it.agentId,intentId,it.actionHash) returns (bytes32 payloadHash) {
                providerPayloadHash = payloadHash;
            } catch { providerPayloadHash = bytes32(0); }
        }
        executionHash = keccak256(abi.encode(it.agentId,intentId,it.target,it.amount,it.intentHash,it.policyVersion,providerPayloadHash,block.chainid,block.number));
        it.executionHash = executionHash;
        emit IntentExecuted(intentId,it.agentId,it.target,it.amount,executionHash,providerPayloadHash);
    }


    /// @notice Evaluate authority for an externally settled action (for example x402).
    /// @dev Uses the same Constitution limits and provider allowlist, but does not require funds in the demo vault.
    function evaluateExternal(uint256 agentId,address target,uint96 amount) public view returns (IntentStatus status,uint8 reason) {
        Agent memory a = agents[agentId];
        if (a.owner == address(0) || !a.active) return (IntentStatus.Blocked,1);
        if (amount > a.maxPerTx) return (IntentStatus.Blocked,2);
        uint96 spent = a.spentInWindow;
        if (block.timestamp >= uint256(a.windowStart) + 1 days) spent = 0;
        if (uint256(spent) + amount > a.dailyLimit) return (IntentStatus.Blocked,3);
        if (approvedProviders[agentId][target]) return (IntentStatus.Allowed,0);
        if (a.reviewUnknownProviders) return (IntentStatus.PendingApproval,4);
        return (IntentStatus.Blocked,4);
    }

    /// @notice Create a policy-bound intent whose value will be settled by an external rail such as x402.
    function proposeExternalIntent(uint256 agentId,address target,uint96 amount,bytes32 actionHash,bytes32 intentHash) external onlyRunnerOrOwner(agentId) returns (uint256 intentId) {
        require(target != address(0), "ZERO_TARGET");
        require(amount > 0, "ZERO_AMOUNT");
        require(actionHash != bytes32(0) && intentHash != bytes32(0), "EMPTY_HASH");
        (IntentStatus status,uint8 reason) = evaluateExternal(agentId,target,amount);
        Agent memory a = agents[agentId];
        intentId = nextIntentId++;
        uint64 expiresAt = uint64(block.timestamp) + INTENT_TTL;
        intents[intentId] = Intent({
            agentId: agentId, proposer: msg.sender, target: target, amount: amount,
            actionHash: actionHash, intentHash: intentHash, executionHash: bytes32(0),
            policyVersion: a.policyVersion, createdAt: uint64(block.timestamp),
            expiresAt: expiresAt, executedAt: 0, status: status, reason: reason
        });
        emit IntentProposed(intentId,agentId,target,msg.sender,amount,actionHash,intentHash,a.policyVersion,expiresAt,status,reason);
    }

    /// @notice Finalize an externally-settled intent after the payment rail returns a settlement proof.
    /// @dev The protocol anchors the payment/response commitments and consumes the one-time intent capability.
    function finalizeExternalIntent(uint256 intentId,bytes32 settlementHash,bytes32 responseHash) external returns (bytes32 executionHash) {
        Intent storage it = intents[intentId];
        require(it.agentId != 0, "UNKNOWN_INTENT");
        Agent storage a = agents[it.agentId];
        require(msg.sender == a.runner || msg.sender == a.owner, "NOT_AUTHORIZED_RUNNER");
        require(it.status == IntentStatus.Allowed, "INTENT_NOT_ALLOWED");
        require(block.timestamp <= it.expiresAt, "INTENT_EXPIRED");
        require(it.policyVersion == a.policyVersion, "POLICY_CHANGED");
        require(a.active, "AGENT_INACTIVE");
        require(settlementHash != bytes32(0), "EMPTY_SETTLEMENT");
        if (block.timestamp >= uint256(a.windowStart) + 1 days) {
            a.windowStart = uint64(block.timestamp);
            a.spentInWindow = 0;
        }
        require(it.amount <= a.maxPerTx, "LIMIT_CHANGED");
        require(uint256(a.spentInWindow) + it.amount <= a.dailyLimit, "DAILY_LIMIT");
        a.spentInWindow += it.amount;
        it.status = IntentStatus.Executed;
        it.executedAt = uint64(block.timestamp);
        executionHash = keccak256(abi.encode(it.agentId,intentId,it.target,it.amount,it.intentHash,it.policyVersion,settlementHash,responseHash,block.chainid,block.number));
        it.executionHash = executionHash;
        emit ExternalIntentExecuted(intentId,it.agentId,it.target,it.amount,executionHash,settlementHash,responseHash);
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) { return agents[agentId]; }
    function getIntent(uint256 intentId) external view returns (Intent memory) { return intents[intentId]; }
    function getPolicySnapshot(uint256 agentId,uint32 version) external view returns (PolicySnapshot memory) { return policySnapshots[agentId][version]; }
}
