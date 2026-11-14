// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 interface used with Circle USDC on Arc.
interface ICircleUSDC {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title CirclePropertySettlementDemo
/// @notice TESTNET DEMO ONLY. Records demo Property Cell positions and settles purchases in Circle USDC.
/// @dev Property Cells are non-transferable accounting units in this prototype and do not represent
///      legal title, securities, beneficial ownership, or a claim against real-world property.
contract CirclePropertySettlementDemo {
    struct Property {
        bytes32 assetKey;
        string name;
        uint32 totalCells;
        uint32 soldCells;
        uint32 minCells;
        uint64 priceMicroUsdc; // 6-decimal USDC units; 1 USDC = 1_000_000
        bool active;
    }

    address public owner;
    address public treasury;
    ICircleUSDC public immutable usdc;
    uint256 public nextPropertyId = 1;

    mapping(uint256 => Property) public properties;
    mapping(uint256 => mapping(address => uint256)) public holdings;
    mapping(uint256 => mapping(address => bool)) public hasInvested;
    mapping(uint256 => uint256) public investorCount;

    event PropertyListed(
        uint256 indexed propertyId,
        bytes32 indexed assetKey,
        string name,
        uint32 totalCells,
        uint64 priceMicroUsdc,
        uint32 minCells
    );
    event CellsPurchased(
        uint256 indexed propertyId,
        address indexed buyer,
        uint256 cells,
        uint256 costMicroUsdc,
        uint256 holdingAfter
    );
    event PropertyStatusChanged(uint256 indexed propertyId, bool active);
    event TreasuryChanged(address indexed previousTreasury, address indexed newTreasury);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(address usdc_, address treasury_) {
        require(usdc_ != address(0), "ZERO_USDC");
        require(treasury_ != address(0), "ZERO_TREASURY");
        owner = msg.sender;
        treasury = treasury_;
        usdc = ICircleUSDC(usdc_);
    }

    function listProperty(
        bytes32 assetKey,
        string calldata name,
        uint32 totalCells,
        uint64 priceMicroUsdc,
        uint32 minCells
    ) external onlyOwner returns (uint256 propertyId) {
        require(assetKey != bytes32(0), "EMPTY_ASSET_KEY");
        require(bytes(name).length > 0, "EMPTY_NAME");
        require(totalCells > 0, "NO_CELLS");
        require(priceMicroUsdc > 0, "NO_PRICE");
        require(minCells > 0 && minCells <= totalCells, "BAD_MIN");

        propertyId = nextPropertyId++;
        properties[propertyId] = Property({
            assetKey: assetKey,
            name: name,
            totalCells: totalCells,
            soldCells: 0,
            minCells: minCells,
            priceMicroUsdc: priceMicroUsdc,
            active: true
        });
        emit PropertyListed(propertyId, assetKey, name, totalCells, priceMicroUsdc, minCells);
    }

    function buyCells(uint256 propertyId, uint256 cells) external {
        Property storage p = properties[propertyId];
        require(p.assetKey != bytes32(0), "UNKNOWN_PROPERTY");
        require(p.active, "PROPERTY_NOT_ACTIVE");
        require(cells >= p.minCells, "BELOW_MINIMUM");
        require(uint256(p.soldCells) + cells <= p.totalCells, "INSUFFICIENT_CELLS");

        uint256 cost = cells * uint256(p.priceMicroUsdc);
        require(usdc.transferFrom(msg.sender, treasury, cost), "USDC_TRANSFER_FAILED");

        p.soldCells += uint32(cells);
        holdings[propertyId][msg.sender] += cells;
        if (!hasInvested[propertyId][msg.sender]) {
            hasInvested[propertyId][msg.sender] = true;
            investorCount[propertyId] += 1;
        }
        emit CellsPurchased(propertyId, msg.sender, cells, cost, holdings[propertyId][msg.sender]);
    }

    function setPropertyActive(uint256 propertyId, bool active) external onlyOwner {
        require(properties[propertyId].assetKey != bytes32(0), "UNKNOWN_PROPERTY");
        properties[propertyId].active = active;
        emit PropertyStatusChanged(propertyId, active);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "ZERO_TREASURY");
        address previous = treasury;
        treasury = newTreasury;
        emit TreasuryChanged(previous, newTreasury);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_OWNER");
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    function remainingCells(uint256 propertyId) external view returns (uint256) {
        Property memory p = properties[propertyId];
        require(p.assetKey != bytes32(0), "UNKNOWN_PROPERTY");
        return uint256(p.totalCells) - uint256(p.soldCells);
    }
}
