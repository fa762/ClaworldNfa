// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IClawActionAdapter.sol";
import "./interfaces/IClawAutonomyDelegationRegistryView.sol";

interface IActionHubNFA {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IClawOracleHub {
    enum RequestStatus { PENDING, FULFILLED, EXPIRED }

    struct OracleRequest {
        uint256 nfaId;
        address consumer;
        string prompt;
        uint8 numOfChoices;
        uint8 choice;
        string reasoningCid;
        RequestStatus status;
        uint64 timestamp;
    }

    function reason(
        uint256 nfaId,
        string calldata prompt,
        uint8 numOfChoices
    ) external returns (uint256);

    function getRequest(uint256 requestId) external view returns (OracleRequest memory);
}

interface IAutonomyRegistryHub {
    enum ActionKind {
        TASK,
        PK,
        MARKET,
        BATTLE_ROYALE,
        WORLD_EVENT
    }

    struct CapabilityDescriptor {
        bool policyEnabled;
        bool emergencyPaused;
        bool operatorApproved;
        bool adapterApproved;
        bool protocolApproved;
        bool assetBudgetEnabled;
        bool protocolAssetBudgetEnabled;
        bool operatorBudgetEnabled;
        bool operatorAssetBudgetEnabled;
        bool dynamicReserveEnabled;
        bool protocolDynamicReserveEnabled;
        bool allowed;
        uint8 checkCode;
        uint8 riskMode;
        uint8 operatorRoleMask;
        uint32 dailyLimit;
        uint32 actionsUsed;
        uint32 remainingToday;
        uint32 operatorRemainingToday;
        uint32 failureStreak;
        uint256 actionSpendCap;
        uint256 assetMaxPerAction;
        uint256 protocolMaxPerAction;
        uint256 operatorMaxPerAction;
        uint256 operatorAssetMaxPerAction;
        uint256 assetRemainingBudget;
        uint256 protocolRemainingBudget;
        uint256 operatorRemainingSpendBudget;
        uint256 operatorAssetRemainingBudget;
        uint256 currentBalance;
        uint256 effectiveReserve;
    }

    function getPolicy(
        uint256 nfaId,
        ActionKind actionKind
    ) external view returns (
        bool enabled,
        uint8 riskMode,
        uint32 dailyLimit,
        uint32 actionsUsed,
        uint64 windowStart,
        uint256 maxClwPerAction
    );

    function consumeAuthorizedAction(
        uint256 nfaId,
        ActionKind actionKind,
        bytes32 protocolId,
        bytes32 assetId,
        uint256 spendAmount,
        address operator
    ) external returns (uint32 remainingToday);

    function preflightAuthorizedAction(
        uint256 nfaId,
        ActionKind actionKind,
        bytes32 assetId,
        uint256 spendAmount,
        address adapter,
        bytes32 protocolId,
        address operator
    ) external view;

    function recordActionFailure(
        uint256 nfaId,
        ActionKind actionKind,
        address executor
    ) external;

    function isOperatorApproved(
        uint256 nfaId,
        ActionKind actionKind,
        address operator
    ) external view returns (bool);

    function hasOperatorRole(
        uint256 nfaId,
        ActionKind actionKind,
        address operator,
        uint8 roleMask
    ) external view returns (bool);

    function getCapabilityDescriptor(
        uint256 nfaId,
        ActionKind actionKind,
        bytes32 protocolId,
        bytes32 assetId,
        address adapter,
        address operator,
        uint256 spendAmount
    ) external view returns (CapabilityDescriptor memory descriptor);
}

interface IAutonomyDelegationRegistryHub is IClawAutonomyDelegationRegistryView {}

/**
 * @title ClawOracleActionHub
 * @dev Generic request/fulfillment hub for future autonomous NFA actions.
 *      Today it only records requests, oracle results, and policy consumption.
 *      Later, action-specific contracts can attach actual execution logic.
 */
contract ClawOracleActionHub is OwnableUpgradeable, UUPSUpgradeable {
    error InvalidOracle();
    error InvalidRegistry();
    error InvalidNfaAddress();
    error NotRequestAuthorized();
    error PolicyDisabled();
    error SpendCapExceeded();
    error MissingSpendAsset();
    error ProtocolNotSet();
    error ActionNotPending();
    error NotAuthorizedMaintainer();
    error WrongOracleConsumer();
    error OracleResultNotReady();
    error ActionNotExecutable();
    error NotAuthorizedExecutor();
    error AdapterNotSet();
    error AdapterOverspend();
    error SpendAssetMismatch();
    error ActionNotFound();
    error ActionNotCancellable();
    error NotAllowedToCancel();

    uint8 private constant OPERATOR_ROLE_REQUEST = 1;
    uint8 private constant OPERATOR_ROLE_EXECUTE = 2;
    uint8 private constant OPERATOR_ROLE_MAINTAIN = 4;

    enum PendingStatus {
        NONE,
        REQUESTED,
        FULFILLED,
        EXECUTING,
        EXECUTED,
        FAILED,
        EXPIRED,
        CANCELLED
    }

    struct PendingAction {
        uint256 nfaId;
        uint8 actionKind;
        bytes32 protocolId;
        bytes32 spendAssetId;
        bytes payload;
        bytes32 payloadHash;
        uint256 spendAmount;
        uint8 numChoices;
        address requester;
        uint64 createdAt;
        uint8 resolvedChoice;
        string reasoningCid;
        bytes32 capabilityHash;
        bytes32 executionRef;
        bytes32 resultHash;
        bytes32 receiptHash;
        uint256 actualSpend;
        uint256 clwCredit;
        uint32 xpCredit;
        address lastExecutor;
        uint64 executedAt;
        uint32 retryCount;
        string lastError;
        PendingStatus status;
    }

    struct ActionAggregate {
        uint32 requestedCount;
        uint32 fulfilledCount;
        uint32 executedCount;
        uint32 failedCount;
        uint32 expiredCount;
        uint32 cancelledCount;
        uint256 totalRequestedSpend;
        uint256 totalActualSpend;
        uint256 totalClwCredit;
        uint32 totalXpCredit;
        uint64 lastUpdatedAt;
        bytes32 lastExecutionRef;
    }

    struct NfaLedger {
        uint32 executedCount;
        uint32 failedCount;
        uint32 cancelledCount;
        uint32 expiredCount;
        uint256 totalActualSpend;
        uint256 totalClwCredit;
        uint32 totalXpCredit;
        uint64 lastUpdatedAt;
        bytes32 lastExecutionRef;
    }

    struct ActionReceipt {
        uint256 requestId;
        uint256 nfaId;
        uint8 actionKind;
        bytes32 protocolId;
        bytes32 spendAssetId;
        PendingStatus status;
        address requester;
        address lastExecutor;
        uint8 resolvedChoice;
        bytes32 payloadHash;
        bytes32 capabilityHash;
        bytes32 executionRef;
        bytes32 resultHash;
        bytes32 receiptHash;
        uint256 requestedSpend;
        uint256 actualSpend;
        uint256 clwCredit;
        uint32 xpCredit;
        uint64 createdAt;
        uint64 executedAt;
        uint32 retryCount;
        string reasoningCid;
        string lastError;
    }

    IClawOracleHub public oracle;
    IAutonomyRegistryHub public registry;
    IActionHubNFA public nfa;

    mapping(address => bool) public dispatchers;
    mapping(address => bool) public actionExecutors;
    mapping(address => bool) public maintenanceOperators;
    IAutonomyDelegationRegistryHub public delegationRegistry;
    mapping(uint8 => address) public adapters;
    mapping(uint8 => bytes32) public adapterProtocols;
    mapping(uint256 => PendingAction) public pendingActions;
    mapping(uint256 => mapping(uint8 => ActionAggregate)) private _actionAggregates;
    mapping(uint256 => NfaLedger) private _nfaLedgers;
    mapping(uint256 => mapping(bytes32 => ActionAggregate)) private _protocolAggregates;
    mapping(uint256 => mapping(bytes32 => ActionAggregate)) private _assetAggregates;
    mapping(uint256 => uint256[]) private _nfaRequestIds;
    mapping(uint256 => mapping(bytes32 => uint256[])) private _protocolRequestIds;

    event DispatcherUpdated(address indexed dispatcher, bool authorized);
    event ActionExecutorUpdated(address indexed executor, bool authorized);
    event MaintenanceOperatorUpdated(address indexed operator, bool authorized);
    event DelegationRegistryUpdated(address indexed delegationRegistry);
    event AdapterUpdated(uint8 indexed actionKind, address indexed adapter);
    event AdapterProtocolUpdated(uint8 indexed actionKind, bytes32 indexed protocolId);
    event AutonomousActionRequested(
        uint256 indexed requestId,
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        bytes32 protocolId,
        bytes32 spendAssetId,
        address requester,
        bytes32 payloadHash,
        uint256 spendAmount,
        uint8 numChoices
    );
    event AutonomousActionReady(
        uint256 indexed requestId,
        uint8 indexed actionKind,
        bytes32 indexed protocolId,
        uint8 choice,
        string reasoningCid
    );
    event AutonomousActionExpired(
        uint256 indexed requestId,
        uint8 indexed actionKind,
        bytes32 indexed protocolId
    );
    event AutonomousActionExecutionStarted(
        uint256 indexed requestId,
        uint8 indexed actionKind,
        address indexed executor,
        address adapter,
        uint32 retryCount
    );
    event AutonomousActionExecuted(
        uint256 indexed requestId,
        uint8 indexed actionKind,
        address indexed executor,
        address adapter,
        bytes32 executionRef,
        bytes32 spendAssetId,
        uint32 remainingToday,
        uint256 actualSpend,
        uint256 clwCredit,
        uint32 xpCredit
    );
    event AutonomousActionFailed(
        uint256 indexed requestId,
        uint8 indexed actionKind,
        address indexed executor,
        string reason,
        uint32 retryCount
    );
    event AutonomousActionCancelled(
        uint256 indexed requestId,
        uint8 indexed actionKind,
        address indexed caller
    );
    event AutonomousActionReceiptUpdated(
        uint256 indexed requestId,
        uint8 indexed actionKind,
        uint8 status,
        bytes32 resultHash,
        bytes32 receiptHash
    );
    event AutonomousActionIndexed(
        uint256 indexed requestId,
        uint256 indexed nfaId,
        bytes32 indexed protocolId,
        uint32 nfaCount,
        uint32 protocolCount
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _oracle,
        address _registry,
        address _nfa
    ) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        if (_oracle == address(0)) revert InvalidOracle();
        if (_registry == address(0)) revert InvalidRegistry();
        if (_nfa == address(0)) revert InvalidNfaAddress();

        oracle = IClawOracleHub(_oracle);
        registry = IAutonomyRegistryHub(_registry);
        nfa = IActionHubNFA(_nfa);
    }

    function setDispatcher(address dispatcher, bool authorized) external onlyOwner {
        dispatchers[dispatcher] = authorized;
        emit DispatcherUpdated(dispatcher, authorized);
    }

    function setActionExecutor(address executor, bool authorized) external onlyOwner {
        actionExecutors[executor] = authorized;
        emit ActionExecutorUpdated(executor, authorized);
    }

    function setMaintenanceOperator(address operator, bool authorized) external onlyOwner {
        maintenanceOperators[operator] = authorized;
        emit MaintenanceOperatorUpdated(operator, authorized);
    }

    function setDelegationRegistry(address delegationRegistry_) external onlyOwner {
        delegationRegistry = IAutonomyDelegationRegistryHub(delegationRegistry_);
        emit DelegationRegistryUpdated(delegationRegistry_);
    }

    function setAdapter(
        IAutonomyRegistryHub.ActionKind actionKind,
        address adapter
    ) external onlyOwner {
        adapters[uint8(actionKind)] = adapter;
        emit AdapterUpdated(uint8(actionKind), adapter);
    }

    function setAdapterProtocol(
        IAutonomyRegistryHub.ActionKind actionKind,
        bytes32 protocolId
    ) external onlyOwner {
        adapterProtocols[uint8(actionKind)] = protocolId;
        emit AdapterProtocolUpdated(uint8(actionKind), protocolId);
    }

    function requestAutonomousAction(
        uint256 nfaId,
        IAutonomyRegistryHub.ActionKind actionKind,
        bytes32 spendAssetId,
        uint256 spendAmount,
        bytes calldata payload,
        string calldata prompt,
        uint8 numChoices
    ) external returns (uint256 requestId) {
        address nfaOwner = nfa.ownerOf(nfaId);
        bool operatorApproved = _hasDelegatedRole(
            nfaId,
            actionKind,
            msg.sender,
            OPERATOR_ROLE_REQUEST
        );
        address policyOperator = operatorApproved ? msg.sender : address(0);
        if (!(msg.sender == nfaOwner || dispatchers[msg.sender] || operatorApproved)) {
            revert NotRequestAuthorized();
        }

        (
            bool enabled,
            ,
            ,
            ,
            ,
            uint256 maxClwPerAction
        ) = registry.getPolicy(nfaId, actionKind);
        if (!enabled) revert PolicyDisabled();
        if (maxClwPerAction > 0) {
            if (spendAmount > maxClwPerAction) revert SpendCapExceeded();
        }
        if (spendAmount > 0) {
            if (spendAssetId == bytes32(0)) revert MissingSpendAsset();
        }

        bytes32 protocolId = adapterProtocols[uint8(actionKind)];
        if (protocolId == bytes32(0)) revert ProtocolNotSet();
        if (operatorApproved) {
            registry.preflightAuthorizedAction(
                nfaId,
                actionKind,
                spendAssetId,
                spendAmount,
                adapters[uint8(actionKind)],
                protocolId,
                policyOperator
            );
        }

        requestId = oracle.reason(nfaId, prompt, numChoices);
        bytes32 payloadHash = keccak256(payload);
        IAutonomyRegistryHub.CapabilityDescriptor memory capabilityDescriptor = registry.getCapabilityDescriptor(
            nfaId,
            actionKind,
            protocolId,
            spendAssetId,
            adapters[uint8(actionKind)],
            policyOperator,
            spendAmount
        );
        bytes32 capabilityHash = _hashCapabilityDescriptor(
            nfaId,
            actionKind,
            protocolId,
            spendAssetId,
            adapters[uint8(actionKind)],
            policyOperator,
            spendAmount,
            capabilityDescriptor
        );
        pendingActions[requestId] = PendingAction({
            nfaId: nfaId,
            actionKind: uint8(actionKind),
            protocolId: protocolId,
            spendAssetId: spendAssetId,
            payload: payload,
            payloadHash: payloadHash,
            spendAmount: spendAmount,
            numChoices: numChoices,
            requester: msg.sender,
            createdAt: uint64(block.timestamp),
            resolvedChoice: 0,
            reasoningCid: "",
            capabilityHash: capabilityHash,
            executionRef: bytes32(0),
            resultHash: bytes32(0),
            receiptHash: bytes32(0),
            actualSpend: 0,
            clwCredit: 0,
            xpCredit: 0,
            lastExecutor: address(0),
            executedAt: 0,
            retryCount: 0,
            lastError: "",
            status: PendingStatus.REQUESTED
        });

        ActionAggregate storage aggregate = _actionAggregates[nfaId][uint8(actionKind)];
        aggregate.requestedCount += 1;
        aggregate.totalRequestedSpend += spendAmount;
        aggregate.lastUpdatedAt = uint64(block.timestamp);

        ActionAggregate storage protocolAggregate = _protocolAggregates[nfaId][protocolId];
        protocolAggregate.requestedCount += 1;
        protocolAggregate.totalRequestedSpend += spendAmount;
        protocolAggregate.lastUpdatedAt = uint64(block.timestamp);

        if (spendAssetId != bytes32(0)) {
            ActionAggregate storage assetAggregate = _assetAggregates[nfaId][spendAssetId];
            assetAggregate.requestedCount += 1;
            assetAggregate.totalRequestedSpend += spendAmount;
            assetAggregate.lastUpdatedAt = uint64(block.timestamp);
        }

        _nfaRequestIds[nfaId].push(requestId);
        _protocolRequestIds[nfaId][protocolId].push(requestId);

        emit AutonomousActionRequested(
            requestId,
            nfaId,
            uint8(actionKind),
            protocolId,
            spendAssetId,
            msg.sender,
            payloadHash,
            spendAmount,
            numChoices
        );
        emit AutonomousActionIndexed(
            requestId,
            nfaId,
            protocolId,
            uint32(_nfaRequestIds[nfaId].length),
            uint32(_protocolRequestIds[nfaId][protocolId].length)
        );
    }

    function syncOracleResult(uint256 requestId) external {
        PendingAction storage action = pendingActions[requestId];
        if (action.status != PendingStatus.REQUESTED) revert ActionNotPending();
        bool localMaintainer = _hasDelegatedRole(
            action.nfaId,
            IAutonomyRegistryHub.ActionKind(action.actionKind),
            msg.sender,
            OPERATOR_ROLE_MAINTAIN
        );
        if (
            !(
                maintenanceOperators[msg.sender] ||
                actionExecutors[msg.sender] ||
                dispatchers[msg.sender] ||
                localMaintainer ||
                msg.sender == owner()
            )
        ) revert NotAuthorizedMaintainer();

        IClawOracleHub.OracleRequest memory oracleRequest = oracle.getRequest(requestId);
        if (oracleRequest.consumer != address(this)) revert WrongOracleConsumer();

        if (oracleRequest.status == IClawOracleHub.RequestStatus.FULFILLED) {
            action.status = PendingStatus.FULFILLED;
            action.resolvedChoice = oracleRequest.choice;
            action.reasoningCid = oracleRequest.reasoningCid;
            _actionAggregates[action.nfaId][action.actionKind].fulfilledCount += 1;
            _actionAggregates[action.nfaId][action.actionKind].lastUpdatedAt = uint64(block.timestamp);
            _protocolAggregates[action.nfaId][action.protocolId].fulfilledCount += 1;
            _protocolAggregates[action.nfaId][action.protocolId].lastUpdatedAt = uint64(block.timestamp);
            if (action.spendAssetId != bytes32(0)) {
                _assetAggregates[action.nfaId][action.spendAssetId].fulfilledCount += 1;
                _assetAggregates[action.nfaId][action.spendAssetId].lastUpdatedAt = uint64(block.timestamp);
            }

            emit AutonomousActionReady(
                requestId,
                action.actionKind,
                action.protocolId,
                oracleRequest.choice,
                oracleRequest.reasoningCid
            );
            _updateReceipt(action, requestId);
            return;
        }

        if (oracleRequest.status == IClawOracleHub.RequestStatus.EXPIRED) {
            action.status = PendingStatus.EXPIRED;
            _actionAggregates[action.nfaId][action.actionKind].expiredCount += 1;
            _actionAggregates[action.nfaId][action.actionKind].lastUpdatedAt = uint64(block.timestamp);
            _protocolAggregates[action.nfaId][action.protocolId].expiredCount += 1;
            _protocolAggregates[action.nfaId][action.protocolId].lastUpdatedAt = uint64(block.timestamp);
            if (action.spendAssetId != bytes32(0)) {
                _assetAggregates[action.nfaId][action.spendAssetId].expiredCount += 1;
                _assetAggregates[action.nfaId][action.spendAssetId].lastUpdatedAt = uint64(block.timestamp);
            }
            _nfaLedgers[action.nfaId].expiredCount += 1;
            _nfaLedgers[action.nfaId].lastUpdatedAt = uint64(block.timestamp);
            emit AutonomousActionExpired(requestId, action.actionKind, action.protocolId);
            _updateReceipt(action, requestId);
            return;
        }

        revert OracleResultNotReady();
    }

    function executeSyncedAction(uint256 requestId) external {
        PendingAction storage action = pendingActions[requestId];
        if (!(action.status == PendingStatus.FULFILLED || action.status == PendingStatus.FAILED)) {
            revert ActionNotExecutable();
        }
        bool localExecutor = _hasDelegatedRole(
            action.nfaId,
            IAutonomyRegistryHub.ActionKind(action.actionKind),
            msg.sender,
            OPERATOR_ROLE_EXECUTE
        );
        if (
            !(
                actionExecutors[msg.sender] ||
                dispatchers[msg.sender] ||
                localExecutor ||
                msg.sender == owner()
            )
        ) revert NotAuthorizedExecutor();

        address adapter = adapters[action.actionKind];
        if (adapter == address(0)) revert AdapterNotSet();
        address policyOperator = _resolvePolicyOperator(
            action.nfaId,
            IAutonomyRegistryHub.ActionKind(action.actionKind),
            action.requester
        );

        registry.preflightAuthorizedAction(
            action.nfaId,
            IAutonomyRegistryHub.ActionKind(action.actionKind),
            action.spendAssetId,
            action.spendAmount,
            adapter,
            action.protocolId,
            policyOperator
        );

        action.status = PendingStatus.EXECUTING;
        action.lastExecutor = msg.sender;
        action.retryCount += 1;
        action.lastError = "";

        emit AutonomousActionExecutionStarted(
            requestId,
            action.actionKind,
            msg.sender,
            adapter,
            action.retryCount
        );

        try IClawActionAdapter(adapter).executeAutonomousAction(
            requestId,
            action.nfaId,
            action.actionKind,
            action.resolvedChoice,
            action.spendAssetId,
            action.spendAmount,
            action.payload,
            action.reasoningCid
        ) returns (IClawActionAdapter.ActionExecutionResult memory result) {
            if (result.actualSpend > action.spendAmount) revert AdapterOverspend();
            if (result.spendAssetId != action.spendAssetId) revert SpendAssetMismatch();
            uint32 remainingToday = registry.consumeAuthorizedAction(
                action.nfaId,
                IAutonomyRegistryHub.ActionKind(action.actionKind),
                action.protocolId,
                result.spendAssetId,
                result.actualSpend,
                policyOperator
            );

            action.executionRef = result.executionRef;
            action.actualSpend = result.actualSpend;
            action.clwCredit = result.clwCredit;
            action.xpCredit = result.xpCredit;
            action.executedAt = uint64(block.timestamp);
            action.status = PendingStatus.EXECUTED;

            ActionAggregate storage aggregate = _actionAggregates[action.nfaId][action.actionKind];
            aggregate.executedCount += 1;
            aggregate.totalActualSpend += result.actualSpend;
            aggregate.totalClwCredit += result.clwCredit;
            aggregate.totalXpCredit += result.xpCredit;
            aggregate.lastUpdatedAt = uint64(block.timestamp);
            aggregate.lastExecutionRef = result.executionRef;

            ActionAggregate storage protocolAggregate = _protocolAggregates[action.nfaId][action.protocolId];
            protocolAggregate.executedCount += 1;
            protocolAggregate.totalActualSpend += result.actualSpend;
            protocolAggregate.totalClwCredit += result.clwCredit;
            protocolAggregate.totalXpCredit += result.xpCredit;
            protocolAggregate.lastUpdatedAt = uint64(block.timestamp);
            protocolAggregate.lastExecutionRef = result.executionRef;

            if (action.spendAssetId != bytes32(0)) {
                ActionAggregate storage assetAggregate = _assetAggregates[action.nfaId][action.spendAssetId];
                assetAggregate.executedCount += 1;
                assetAggregate.totalActualSpend += result.actualSpend;
                assetAggregate.totalClwCredit += result.clwCredit;
                assetAggregate.totalXpCredit += result.xpCredit;
                assetAggregate.lastUpdatedAt = uint64(block.timestamp);
                assetAggregate.lastExecutionRef = result.executionRef;
            }

            NfaLedger storage ledger = _nfaLedgers[action.nfaId];
            ledger.executedCount += 1;
            ledger.totalActualSpend += result.actualSpend;
            ledger.totalClwCredit += result.clwCredit;
            ledger.totalXpCredit += result.xpCredit;
            ledger.lastUpdatedAt = uint64(block.timestamp);
            ledger.lastExecutionRef = result.executionRef;

            _updateReceipt(action, requestId);

            emit AutonomousActionExecuted(
                requestId,
                action.actionKind,
                msg.sender,
                adapter,
                result.executionRef,
                result.spendAssetId,
                remainingToday,
                result.actualSpend,
                result.clwCredit,
                result.xpCredit
            );
        } catch Error(string memory reason) {
            registry.recordActionFailure(
                action.nfaId,
                IAutonomyRegistryHub.ActionKind(action.actionKind),
                msg.sender
            );
            _markExecutionFailed(action, requestId, msg.sender, reason);
        } catch Panic(uint256 panicCode) {
            registry.recordActionFailure(
                action.nfaId,
                IAutonomyRegistryHub.ActionKind(action.actionKind),
                msg.sender
            );
            _markExecutionFailed(
                action,
                requestId,
                msg.sender,
                "Adapter panic"
            );
            panicCode;
        } catch {
            registry.recordActionFailure(
                action.nfaId,
                IAutonomyRegistryHub.ActionKind(action.actionKind),
                msg.sender
            );
            _markExecutionFailed(action, requestId, msg.sender, "Adapter execution failed");
        }
    }

    function cancelAutonomousAction(uint256 requestId) external {
        PendingAction storage action = pendingActions[requestId];
        if (action.status == PendingStatus.NONE) revert ActionNotFound();
        if (
            !(
                action.status == PendingStatus.REQUESTED ||
                action.status == PendingStatus.FULFILLED ||
                action.status == PendingStatus.FAILED ||
                action.status == PendingStatus.EXPIRED
            )
        ) revert ActionNotCancellable();
        bool localMaintainer = _hasDelegatedRole(
            action.nfaId,
            IAutonomyRegistryHub.ActionKind(action.actionKind),
            msg.sender,
            OPERATOR_ROLE_MAINTAIN
        );
        if (
            !(
                dispatchers[msg.sender] ||
                maintenanceOperators[msg.sender] ||
                localMaintainer ||
                msg.sender == owner() ||
                msg.sender == nfa.ownerOf(action.nfaId)
            )
        ) revert NotAllowedToCancel();

        action.status = PendingStatus.CANCELLED;
        action.lastExecutor = msg.sender;
        action.lastError = "";
        _actionAggregates[action.nfaId][action.actionKind].cancelledCount += 1;
        _actionAggregates[action.nfaId][action.actionKind].lastUpdatedAt = uint64(block.timestamp);
        _protocolAggregates[action.nfaId][action.protocolId].cancelledCount += 1;
        _protocolAggregates[action.nfaId][action.protocolId].lastUpdatedAt = uint64(block.timestamp);
        if (action.spendAssetId != bytes32(0)) {
            _assetAggregates[action.nfaId][action.spendAssetId].cancelledCount += 1;
            _assetAggregates[action.nfaId][action.spendAssetId].lastUpdatedAt = uint64(block.timestamp);
        }
        _nfaLedgers[action.nfaId].cancelledCount += 1;
        _nfaLedgers[action.nfaId].lastUpdatedAt = uint64(block.timestamp);

        _updateReceipt(action, requestId);

        emit AutonomousActionCancelled(requestId, action.actionKind, msg.sender);
    }

    function getActionAggregate(
        uint256 nfaId,
        IAutonomyRegistryHub.ActionKind actionKind
    ) external view returns (ActionAggregate memory) {
        return _actionAggregates[nfaId][uint8(actionKind)];
    }

    function getProtocolAggregate(
        uint256 nfaId,
        bytes32 protocolId
    ) external view returns (ActionAggregate memory) {
        return _protocolAggregates[nfaId][protocolId];
    }

    function getAssetAggregate(
        uint256 nfaId,
        bytes32 assetId
    ) external view returns (ActionAggregate memory) {
        return _assetAggregates[nfaId][assetId];
    }

    function getNfaLedger(uint256 nfaId) external view returns (NfaLedger memory) {
        return _nfaLedgers[nfaId];
    }

    function getActionReceipt(uint256 requestId) external view returns (ActionReceipt memory) {
        PendingAction storage action = pendingActions[requestId];
        return _buildReceipt(requestId, action);
    }

    function getRequestIdsByNfa(
        uint256 nfaId,
        uint256 cursor,
        uint256 limit
    ) external view returns (uint256[] memory ids, uint256 nextCursor) {
        return _sliceRequestIds(_nfaRequestIds[nfaId], cursor, limit);
    }

    function getRequestIdsByProtocol(
        uint256 nfaId,
        bytes32 protocolId,
        uint256 cursor,
        uint256 limit
    ) external view returns (uint256[] memory ids, uint256 nextCursor) {
        return _sliceRequestIds(_protocolRequestIds[nfaId][protocolId], cursor, limit);
    }

    function getActionReceiptsByNfa(
        uint256 nfaId,
        uint256 cursor,
        uint256 limit
    ) external view returns (ActionReceipt[] memory receipts, uint256 nextCursor) {
        (uint256[] memory ids, uint256 next) = _sliceRequestIds(_nfaRequestIds[nfaId], cursor, limit);
        receipts = new ActionReceipt[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            receipts[i] = _buildReceipt(ids[i], pendingActions[ids[i]]);
        }
        return (receipts, next);
    }

    function getActionReceiptsByProtocol(
        uint256 nfaId,
        bytes32 protocolId,
        uint256 cursor,
        uint256 limit
    ) external view returns (ActionReceipt[] memory receipts, uint256 nextCursor) {
        (uint256[] memory ids, uint256 next) = _sliceRequestIds(_protocolRequestIds[nfaId][protocolId], cursor, limit);
        receipts = new ActionReceipt[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            receipts[i] = _buildReceipt(ids[i], pendingActions[ids[i]]);
        }
        return (receipts, next);
    }

    function _buildReceipt(
        uint256 requestId,
        PendingAction storage action
    ) internal view returns (ActionReceipt memory) {
        return ActionReceipt({
            requestId: requestId,
            nfaId: action.nfaId,
            actionKind: action.actionKind,
            protocolId: action.protocolId,
            spendAssetId: action.spendAssetId,
            status: action.status,
            requester: action.requester,
            lastExecutor: action.lastExecutor,
            resolvedChoice: action.resolvedChoice,
            payloadHash: action.payloadHash,
            capabilityHash: action.capabilityHash,
            executionRef: action.executionRef,
            resultHash: action.resultHash,
            receiptHash: action.receiptHash,
            requestedSpend: action.spendAmount,
            actualSpend: action.actualSpend,
            clwCredit: action.clwCredit,
            xpCredit: action.xpCredit,
            createdAt: action.createdAt,
            executedAt: action.executedAt,
            retryCount: action.retryCount,
            reasoningCid: action.reasoningCid,
            lastError: action.lastError
        });
    }

    function _sliceRequestIds(
        uint256[] storage source,
        uint256 cursor,
        uint256 limit
    ) internal view returns (uint256[] memory ids, uint256 nextCursor) {
        if (cursor >= source.length) {
            return (new uint256[](0), source.length);
        }

        uint256 end = cursor + limit;
        if (end > source.length) {
            end = source.length;
        }

        ids = new uint256[](end - cursor);
        for (uint256 i = cursor; i < end; i++) {
            ids[i - cursor] = source[i];
        }

        return (ids, end);
    }

    function _markExecutionFailed(
        PendingAction storage action,
        uint256 requestId,
        address executor,
        string memory reason
    ) internal {
        action.status = PendingStatus.FAILED;
        action.lastExecutor = executor;
        action.lastError = reason;
        _actionAggregates[action.nfaId][action.actionKind].failedCount += 1;
        _actionAggregates[action.nfaId][action.actionKind].lastUpdatedAt = uint64(block.timestamp);
        _protocolAggregates[action.nfaId][action.protocolId].failedCount += 1;
        _protocolAggregates[action.nfaId][action.protocolId].lastUpdatedAt = uint64(block.timestamp);
        if (action.spendAssetId != bytes32(0)) {
            _assetAggregates[action.nfaId][action.spendAssetId].failedCount += 1;
            _assetAggregates[action.nfaId][action.spendAssetId].lastUpdatedAt = uint64(block.timestamp);
        }
        _nfaLedgers[action.nfaId].failedCount += 1;
        _nfaLedgers[action.nfaId].lastUpdatedAt = uint64(block.timestamp);

        _updateReceipt(action, requestId);

        emit AutonomousActionFailed(
            requestId,
            action.actionKind,
            executor,
            reason,
            action.retryCount
        );
    }

    function _resolvePolicyOperator(
        uint256 nfaId,
        IAutonomyRegistryHub.ActionKind actionKind,
        address requester
    ) internal view returns (address) {
        if (
            requester != address(0) &&
            _hasDelegatedRole(nfaId, actionKind, requester, OPERATOR_ROLE_REQUEST)
        ) {
            return requester;
        }
        return address(0);
    }

    function _hasDelegatedRole(
        uint256 nfaId,
        IAutonomyRegistryHub.ActionKind actionKind,
        address operator,
        uint8 roleMask
    ) internal view returns (bool) {
        if (!registry.hasOperatorRole(nfaId, actionKind, operator, roleMask)) {
            return false;
        }
        if (address(delegationRegistry) == address(0)) {
            return true;
        }
        return delegationRegistry.hasActiveLease(nfaId, uint8(actionKind), operator, roleMask);
    }

    function _hashCapabilityDescriptor(
        uint256 nfaId,
        IAutonomyRegistryHub.ActionKind actionKind,
        bytes32 protocolId,
        bytes32 assetId,
        address adapter,
        address operator,
        uint256 spendAmount,
        IAutonomyRegistryHub.CapabilityDescriptor memory descriptor
    ) internal view returns (bytes32) {
        IClawAutonomyDelegationRegistryView.DelegationLease memory lease;
        bool leaseActive = false;
        if (address(delegationRegistry) != address(0) && operator != address(0)) {
            lease = delegationRegistry.getDelegationLease(nfaId, uint8(actionKind), operator);
            leaseActive = delegationRegistry.hasActiveLease(nfaId, uint8(actionKind), operator, OPERATOR_ROLE_REQUEST);
        }
        return keccak256(
            abi.encode(
                block.chainid,
                address(registry),
                nfaId,
                uint8(actionKind),
                protocolId,
                assetId,
                adapter,
                operator,
                spendAmount,
                descriptor.policyEnabled,
                descriptor.emergencyPaused,
                descriptor.operatorApproved,
                descriptor.adapterApproved,
                descriptor.protocolApproved,
                descriptor.assetBudgetEnabled,
                descriptor.protocolAssetBudgetEnabled,
                descriptor.operatorBudgetEnabled,
                descriptor.operatorAssetBudgetEnabled,
                descriptor.dynamicReserveEnabled,
                descriptor.protocolDynamicReserveEnabled,
                descriptor.allowed,
                descriptor.checkCode,
                descriptor.riskMode,
                descriptor.operatorRoleMask,
                descriptor.dailyLimit,
                descriptor.actionsUsed,
                descriptor.remainingToday,
                descriptor.operatorRemainingToday,
                descriptor.failureStreak,
                descriptor.actionSpendCap,
                descriptor.assetMaxPerAction,
                descriptor.protocolMaxPerAction,
                descriptor.operatorMaxPerAction,
                descriptor.operatorAssetMaxPerAction,
                descriptor.assetRemainingBudget,
                descriptor.protocolRemainingBudget,
                descriptor.operatorRemainingSpendBudget,
                descriptor.operatorAssetRemainingBudget,
                descriptor.currentBalance,
                descriptor.effectiveReserve,
                lease.enabled,
                lease.roleMask,
                lease.issuedAt,
                lease.expiresAt,
                leaseActive
            )
        );
    }

    function _updateReceipt(
        PendingAction storage action,
        uint256 requestId
    ) internal {
        action.resultHash = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                requestId,
                action.nfaId,
                action.actionKind,
                action.protocolId,
                action.spendAssetId,
                action.status,
                action.requester,
                action.lastExecutor,
                action.resolvedChoice,
                action.payloadHash,
                action.capabilityHash,
                keccak256(bytes(action.reasoningCid)),
                action.executionRef,
                action.spendAmount,
                action.actualSpend,
                action.clwCredit,
                action.xpCredit,
                action.createdAt,
                action.executedAt,
                action.retryCount,
                keccak256(bytes(action.lastError))
            )
        );
        action.receiptHash = keccak256(
            abi.encode(
                action.resultHash,
                requestId,
                action.protocolId,
                action.spendAssetId
            )
        );

        emit AutonomousActionReceiptUpdated(
            requestId,
            action.actionKind,
            uint8(action.status),
            action.resultHash,
            action.receiptHash
        );
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    uint256[34] private __gap;
}
