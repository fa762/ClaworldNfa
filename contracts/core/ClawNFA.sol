// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ClawNFA
 * @dev Lobster NFA contract based on BAP-578 standard.
 *      Extended from ChatAndBuild reference implementation.
 *      UUPS upgradeable, ERC-721 compatible.
 */
contract ClawNFA is
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // ============================================
    // STRUCTS (BAP-578 Standard)
    // ============================================

    struct AgentMetadata {
        string persona;
        string experience;
        string voiceHash;
        string animationURI;
        string vaultURI;
        bytes32 vaultHash;
    }

    struct AgentState {
        uint256 balance;
        bool active;
        address logicAddress;
        uint256 createdAt;
    }

    // ============================================
    // STATE VARIABLES
    // ============================================

    uint256 private _tokenIdCounter;

    mapping(uint256 => AgentState) public agentStates;
    mapping(uint256 => AgentMetadata) public agentMetadata;

    address public treasuryAddress;
    bool public paused;

    // Minter role: only GenesisVault or authorized minter can mint
    address public minter;

    // Post-genesis mint price (0.02 BNB, Common only)
    uint256 public constant POST_GENESIS_PRICE = 0.02 ether;
    bool public postGenesisMintEnabled;

    // Default logic address (router) for post-genesis mints
    address public defaultLogicAddress;

    // Learning tree: Merkle root tracks personality/DNA evolution history
    mapping(uint256 => bytes32) public learningTreeRoot;
    mapping(uint256 => uint256) public learningVersion;
    mapping(uint256 => uint256) public lastLearningUpdate;

    // ============================================
    // EVENTS
    // ============================================

    event AgentCreated(uint256 indexed tokenId, address indexed owner, address logicAddress, string metadataURI);
    event AgentFunded(uint256 indexed tokenId, address indexed funder, uint256 amount);
    event AgentWithdraw(uint256 indexed tokenId, uint256 amount);
    event AgentStatusChanged(uint256 indexed tokenId, bool active);
    event LogicAddressUpdated(uint256 indexed tokenId, address newLogicAddress);
    event MetadataUpdated(uint256 indexed tokenId);
    event MinterUpdated(address newMinter);
    event LearningTreeUpdated(uint256 indexed tokenId, bytes32 newRoot, uint256 version);

    // ============================================
    // MODIFIERS
    // ============================================

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier onlyTokenOwner(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        _;
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "Not minter");
        _;
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        address treasury
    ) public initializer {
        require(treasury != address(0), "Invalid treasury");

        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __ReentrancyGuard_init();
        __Ownable_init();
        __UUPSUpgradeable_init();

        treasuryAddress = treasury;
    }

    // ============================================
    // MINTING (Genesis via minter, post-genesis public)
    // ============================================

    /**
     * @dev Genesis mint - only callable by minter (GenesisVault)
     */
    function mintTo(
        address to,
        address logicAddress,
        string memory metadataURI,
        AgentMetadata memory extendedMetadata
    ) external onlyMinter whenNotPaused returns (uint256) {
        return _mintAgent(to, logicAddress, metadataURI, extendedMetadata);
    }

    /**
     * @dev Post-genesis public mint (0.02 BNB, Common only)
     */
    function publicMint(
        string memory metadataURI,
        AgentMetadata memory extendedMetadata
    ) external payable whenNotPaused nonReentrant returns (uint256) {
        require(postGenesisMintEnabled, "Post-genesis mint not enabled");
        require(msg.value == POST_GENESIS_PRICE, "Incorrect fee");

        (bool success, ) = payable(treasuryAddress).call{value: msg.value}("");
        require(success, "Treasury transfer failed");

        return _mintAgent(msg.sender, defaultLogicAddress, metadataURI, extendedMetadata);
    }

    function _mintAgent(
        address to,
        address logicAddress,
        string memory metadataURI,
        AgentMetadata memory extendedMetadata
    ) internal returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");

        uint256 tokenId = ++_tokenIdCounter;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        agentStates[tokenId] = AgentState({
            balance: 0,
            active: true,
            logicAddress: logicAddress,
            createdAt: block.timestamp
        });

        agentMetadata[tokenId] = extendedMetadata;

        emit AgentCreated(tokenId, to, logicAddress, metadataURI);
        return tokenId;
    }

    // ============================================
    // BAP-578 CORE FUNCTIONS
    // ============================================

    /**
     * @dev Fund an agent with BNB (anyone can fund any agent)
     */
    function fundAgent(uint256 tokenId) external payable whenNotPaused {
        require(_exists(tokenId), "Token does not exist");
        require(msg.value > 0, "Zero value");
        agentStates[tokenId].balance += msg.value;
        emit AgentFunded(tokenId, msg.sender, msg.value);
    }

    /**
     * @dev Withdraw BNB from agent (owner only)
     */
    function withdrawFromAgent(
        uint256 tokenId,
        uint256 amount
    ) external onlyTokenOwner(tokenId) nonReentrant {
        require(agentStates[tokenId].balance >= amount, "Insufficient balance");
        agentStates[tokenId].balance -= amount;
        emit AgentWithdraw(tokenId, amount);
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Toggle agent active status (maps to ALIVE/DORMANT)
     */
    function setAgentStatus(uint256 tokenId, bool active) external onlyTokenOwner(tokenId) {
        agentStates[tokenId].active = active;
        emit AgentStatusChanged(tokenId, active);
    }

    /**
     * @dev Set agent status by router (for dormancy/revival)
     */
    function setAgentStatusByRouter(uint256 tokenId, bool active) external {
        require(msg.sender == agentStates[tokenId].logicAddress, "Not logic address");
        agentStates[tokenId].active = active;
        emit AgentStatusChanged(tokenId, active);
    }

    /**
     * @dev Update logic address (router)
     */
    function setLogicAddress(
        uint256 tokenId,
        address newLogicAddress
    ) external onlyTokenOwner(tokenId) {
        agentStates[tokenId].logicAddress = newLogicAddress;
        emit LogicAddressUpdated(tokenId, newLogicAddress);
    }

    /**
     * @dev Update agent metadata (token owner only)
     */
    function updateAgentMetadata(
        uint256 tokenId,
        string memory newMetadataURI,
        AgentMetadata memory newExtendedMetadata
    ) external onlyTokenOwner(tokenId) {
        _setTokenURI(tokenId, newMetadataURI);
        agentMetadata[tokenId] = newExtendedMetadata;
        emit MetadataUpdated(tokenId);
    }

    /**
     * @dev Admin batch-set vaultURI + vaultHash for NFT images (minter/owner only).
     *      Used after mint to assign IPFS images without needing token owner permission.
     */
    function setVaultURI(uint256 tokenId, string memory vaultURI, bytes32 vaultHash) external {
        require(msg.sender == minter || msg.sender == owner(), "Not minter or owner");
        require(_exists(tokenId), "Token does not exist");
        require(bytes(agentMetadata[tokenId].vaultURI).length == 0, "URI already set");
        agentMetadata[tokenId].vaultURI = vaultURI;
        agentMetadata[tokenId].vaultHash = vaultHash;
        _setTokenURI(tokenId, vaultURI);
        emit MetadataUpdated(tokenId);
    }

    // ============================================
    // LEARNING TREE (evolution history)
    // ============================================

    /**
     * @dev Update learning tree root. Callable by logic address (ClawRouter)
     *      to record personality/DNA evolution history.
     */
    function updateLearningTree(
        uint256 tokenId,
        bytes32 newRoot
    ) external {
        require(_exists(tokenId), "Token does not exist");
        require(
            msg.sender == agentStates[tokenId].logicAddress,
            "Not logic address"
        );

        learningVersion[tokenId]++;
        learningTreeRoot[tokenId] = newRoot;
        lastLearningUpdate[tokenId] = block.timestamp;

        emit LearningTreeUpdated(tokenId, newRoot, learningVersion[tokenId]);
    }

    /**
     * @dev Owner can also update learning tree for their own NFA.
     */
    function updateLearningTreeByOwner(
        uint256 tokenId,
        bytes32 newRoot
    ) external onlyTokenOwner(tokenId) {
        learningVersion[tokenId]++;
        learningTreeRoot[tokenId] = newRoot;
        lastLearningUpdate[tokenId] = block.timestamp;

        emit LearningTreeUpdated(tokenId, newRoot, learningVersion[tokenId]);
    }

    function getLearningTree(uint256 tokenId)
        external view returns (bytes32 root, uint256 version, uint256 lastUpdate)
    {
        return (learningTreeRoot[tokenId], learningVersion[tokenId], lastLearningUpdate[tokenId]);
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    function setMinter(address newMinter) external onlyOwner {
        minter = newMinter;
        emit MinterUpdated(newMinter);
    }

    event TreasuryChanged(address oldTreasury, address newTreasury);
    event PausedChanged(bool paused);
    event PostGenesisMintChanged(bool enabled);
    event DefaultLogicAddressChanged(address newLogic);

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Zero address");
        emit TreasuryChanged(treasuryAddress, newTreasury);
        treasuryAddress = newTreasury;
    }

    function setPaused(bool pausedState) external onlyOwner {
        paused = pausedState;
        emit PausedChanged(pausedState);
    }

    function setPostGenesisMintEnabled(bool enabled) external onlyOwner {
        postGenesisMintEnabled = enabled;
        emit PostGenesisMintChanged(enabled);
    }

    function setDefaultLogicAddress(address _logic) external onlyOwner {
        defaultLogicAddress = _logic;
        emit DefaultLogicAddressChanged(_logic);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    function getAgentState(uint256 tokenId)
        external view returns (uint256 balance, bool active, address logicAddress, uint256 createdAt, address tokenOwner)
    {
        require(_exists(tokenId), "Token does not exist");
        AgentState memory state = agentStates[tokenId];
        return (state.balance, state.active, state.logicAddress, state.createdAt, ownerOf(tokenId));
    }

    function getAgentMetadata(uint256 tokenId)
        external view returns (AgentMetadata memory metadata, string memory metadataURI)
    {
        require(_exists(tokenId), "Token does not exist");
        return (agentMetadata[tokenId], tokenURI(tokenId));
    }

    function tokensOfOwner(address account) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(account);
        uint256[] memory tokens = new uint256[](tokenCount);
        for (uint256 i = 0; i < tokenCount; i++) {
            tokens[i] = tokenOfOwnerByIndex(account, i);
        }
        return tokens;
    }

    function getTotalSupply() external view returns (uint256) {
        return totalSupply();
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }

    // ============================================
    // OVERRIDES
    // ============================================

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(uint256 tokenId)
        internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
    {
        require(agentStates[tokenId].balance == 0, "Agent balance must be 0");
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev Reserved storage gap for future upgrades.
     */
    uint256[40] private __gap;

    receive() external payable {
        revert("Use fundAgent() instead");
    }
}
