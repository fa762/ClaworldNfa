// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ClawOracle
 * @dev AI reasoning oracle for lobster decisions.
 *      Off-chain OpenClaw nodes fulfill reasoning requests.
 */
contract ClawOracle is OwnableUpgradeable, UUPSUpgradeable {

    enum RequestStatus { PENDING, FULFILLED, EXPIRED }

    struct OracleRequest {
        uint256 nfaId;
        address consumer;
        string prompt;
        uint8 numOfChoices;
        uint8 choice;
        string reasoningCid;    // IPFS CID
        RequestStatus status;
        uint64 timestamp;
    }

    uint256 private _requestIdCounter;
    mapping(uint256 => OracleRequest) public requests;

    // Authorized fulfiller nodes
    mapping(address => bool) public fulfillers;

    uint256 public constant REQUEST_TIMEOUT = 1 hours;

    event ReasoningRequested(uint256 indexed requestId, uint256 indexed nfaId, address consumer, string prompt, uint8 numOfChoices);
    event ReasoningFulfilled(uint256 indexed requestId, uint8 choice, string reasoningCid);
    event FulfillerUpdated(address fulfiller, bool authorized);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function reason(
        uint256 nfaId,
        string calldata prompt,
        uint8 numOfChoices
    ) external returns (uint256) {
        require(numOfChoices >= 2, "Need at least 2 choices");

        uint256 requestId = ++_requestIdCounter;
        requests[requestId] = OracleRequest({
            nfaId: nfaId,
            consumer: msg.sender,
            prompt: prompt,
            numOfChoices: numOfChoices,
            choice: 0,
            reasoningCid: "",
            status: RequestStatus.PENDING,
            timestamp: uint64(block.timestamp)
        });

        emit ReasoningRequested(requestId, nfaId, msg.sender, prompt, numOfChoices);
        return requestId;
    }

    function fulfillReasoning(
        uint256 requestId,
        uint8 choice,
        string calldata reasoningCid
    ) external {
        require(fulfillers[msg.sender], "Not authorized fulfiller");
        OracleRequest storage req = requests[requestId];
        require(req.status == RequestStatus.PENDING, "Not pending");
        require(block.timestamp <= req.timestamp + REQUEST_TIMEOUT, "Request expired");
        require(choice < req.numOfChoices, "Invalid choice");

        req.choice = choice;
        req.reasoningCid = reasoningCid;
        req.status = RequestStatus.FULFILLED;

        emit ReasoningFulfilled(requestId, choice, reasoningCid);
    }

    function expireRequest(uint256 requestId) external {
        OracleRequest storage req = requests[requestId];
        require(req.status == RequestStatus.PENDING, "Not pending");
        require(block.timestamp > req.timestamp + REQUEST_TIMEOUT, "Not expired");
        req.status = RequestStatus.EXPIRED;
    }

    function setFulfiller(address fulfiller, bool authorized) external onlyOwner {
        fulfillers[fulfiller] = authorized;
        emit FulfillerUpdated(fulfiller, authorized);
    }

    function getRequest(uint256 requestId) external view returns (OracleRequest memory) {
        return requests[requestId];
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev Reserved storage gap for future upgrades.
     */
    uint256[40] private __gap;
}
