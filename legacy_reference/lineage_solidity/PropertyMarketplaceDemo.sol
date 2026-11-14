// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice TESTNET / DEMO ONLY.
/// @dev Records fractional "Property Cell" purchases against internal DemoUSD credits.
///      It does not issue a security, transfer legal title, hold fiat, or represent a regulated investment product.
contract PropertyMarketplaceDemo {
    address public owner;
    uint256 public nextPropertyId = 1;
    uint256 public constant DEMO_CREDIT_CLAIM_CENTS = 10_000_000; // $100,000.00
    uint256 public constant CLAIM_COOLDOWN = 1 hours;

    struct Property {
        bytes32 assetKey;
        uint32 totalCells;
        uint32 soldCells;
        uint32 minCells;
        uint64 priceCents;
        bool active;
    }

    mapping(uint256 => Property) public properties;
    mapping(uint256 => mapping(address => uint256)) public holdings;
    mapping(address => uint256) public demoCreditCents;
    mapping(address => uint256) public lastClaimAt;

    event PropertyListed(
        uint256 indexed propertyId,
        bytes32 indexed assetKey,
        uint32 totalCells,
        uint32 initialSoldCells,
        uint64 priceCents,
        uint32 minCells
    );
    event PropertyStatusChanged(uint256 indexed propertyId, bool active);
    event DemoCreditsClaimed(address indexed account, uint256 amountCents);
    event CellsPurchased(
        uint256 indexed propertyId,
        address indexed buyer,
        uint256 cells,
        uint256 costCents,
        uint256 holdingAfter
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");
        owner = newOwner;
    }

    function listProperty(
        bytes32 assetKey,
        uint32 totalCells,
        uint32 initialSoldCells,
        uint64 priceCents,
        uint32 minCells
    ) external onlyOwner returns (uint256 propertyId) {
        require(assetKey != bytes32(0), "EMPTY_ASSET_KEY");
        require(totalCells > 0, "NO_CELLS");
        require(priceCents > 0, "NO_PRICE");
        require(initialSoldCells <= totalCells, "BAD_INITIAL_SOLD");
        require(minCells > 0 && minCells <= totalCells, "BAD_MIN");

        propertyId = nextPropertyId++;
        properties[propertyId] = Property({
            assetKey: assetKey,
            totalCells: totalCells,
            soldCells: initialSoldCells,
            minCells: minCells,
            priceCents: priceCents,
            active: true
        });
        emit PropertyListed(propertyId, assetKey, totalCells, initialSoldCells, priceCents, minCells);
    }

    function setPropertyActive(uint256 propertyId, bool active) external onlyOwner {
        require(propertyId > 0 && propertyId < nextPropertyId, "UNKNOWN_PROPERTY");
        properties[propertyId].active = active;
        emit PropertyStatusChanged(propertyId, active);
    }

    function claimDemoCredits() external {
        uint256 previous = lastClaimAt[msg.sender];
        require(previous == 0 || block.timestamp >= previous + CLAIM_COOLDOWN, "CLAIM_COOLDOWN");
        lastClaimAt[msg.sender] = block.timestamp;
        demoCreditCents[msg.sender] += DEMO_CREDIT_CLAIM_CENTS;
        emit DemoCreditsClaimed(msg.sender, DEMO_CREDIT_CLAIM_CENTS);
    }

    function buyCells(uint256 propertyId, uint256 cells) external {
        Property storage p = properties[propertyId];
        require(p.active, "PROPERTY_NOT_ACTIVE");
        require(cells >= p.minCells, "BELOW_MINIMUM");
        require(uint256(p.soldCells) + cells <= p.totalCells, "INSUFFICIENT_CELLS");

        uint256 costCents = cells * uint256(p.priceCents);
        require(demoCreditCents[msg.sender] >= costCents, "INSUFFICIENT_DEMO_CREDIT");

        demoCreditCents[msg.sender] -= costCents;
        p.soldCells += uint32(cells);
        holdings[propertyId][msg.sender] += cells;

        emit CellsPurchased(propertyId, msg.sender, cells, costCents, holdings[propertyId][msg.sender]);
    }

    function remainingCells(uint256 propertyId) external view returns (uint256) {
        Property storage p = properties[propertyId];
        return uint256(p.totalCells) - uint256(p.soldCells);
    }
}
