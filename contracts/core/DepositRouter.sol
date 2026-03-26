// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDRPancakeRouter {
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
    function WETH() external pure returns (address);
}

interface IDRFlapPortal {
    function buy(
        address token,
        address recipient,
        uint256 minAmount
    ) external payable returns (uint256 amount);
    function previewBuy(
        address token,
        uint256 eth
    ) external view returns (uint256 amount);
}

interface IDRClawRouter {
    function addCLW(uint256 nfaId, uint256 amount) external;
    function initialized(uint256 nfaId) external view returns (bool);
}

/**
 * @title DepositRouter
 * @dev Handles BNB → CLW conversion and deposit to lobster balances.
 *      Extracted from ClawRouter to reduce contract complexity.
 *      Supports both PancakeSwap (post-graduation) and Flap Portal (pre-graduation).
 */
contract DepositRouter is
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    IDRClawRouter public router;
    IERC20 public clwToken;

    address public pancakeRouter;
    address public flapPortal;
    bool public graduated;

    event BuyAndDeposit(uint256 indexed nfaId, uint256 bnbSpent, uint256 clwReceived);
    event FlapBuyAndDeposit(uint256 indexed nfaId, uint256 bnbSpent, uint256 clwReceived);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _router,
        address _clwToken
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        router = IDRClawRouter(_router);
        clwToken = IERC20(_clwToken);
    }

    // ============================================
    // BUY AND DEPOSIT
    // ============================================

    /**
     * @dev Post-graduation: Buy CLW via PancakeSwap and deposit to lobster.
     */
    function buyAndDeposit(uint256 nfaId) external payable nonReentrant {
        require(router.initialized(nfaId), "Lobster not initialized");
        require(graduated, "Not graduated to DEX");
        require(msg.value > 0, "Zero BNB");
        require(pancakeRouter != address(0), "PancakeRouter not set");

        address[] memory path = new address[](2);
        path[0] = IDRPancakeRouter(pancakeRouter).WETH();
        path[1] = address(clwToken);

        uint256[] memory amounts = IDRPancakeRouter(pancakeRouter).swapExactETHForTokens{value: msg.value}(
            0, path, address(this), block.timestamp + 300
        );

        uint256 clwReceived = amounts[amounts.length - 1];

        // Approve and add CLW to lobster via router (as authorized skill)
        clwToken.approve(address(router), clwReceived);
        router.addCLW(nfaId, clwReceived);

        emit BuyAndDeposit(nfaId, msg.value, clwReceived);
    }

    /**
     * @dev Pre-graduation: Buy CLW via Flap portal and deposit to lobster.
     */
    function flapBuyAndDeposit(uint256 nfaId) external payable nonReentrant {
        require(router.initialized(nfaId), "Lobster not initialized");
        require(!graduated, "Already graduated");
        require(msg.value > 0, "Zero BNB");
        require(flapPortal != address(0), "FlapPortal not set");

        uint256 clwReceived = IDRFlapPortal(flapPortal).buy{value: msg.value}(
            address(clwToken), address(this), 0
        );

        // Approve and add CLW to lobster via router (as authorized skill)
        clwToken.approve(address(router), clwReceived);
        router.addCLW(nfaId, clwReceived);

        emit FlapBuyAndDeposit(nfaId, msg.value, clwReceived);
    }

    /**
     * @dev Preview how much CLW you'd get for a given BNB amount via Flap.
     */
    function previewFlapBuy(uint256 bnbAmount) external view returns (uint256) {
        require(flapPortal != address(0), "FlapPortal not set");
        return IDRFlapPortal(flapPortal).previewBuy(address(clwToken), bnbAmount);
    }

    // ============================================
    // ADMIN
    // ============================================

    function setPancakeRouter(address _router) external onlyOwner {
        pancakeRouter = _router;
    }

    function setFlapPortal(address _portal) external onlyOwner {
        flapPortal = _portal;
    }

    function setGraduated(bool _graduated) external onlyOwner {
        graduated = _graduated;
    }

    function setRouter(address _router) external onlyOwner {
        router = IDRClawRouter(_router);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev Reserved storage gap for future upgrades.
     */
    uint256[40] private __gap;
}
