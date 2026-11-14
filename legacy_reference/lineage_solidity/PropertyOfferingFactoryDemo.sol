// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice TESTNET / DEMO ONLY.
/// @dev Deploys one lightweight PropertyCellOfferingDemo contract per property.
///      The contracts record demo fractional positions only. They do not convey legal title,
///      securities, beneficial ownership or a claim against a real-world property.
contract PropertyCellOfferingDemo {
    address public immutable factory;
    address public owner;
    bytes32 public immutable assetKey;
    string public propertyName;
    string public metadataURI;

    uint32 public immutable totalCells;
    uint32 public soldCells;
    uint32 public immutable minCells;
    uint64 public immutable priceCents;
    uint32 public targetYieldBps;
    bool public active = true;

    uint256 public constant DEMO_CREDIT_CLAIM_CENTS = 10_000_000; // $100,000.00
    uint256 public constant CLAIM_COOLDOWN = 1 hours;
    mapping(address => uint256) public holdings;
    mapping(address => uint256) public demoCreditCents;
    mapping(address => uint256) public lastClaimAt;
    mapping(address => bool) public hasInvested;
    uint256 public investorCount;
    uint256 public demoRevenueCents;

    event CellsPurchased(address indexed buyer, uint256 cells, uint256 costCents, uint256 holdingAfter);
    event DemoCreditsClaimed(address indexed account, uint256 amountCents);
    event OfferingStatusChanged(bool active);
    event MetadataUpdated(string metadataURI);
    event TargetYieldUpdated(uint32 targetYieldBps);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(
        address propertyOwner,
        bytes32 propertyAssetKey,
        string memory name_,
        string memory metadataURI_,
        uint32 totalCells_,
        uint64 priceCents_,
        uint32 minCells_,
        uint32 targetYieldBps_
    ) {
        require(propertyOwner != address(0), "ZERO_OWNER");
        require(propertyAssetKey != bytes32(0), "EMPTY_ASSET_KEY");
        require(bytes(name_).length > 0, "EMPTY_NAME");
        require(totalCells_ > 0, "NO_CELLS");
        require(priceCents_ > 0, "NO_PRICE");
        require(minCells_ > 0 && minCells_ <= totalCells_, "BAD_MIN");
        require(targetYieldBps_ <= 10_000, "BAD_YIELD");

        factory = msg.sender;
        owner = propertyOwner;
        assetKey = propertyAssetKey;
        propertyName = name_;
        metadataURI = metadataURI_;
        totalCells = totalCells_;
        priceCents = priceCents_;
        minCells = minCells_;
        targetYieldBps = targetYieldBps_;
    }

    function claimDemoCredits() external {
        uint256 previous = lastClaimAt[msg.sender];
        require(previous == 0 || block.timestamp >= previous + CLAIM_COOLDOWN, "CLAIM_COOLDOWN");
        lastClaimAt[msg.sender] = block.timestamp;
        demoCreditCents[msg.sender] += DEMO_CREDIT_CLAIM_CENTS;
        emit DemoCreditsClaimed(msg.sender, DEMO_CREDIT_CLAIM_CENTS);
    }

    function buyCells(uint256 cells) external {
        require(active, "OFFERING_NOT_ACTIVE");
        require(cells >= minCells, "BELOW_MINIMUM");
        require(uint256(soldCells) + cells <= totalCells, "INSUFFICIENT_CELLS");
        uint256 costCents = cells * uint256(priceCents);
        require(demoCreditCents[msg.sender] >= costCents, "INSUFFICIENT_DEMO_CREDIT");

        demoCreditCents[msg.sender] -= costCents;
        soldCells += uint32(cells);
        holdings[msg.sender] += cells;
        demoRevenueCents += costCents;
        if (!hasInvested[msg.sender]) {
            hasInvested[msg.sender] = true;
            investorCount += 1;
        }
        emit CellsPurchased(msg.sender, cells, costCents, holdings[msg.sender]);
    }

    function setActive(bool value) external onlyOwner {
        active = value;
        emit OfferingStatusChanged(value);
    }

    function updateMetadataURI(string calldata value) external onlyOwner {
        metadataURI = value;
        emit MetadataUpdated(value);
    }

    function updateTargetYieldBps(uint32 value) external onlyOwner {
        require(value <= 10_000, "BAD_YIELD");
        targetYieldBps = value;
        emit TargetYieldUpdated(value);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    function remainingCells() external view returns (uint256) {
        return uint256(totalCells) - uint256(soldCells);
    }

    function impliedPropertyValueCents() external view returns (uint256) {
        return uint256(totalCells) * uint256(priceCents);
    }
}

contract PropertyOfferingFactoryDemo {
    address[] private _offerings;
    mapping(address => address[]) private _ownerOfferings;

    event OfferingCreated(
        uint256 indexed index,
        address indexed offering,
        address indexed owner,
        bytes32 assetKey,
        string propertyName,
        uint32 totalCells,
        uint64 priceCents,
        uint32 minCells,
        uint32 targetYieldBps
    );

    function createOffering(
        bytes32 assetKey,
        string calldata propertyName,
        string calldata metadataURI,
        uint32 totalCells,
        uint64 priceCents,
        uint32 minCells,
        uint32 targetYieldBps
    ) external returns (address offering) {
        PropertyCellOfferingDemo created = new PropertyCellOfferingDemo(
            msg.sender,
            assetKey,
            propertyName,
            metadataURI,
            totalCells,
            priceCents,
            minCells,
            targetYieldBps
        );
        offering = address(created);
        uint256 index = _offerings.length;
        _offerings.push(offering);
        _ownerOfferings[msg.sender].push(offering);
        emit OfferingCreated(index, offering, msg.sender, assetKey, propertyName, totalCells, priceCents, minCells, targetYieldBps);
    }

    function allOfferingCount() external view returns (uint256) {
        return _offerings.length;
    }

    function allOfferingAt(uint256 index) external view returns (address) {
        return _offerings[index];
    }

    function ownerOfferingCount(address account) external view returns (uint256) {
        return _ownerOfferings[account].length;
    }

    function ownerOfferingAt(address account, uint256 index) external view returns (address) {
        return _ownerOfferings[account][index];
    }
}
