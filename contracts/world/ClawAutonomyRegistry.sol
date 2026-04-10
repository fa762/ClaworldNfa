// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IAutonomyNFA {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IAutonomyBalanceSource {
    function autonomyBalanceOf(uint256 nfaId) external view returns (uint256);
}

interface IAutonomyReserveSource {
    function autonomyRequiredReserveOf(
        uint256 nfaId,
        uint8 actionKind,
        bytes32 assetId
    ) external view returns (uint256);
}

/**
 * @title ClawAutonomyRegistry
 * @dev Owner-defined guardrails for future autonomous NFA actions.
 *      This contract does not execute gameplay actions on its own.
 *      It only tracks what an NFA is allowed to do and how much
 *      budget / daily room remains for an authorized executor.
 */
contract ClawAutonomyRegistry is OwnableUpgradeable, UUPSUpgradeable {
    error InvalidNfa();
    error NotNfaOwner();
    error InvalidAsset();
    error InvalidProtocol();
    error InvalidAdapter();
    error InvalidOperator();
    error InvalidOperatorRoleMask();
    error InvalidReserveBuffer();
    error NotAuthorizedExecutor();
    error PolicyDisabled();
    error EmergencyPaused();
    error AdapterNotApproved();
    error ProtocolNotApproved();
    error OperatorNotApproved();
    error SpendCapExceeded();
    error DailyLimitReached();
    error FailureBreakerTripped();
    error MissingSpendAsset();
    error AssetBudgetNotConfigured();
    error DailyAssetLimitReached();
    error AssetSourceNotSet();
    error ReserveSourceNotSet();
    error ReserveFloorBreached();
    error UnknownCheckFailure();

    bytes32 public constant ASSET_CLAWORLD = keccak256("asset:claworld");
    uint8 public constant OPERATOR_ROLE_REQUEST = 1;
    uint8 public constant OPERATOR_ROLE_EXECUTE = 2;
    uint8 public constant OPERATOR_ROLE_MAINTAIN = 4;

    enum ActionKind {
        TASK,
        PK,
        MARKET,
        BATTLE_ROYALE,
        WORLD_EVENT
    }

    enum CheckCode {
        OK,
        POLICY_DISABLED,
        EMERGENCY_PAUSED,
        ADAPTER_NOT_APPROVED,
        PROTOCOL_NOT_APPROVED,
        OPERATOR_NOT_APPROVED,
        SPEND_CAP_EXCEEDED,
        DAILY_LIMIT_REACHED,
        FAILURE_BREAKER_TRIPPED,
        MISSING_SPEND_ASSET,
        ASSET_BUDGET_NOT_CONFIGURED,
        DAILY_ASSET_LIMIT_REACHED,
        ASSET_SOURCE_NOT_SET,
        RESERVE_SOURCE_NOT_SET,
        RESERVE_FLOOR_BREACHED
    }

    struct Policy {
        bool enabled;
        bool emergencyPaused;
        uint8 riskMode;
        uint32 dailyLimit;       // 0 = unlimited
        uint32 actionsUsed;
        uint32 maxFailureStreak; // 0 = unlimited
        uint32 failureStreak;
        uint32 totalActions;
        uint32 totalFailures;
        uint64 windowStart;
        uint64 lastActionAt;
        uint256 maxClwPerAction; // 0 = no CLW spend cap
        uint256 minClwReserve;   // 0 = no reserve floor
    }

    struct AssetBudget {
        bool enabled;
        bool useDynamicReserve;
        uint16 dynamicReserveBufferBps;
        uint64 windowStart;
        uint256 maxPerAction;     // 0 = no per-action cap
        uint256 minReserve;       // 0 = no reserve floor
        uint256 dailyAmountLimit; // 0 = unlimited
        uint256 amountUsedToday;
        uint256 totalAmountSpent;
    }

    struct ProtocolAssetBudget {
        bool enabled;
        bool useDynamicReserve;
        uint16 dynamicReserveBufferBps;
        uint64 windowStart;
        uint256 maxPerAction;
        uint256 minReserve;
        uint256 dailyAmountLimit;
        uint256 amountUsedToday;
        uint256 totalAmountSpent;
    }

    struct OperatorBudget {
        bool enabled;
        uint64 windowStart;
        uint32 dailyActionLimit;
        uint32 actionsUsed;
        uint32 totalActions;
        uint256 maxPerAction;
        uint256 dailySpendLimit;
        uint256 spendUsedToday;
        uint256 totalAmountSpent;
    }

    struct OperatorAssetBudget {
        bool enabled;
        uint64 windowStart;
        uint256 maxPerAction;
        uint256 dailyAmountLimit;
        uint256 amountUsedToday;
        uint256 totalAmountSpent;
    }

    struct AssetDescriptor {
        bool configured;
        bool spendEnabled;
        address assetToken;
        address balanceSource;
        address reserveSource;
        address sourceAdapter;
        address settlementAdapter;
        uint8 decimals;
        bytes32 balanceModel;
        bytes32 sourceModel;
        bytes32 settlementModel;
    }

    struct ProtocolDescriptor {
        bool configured;
        bool autonomousEnabled;
        bool oracleRequired;
        address settlementAdapter;
        bytes32 capabilityModel;
        bytes32 capabilitySchema;
        uint32 capabilityVersion;
        bytes32 settlementModel;
        bytes32 executionModel;
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

    IAutonomyNFA public nfa;

    mapping(uint256 => mapping(uint8 => Policy)) private _policies;
    mapping(uint256 => mapping(uint8 => mapping(bytes32 => AssetBudget))) private _assetBudgets;
    mapping(uint256 => mapping(bytes32 => mapping(bytes32 => ProtocolAssetBudget))) private _protocolAssetBudgets;
    mapping(uint256 => mapping(uint8 => mapping(address => OperatorBudget))) private _operatorBudgets;
    mapping(uint256 => mapping(uint8 => mapping(address => mapping(bytes32 => OperatorAssetBudget)))) private _operatorAssetBudgets;
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) private _approvedAdapters;
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) private _approvedOperators;
    mapping(uint256 => mapping(uint8 => mapping(address => uint8))) private _operatorRoleMasks;
    mapping(uint256 => mapping(bytes32 => bool)) private _approvedProtocols;
    mapping(bytes32 => AssetDescriptor) private _assetDescriptors;
    mapping(bytes32 => ProtocolDescriptor) private _protocolDescriptors;
    mapping(bytes32 => IAutonomyBalanceSource) public assetBalanceSources;
    mapping(bytes32 => IAutonomyReserveSource) public assetReserveSources;
    mapping(uint256 => bytes32[]) private _trackedProtocols;
    mapping(uint256 => mapping(bytes32 => bool)) private _trackedProtocolSeen;
    mapping(uint256 => bytes32[]) private _trackedAssets;
    mapping(uint256 => mapping(bytes32 => bool)) private _trackedAssetSeen;
    mapping(uint256 => mapping(uint8 => address[])) private _trackedActionAdapters;
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) private _trackedActionAdapterSeen;
    mapping(uint256 => mapping(uint8 => address[])) private _trackedActionOperators;
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) private _trackedActionOperatorSeen;
    mapping(address => bool) public executors;

    event PolicyUpdated(
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        bool enabled,
        uint8 riskMode,
        uint32 dailyLimit,
        uint256 maxClwPerAction
    );
    event ExecutorUpdated(address indexed executor, bool authorized);
    event AssetBalanceSourceUpdated(bytes32 indexed assetId, address indexed balanceSource);
    event AssetReserveSourceUpdated(bytes32 indexed assetId, address indexed reserveSource);
    event AuthorizedActionConsumed(
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        bytes32 assetId,
        address indexed executor,
        uint256 spendAmount,
        uint32 actionsUsed,
        uint32 remainingToday
    );
    event RiskControlsUpdated(
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        uint32 maxFailureStreak,
        uint256 minClwReserve
    );
    event EmergencyPauseUpdated(
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        bool paused
    );
    event ActionFailureRecorded(
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        address indexed executor,
        uint32 failureStreak,
        uint32 totalFailures
    );
    event AdapterApprovalUpdated(
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        address indexed adapter,
        bool approved
    );
    event ProtocolApprovalUpdated(
        uint256 indexed nfaId,
        bytes32 indexed protocolId,
        bool approved
    );
    event OperatorApprovalUpdated(
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        address indexed operator,
        bool approved
    );
    event OperatorRoleMaskUpdated(
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        address indexed operator,
        uint8 roleMask
    );
    event OperatorBudgetUpdated(
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        address indexed operator,
        bool enabled,
        uint32 dailyActionLimit,
        uint256 maxPerAction,
        uint256 dailySpendLimit
    );
    event OperatorAssetBudgetUpdated(
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        address indexed operator,
        bytes32 assetId,
        bool enabled,
        uint256 maxPerAction,
        uint256 dailyAmountLimit
    );
    event AssetBudgetUpdated(
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        bytes32 indexed assetId,
        bool enabled,
        uint256 maxPerAction,
        uint256 minReserve,
        uint256 dailyAmountLimit
    );
    event DynamicReserveConfigUpdated(
        uint256 indexed nfaId,
        uint8 indexed actionKind,
        bytes32 indexed assetId,
        bool enabled,
        uint16 bufferBps
    );
    event ProtocolAssetBudgetUpdated(
        uint256 indexed nfaId,
        bytes32 indexed protocolId,
        bytes32 indexed assetId,
        bool enabled,
        uint256 maxPerAction,
        uint256 minReserve,
        uint256 dailyAmountLimit
    );
    event ProtocolDynamicReserveConfigUpdated(
        uint256 indexed nfaId,
        bytes32 indexed protocolId,
        bytes32 indexed assetId,
        bool enabled,
        uint16 bufferBps
    );
    event AssetDescriptorUpdated(
        bytes32 indexed assetId,
        address indexed assetToken,
        address indexed sourceAdapter,
        address settlementAdapter,
        uint8 decimals,
        bool spendEnabled,
        bytes32 balanceModel,
        bytes32 sourceModel,
        bytes32 settlementModel
    );
    event ProtocolDescriptorUpdated(
        bytes32 indexed protocolId,
        bool autonomousEnabled,
        bool oracleRequired,
        address indexed settlementAdapter,
        bytes32 capabilityModel,
        bytes32 capabilitySchema,
        uint32 capabilityVersion,
        bytes32 settlementModel,
        bytes32 executionModel
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _nfa) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        if (_nfa == address(0)) revert InvalidNfa();
        nfa = IAutonomyNFA(_nfa);
    }

    function setPolicy(
        uint256 nfaId,
        ActionKind actionKind,
        bool enabled,
        uint8 riskMode,
        uint32 dailyLimit,
        uint256 maxClwPerAction
    ) external {
        _requireNfaOwner(nfaId);

        Policy storage policy = _policies[nfaId][uint8(actionKind)];
        policy.enabled = enabled;
        policy.riskMode = riskMode;
        policy.dailyLimit = dailyLimit;
        policy.maxClwPerAction = maxClwPerAction;

        emit PolicyUpdated(
            nfaId,
            uint8(actionKind),
            enabled,
            riskMode,
            dailyLimit,
            maxClwPerAction
        );
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
    ) {
        Policy storage policy = _policies[nfaId][uint8(actionKind)];
        return (
            policy.enabled,
            policy.riskMode,
            policy.dailyLimit,
            policy.actionsUsed,
            policy.windowStart,
            policy.maxClwPerAction
        );
    }

    function setExecutor(address executor, bool authorized) external onlyOwner {
        executors[executor] = authorized;
        emit ExecutorUpdated(executor, authorized);
    }

    function setBalanceSource(address source) external onlyOwner {
        assetBalanceSources[ASSET_CLAWORLD] = IAutonomyBalanceSource(source);
        emit AssetBalanceSourceUpdated(ASSET_CLAWORLD, source);
    }

    function setAssetBalanceSource(bytes32 assetId, address source) external onlyOwner {
        _requireAsset(assetId);
        assetBalanceSources[assetId] = IAutonomyBalanceSource(source);
        emit AssetBalanceSourceUpdated(assetId, source);
    }

    function setAssetReserveSource(bytes32 assetId, address source) external onlyOwner {
        _requireAsset(assetId);
        assetReserveSources[assetId] = IAutonomyReserveSource(source);
        emit AssetReserveSourceUpdated(assetId, source);
    }

    function setAssetDescriptor(
        bytes32 assetId,
        address assetToken,
        address sourceAdapter,
        address settlementAdapter,
        uint8 decimals,
        bool spendEnabled,
        bytes32 balanceModel,
        bytes32 sourceModel,
        bytes32 settlementModel
    ) external onlyOwner {
        _requireAsset(assetId);

        AssetDescriptor storage descriptor = _assetDescriptors[assetId];
        descriptor.configured = true;
        descriptor.spendEnabled = spendEnabled;
        descriptor.assetToken = assetToken;
        descriptor.sourceAdapter = sourceAdapter;
        descriptor.settlementAdapter = settlementAdapter;
        descriptor.decimals = decimals;
        descriptor.balanceModel = balanceModel;
        descriptor.sourceModel = sourceModel;
        descriptor.settlementModel = settlementModel;

        emit AssetDescriptorUpdated(
            assetId,
            assetToken,
            sourceAdapter,
            settlementAdapter,
            decimals,
            spendEnabled,
            balanceModel,
            sourceModel,
            settlementModel
        );
    }

    function setProtocolDescriptor(
        bytes32 protocolId,
        bool autonomousEnabled,
        bool oracleRequired,
        address settlementAdapter,
        bytes32 capabilityModel,
        bytes32 capabilitySchema,
        uint32 capabilityVersion,
        bytes32 settlementModel,
        bytes32 executionModel
    ) external onlyOwner {
        _requireProtocol(protocolId);

        ProtocolDescriptor storage descriptor = _protocolDescriptors[protocolId];
        descriptor.configured = true;
        descriptor.autonomousEnabled = autonomousEnabled;
        descriptor.oracleRequired = oracleRequired;
        descriptor.settlementAdapter = settlementAdapter;
        descriptor.capabilityModel = capabilityModel;
        descriptor.capabilitySchema = capabilitySchema;
        descriptor.capabilityVersion = capabilityVersion;
        descriptor.settlementModel = settlementModel;
        descriptor.executionModel = executionModel;

        emit ProtocolDescriptorUpdated(
            protocolId,
            autonomousEnabled,
            oracleRequired,
            settlementAdapter,
            capabilityModel,
            capabilitySchema,
            capabilityVersion,
            settlementModel,
            executionModel
        );
    }

    function setRiskControls(
        uint256 nfaId,
        ActionKind actionKind,
        uint32 maxFailureStreak,
        uint256 minClwReserve
    ) external {
        _requireNfaOwner(nfaId);

        Policy storage policy = _policies[nfaId][uint8(actionKind)];
        policy.maxFailureStreak = maxFailureStreak;
        policy.minClwReserve = minClwReserve;

        emit RiskControlsUpdated(
            nfaId,
            uint8(actionKind),
            maxFailureStreak,
            minClwReserve
        );
    }

    function setEmergencyPause(
        uint256 nfaId,
        ActionKind actionKind,
        bool paused
    ) external {
        _requireNfaOwner(nfaId);

        Policy storage policy = _policies[nfaId][uint8(actionKind)];
        policy.emergencyPaused = paused;

        emit EmergencyPauseUpdated(nfaId, uint8(actionKind), paused);
    }

    function setApprovedAdapter(
        uint256 nfaId,
        ActionKind actionKind,
        address adapter,
        bool approved
    ) external {
        _requireNfaOwner(nfaId);
        _requireAdapter(adapter);

        _approvedAdapters[nfaId][uint8(actionKind)][adapter] = approved;
        _trackActionAdapter(nfaId, uint8(actionKind), adapter);
        emit AdapterApprovalUpdated(nfaId, uint8(actionKind), adapter, approved);
    }

    function setApprovedOperator(
        uint256 nfaId,
        ActionKind actionKind,
        address operator,
        bool approved
    ) external {
        _requireNfaOwner(nfaId);
        _requireOperator(operator);

        uint8 currentMask = _operatorRoleMasks[nfaId][uint8(actionKind)][operator];
        uint8 nextMask = approved ? currentMask | OPERATOR_ROLE_REQUEST : 0;
        _operatorRoleMasks[nfaId][uint8(actionKind)][operator] = nextMask;
        _approvedOperators[nfaId][uint8(actionKind)][operator] = nextMask != 0;
        _trackActionOperator(nfaId, uint8(actionKind), operator);
        emit OperatorApprovalUpdated(nfaId, uint8(actionKind), operator, nextMask != 0);
        emit OperatorRoleMaskUpdated(nfaId, uint8(actionKind), operator, nextMask);
    }

    function setOperatorRoleMask(
        uint256 nfaId,
        ActionKind actionKind,
        address operator,
        uint8 roleMask
    ) external {
        _requireNfaOwner(nfaId);
        _requireOperator(operator);
        if (roleMask > (OPERATOR_ROLE_REQUEST | OPERATOR_ROLE_EXECUTE | OPERATOR_ROLE_MAINTAIN)) {
            revert InvalidOperatorRoleMask();
        }

        _operatorRoleMasks[nfaId][uint8(actionKind)][operator] = roleMask;
        _approvedOperators[nfaId][uint8(actionKind)][operator] = roleMask != 0;
        _trackActionOperator(nfaId, uint8(actionKind), operator);
        emit OperatorApprovalUpdated(nfaId, uint8(actionKind), operator, roleMask != 0);
        emit OperatorRoleMaskUpdated(nfaId, uint8(actionKind), operator, roleMask);
    }

    function setApprovedProtocol(
        uint256 nfaId,
        bytes32 protocolId,
        bool approved
    ) external {
        _requireNfaOwner(nfaId);
        _requireProtocol(protocolId);

        _approvedProtocols[nfaId][protocolId] = approved;
        _trackProtocol(nfaId, protocolId);
        emit ProtocolApprovalUpdated(nfaId, protocolId, approved);
    }

    function setOperatorBudget(
        uint256 nfaId,
        ActionKind actionKind,
        address operator,
        bool enabled,
        uint32 dailyActionLimit,
        uint256 maxPerAction,
        uint256 dailySpendLimit
    ) external {
        _requireNfaOwner(nfaId);
        _requireOperator(operator);

        OperatorBudget storage budget = _operatorBudgets[nfaId][uint8(actionKind)][operator];
        budget.enabled = enabled;
        budget.dailyActionLimit = dailyActionLimit;
        budget.maxPerAction = maxPerAction;
        budget.dailySpendLimit = dailySpendLimit;
        _trackActionOperator(nfaId, uint8(actionKind), operator);

        emit OperatorBudgetUpdated(
            nfaId,
            uint8(actionKind),
            operator,
            enabled,
            dailyActionLimit,
            maxPerAction,
            dailySpendLimit
        );
    }

    function setOperatorAssetBudget(
        uint256 nfaId,
        ActionKind actionKind,
        address operator,
        bytes32 assetId,
        bool enabled,
        uint256 maxPerAction,
        uint256 dailyAmountLimit
    ) external {
        _requireNfaOwner(nfaId);
        _requireOperator(operator);
        _requireAsset(assetId);

        OperatorAssetBudget storage budget = _operatorAssetBudgets[nfaId][uint8(actionKind)][operator][assetId];
        budget.enabled = enabled;
        budget.maxPerAction = maxPerAction;
        budget.dailyAmountLimit = dailyAmountLimit;
        _trackActionOperator(nfaId, uint8(actionKind), operator);
        _trackAsset(nfaId, assetId);

        emit OperatorAssetBudgetUpdated(
            nfaId,
            uint8(actionKind),
            operator,
            assetId,
            enabled,
            maxPerAction,
            dailyAmountLimit
        );
    }

    function setAssetBudget(
        uint256 nfaId,
        ActionKind actionKind,
        bytes32 assetId,
        bool enabled,
        uint256 maxPerAction,
        uint256 minReserve,
        uint256 dailyAmountLimit
    ) external {
        _requireNfaOwner(nfaId);
        _requireAsset(assetId);

        AssetBudget storage budget = _assetBudgets[nfaId][uint8(actionKind)][assetId];
        budget.enabled = enabled;
        budget.maxPerAction = maxPerAction;
        budget.minReserve = minReserve;
        budget.dailyAmountLimit = dailyAmountLimit;
        _trackAsset(nfaId, assetId);

        emit AssetBudgetUpdated(
            nfaId,
            uint8(actionKind),
            assetId,
            enabled,
            maxPerAction,
            minReserve,
            dailyAmountLimit
        );
    }

    function setProtocolAssetBudget(
        uint256 nfaId,
        bytes32 protocolId,
        bytes32 assetId,
        bool enabled,
        uint256 maxPerAction,
        uint256 minReserve,
        uint256 dailyAmountLimit
    ) external {
        _requireNfaOwner(nfaId);
        _requireProtocol(protocolId);
        _requireAsset(assetId);

        ProtocolAssetBudget storage budget = _protocolAssetBudgets[nfaId][protocolId][assetId];
        budget.enabled = enabled;
        budget.maxPerAction = maxPerAction;
        budget.minReserve = minReserve;
        budget.dailyAmountLimit = dailyAmountLimit;
        _trackProtocol(nfaId, protocolId);
        _trackAsset(nfaId, assetId);

        emit ProtocolAssetBudgetUpdated(
            nfaId,
            protocolId,
            assetId,
            enabled,
            maxPerAction,
            minReserve,
            dailyAmountLimit
        );
    }

    function getAssetBudget(
        uint256 nfaId,
        ActionKind actionKind,
        bytes32 assetId
    ) external view returns (
        bool enabled,
        bool useDynamicReserve,
        uint16 dynamicReserveBufferBps,
        uint64 windowStart,
        uint256 maxPerAction,
        uint256 minReserve,
        uint256 dailyAmountLimit,
        uint256 amountUsedToday,
        uint256 totalAmountSpent
    ) {
        AssetBudget storage budget = _assetBudgets[nfaId][uint8(actionKind)][assetId];
        return (
            budget.enabled,
            budget.useDynamicReserve,
            budget.dynamicReserveBufferBps,
            budget.windowStart,
            budget.maxPerAction,
            budget.minReserve,
            budget.dailyAmountLimit,
            budget.amountUsedToday,
            budget.totalAmountSpent
        );
    }

    function getProtocolAssetBudget(
        uint256 nfaId,
        bytes32 protocolId,
        bytes32 assetId
    ) external view returns (
        bool enabled,
        bool useDynamicReserve,
        uint16 dynamicReserveBufferBps,
        uint64 windowStart,
        uint256 maxPerAction,
        uint256 minReserve,
        uint256 dailyAmountLimit,
        uint256 amountUsedToday,
        uint256 totalAmountSpent
    ) {
        ProtocolAssetBudget storage budget = _protocolAssetBudgets[nfaId][protocolId][assetId];
        return (
            budget.enabled,
            budget.useDynamicReserve,
            budget.dynamicReserveBufferBps,
            budget.windowStart,
            budget.maxPerAction,
            budget.minReserve,
            budget.dailyAmountLimit,
            budget.amountUsedToday,
            budget.totalAmountSpent
        );
    }

    function getTrackedProtocols(uint256 nfaId) external view returns (bytes32[] memory) {
        return _trackedProtocols[nfaId];
    }

    function getTrackedAssets(uint256 nfaId) external view returns (bytes32[] memory) {
        return _trackedAssets[nfaId];
    }

    function getAssetDescriptor(
        bytes32 assetId
    ) external view returns (
        AssetDescriptor memory descriptor
    ) {
        AssetDescriptor storage stored = _assetDescriptors[assetId];
        descriptor = AssetDescriptor({
            configured: stored.configured,
            spendEnabled: stored.spendEnabled,
            assetToken: stored.assetToken,
            balanceSource: address(assetBalanceSources[assetId]),
            reserveSource: address(assetReserveSources[assetId]),
            sourceAdapter: stored.sourceAdapter,
            settlementAdapter: stored.settlementAdapter,
            decimals: stored.decimals,
            balanceModel: stored.balanceModel,
            sourceModel: stored.sourceModel,
            settlementModel: stored.settlementModel
        });
    }

    function getProtocolDescriptor(
        bytes32 protocolId
    ) external view returns (
        ProtocolDescriptor memory descriptor
    ) {
        ProtocolDescriptor storage stored = _protocolDescriptors[protocolId];
        descriptor = ProtocolDescriptor({
            configured: stored.configured,
            autonomousEnabled: stored.autonomousEnabled,
            oracleRequired: stored.oracleRequired,
            settlementAdapter: stored.settlementAdapter,
            capabilityModel: stored.capabilityModel,
            capabilitySchema: stored.capabilitySchema,
            capabilityVersion: stored.capabilityVersion,
            settlementModel: stored.settlementModel,
            executionModel: stored.executionModel
        });
    }

    function getTrackedAdapters(
        uint256 nfaId,
        ActionKind actionKind
    ) external view returns (address[] memory) {
        return _trackedActionAdapters[nfaId][uint8(actionKind)];
    }

    function getTrackedOperators(
        uint256 nfaId,
        ActionKind actionKind
    ) external view returns (address[] memory) {
        return _trackedActionOperators[nfaId][uint8(actionKind)];
    }

    function getOperatorBudget(
        uint256 nfaId,
        ActionKind actionKind,
        address operator
    ) external view returns (
        bool enabled,
        uint64 windowStart,
        uint32 dailyActionLimit,
        uint32 actionsUsed,
        uint32 totalActions,
        uint256 maxPerAction,
        uint256 dailySpendLimit,
        uint256 spendUsedToday,
        uint256 totalAmountSpent
    ) {
        OperatorBudget storage budget = _operatorBudgets[nfaId][uint8(actionKind)][operator];
        return (
            budget.enabled,
            budget.windowStart,
            budget.dailyActionLimit,
            budget.actionsUsed,
            budget.totalActions,
            budget.maxPerAction,
            budget.dailySpendLimit,
            budget.spendUsedToday,
            budget.totalAmountSpent
        );
    }

    function getOperatorAssetBudget(
        uint256 nfaId,
        ActionKind actionKind,
        address operator,
        bytes32 assetId
    ) external view returns (
        bool enabled,
        uint64 windowStart,
        uint256 maxPerAction,
        uint256 dailyAmountLimit,
        uint256 amountUsedToday,
        uint256 totalAmountSpent
    ) {
        OperatorAssetBudget storage budget = _operatorAssetBudgets[nfaId][uint8(actionKind)][operator][assetId];
        return (
            budget.enabled,
            budget.windowStart,
            budget.maxPerAction,
            budget.dailyAmountLimit,
            budget.amountUsedToday,
            budget.totalAmountSpent
        );
    }

    function setDynamicReserveConfig(
        uint256 nfaId,
        ActionKind actionKind,
        bytes32 assetId,
        bool enabled,
        uint16 bufferBps
    ) external {
        _requireNfaOwner(nfaId);
        _requireAsset(assetId);
        if (bufferBps > 10_000) revert InvalidReserveBuffer();

        AssetBudget storage budget = _assetBudgets[nfaId][uint8(actionKind)][assetId];
        budget.useDynamicReserve = enabled;
        budget.dynamicReserveBufferBps = bufferBps;

        emit DynamicReserveConfigUpdated(
            nfaId,
            uint8(actionKind),
            assetId,
            enabled,
            bufferBps
        );
    }

    function setProtocolDynamicReserveConfig(
        uint256 nfaId,
        bytes32 protocolId,
        bytes32 assetId,
        bool enabled,
        uint16 bufferBps
    ) external {
        _requireNfaOwner(nfaId);
        _requireProtocol(protocolId);
        _requireAsset(assetId);
        if (bufferBps > 10_000) revert InvalidReserveBuffer();

        ProtocolAssetBudget storage budget = _protocolAssetBudgets[nfaId][protocolId][assetId];
        budget.useDynamicReserve = enabled;
        budget.dynamicReserveBufferBps = bufferBps;

        emit ProtocolDynamicReserveConfigUpdated(
            nfaId,
            protocolId,
            assetId,
            enabled,
            bufferBps
        );
    }

    function consumeAuthorizedAction(
        uint256 nfaId,
        ActionKind actionKind,
        bytes32 protocolId,
        bytes32 assetId,
        uint256 spendAmount,
        address operator
    ) external returns (uint32 remainingToday) {
        if (!executors[msg.sender]) revert NotAuthorizedExecutor();

        Policy storage policy = _policies[nfaId][uint8(actionKind)];
        AssetBudget storage budget = _assetBudgets[nfaId][uint8(actionKind)][assetId];
        ProtocolAssetBudget storage protocolBudget = _protocolAssetBudgets[nfaId][protocolId][assetId];
        OperatorBudget storage operatorBudget = _operatorBudgets[nfaId][uint8(actionKind)][operator];
        OperatorAssetBudget storage operatorAssetBudget = _operatorAssetBudgets[nfaId][uint8(actionKind)][operator][assetId];
        _assertActionAllowed(
            nfaId,
            uint8(actionKind),
            policy,
            budget,
            protocolBudget,
            operatorBudget,
            operatorAssetBudget,
            assetId,
            spendAmount,
            address(0),
            protocolId,
            operator
        );

        _rollWindow(policy);
        _rollAssetWindow(budget);
        _rollProtocolAssetWindow(protocolBudget);
        _rollOperatorWindow(operatorBudget);
        _rollOperatorAssetWindow(operatorAssetBudget);

        policy.actionsUsed += 1;
        policy.totalActions += 1;
        policy.failureStreak = 0;
        policy.lastActionAt = uint64(block.timestamp);

        if (assetId != bytes32(0) && budget.enabled) {
            budget.amountUsedToday += spendAmount;
            budget.totalAmountSpent += spendAmount;
        }
        if (assetId != bytes32(0) && protocolId != bytes32(0) && protocolBudget.enabled) {
            protocolBudget.amountUsedToday += spendAmount;
            protocolBudget.totalAmountSpent += spendAmount;
        }
        if (operator != address(0) && operatorBudget.enabled) {
            operatorBudget.actionsUsed += 1;
            operatorBudget.totalActions += 1;
            operatorBudget.spendUsedToday += spendAmount;
            operatorBudget.totalAmountSpent += spendAmount;
        }
        if (operator != address(0) && assetId != bytes32(0) && operatorAssetBudget.enabled) {
            operatorAssetBudget.amountUsedToday += spendAmount;
            operatorAssetBudget.totalAmountSpent += spendAmount;
        }

        if (policy.dailyLimit == 0) {
            remainingToday = type(uint32).max;
        } else {
            remainingToday = policy.dailyLimit - policy.actionsUsed;
        }

        emit AuthorizedActionConsumed(
            nfaId,
            uint8(actionKind),
            assetId,
            msg.sender,
            spendAmount,
            policy.actionsUsed,
            remainingToday
        );
    }

    function preflightAuthorizedAction(
        uint256 nfaId,
        ActionKind actionKind,
        bytes32 assetId,
        uint256 spendAmount,
        address adapter,
        bytes32 protocolId,
        address operator
    ) external view {
        if (!executors[msg.sender]) revert NotAuthorizedExecutor();
        Policy storage policy = _policies[nfaId][uint8(actionKind)];
        AssetBudget storage budget = _assetBudgets[nfaId][uint8(actionKind)][assetId];
        ProtocolAssetBudget storage protocolBudget = _protocolAssetBudgets[nfaId][protocolId][assetId];
        OperatorBudget storage operatorBudget = _operatorBudgets[nfaId][uint8(actionKind)][operator];
        OperatorAssetBudget storage operatorAssetBudget = _operatorAssetBudgets[nfaId][uint8(actionKind)][operator][assetId];
        _assertActionAllowed(
            nfaId,
            uint8(actionKind),
            policy,
            budget,
            protocolBudget,
            operatorBudget,
            operatorAssetBudget,
            assetId,
            spendAmount,
            adapter,
            protocolId,
            operator
        );
    }

    function previewAuthorizedAction(
        uint256 nfaId,
        ActionKind actionKind,
        bytes32 assetId,
        uint256 spendAmount,
        address adapter,
        bytes32 protocolId,
        address operator
    ) external view returns (
        bool allowed,
        uint8 code,
        uint32 remainingToday,
        uint256 remainingAssetBudget,
        uint256 remainingProtocolBudget,
        uint256 currentBalance,
        uint256 effectiveReserve,
        uint32 failureStreak
    ) {
        Policy storage policy = _policies[nfaId][uint8(actionKind)];
        AssetBudget storage budget = _assetBudgets[nfaId][uint8(actionKind)][assetId];
        ProtocolAssetBudget storage protocolBudget = _protocolAssetBudgets[nfaId][protocolId][assetId];
        OperatorBudget storage operatorBudget = _operatorBudgets[nfaId][uint8(actionKind)][operator];
        OperatorAssetBudget storage operatorAssetBudget = _operatorAssetBudgets[nfaId][uint8(actionKind)][operator][assetId];
        (
            CheckCode check,
            uint32 remainingActions,
            uint256 remainingAssetSpend,
            uint256 remainingProtocolSpend,
            uint256 balance,
            uint256 reserve,
            bool _operatorBudgetEnabled,
            uint32 _operatorRemainingToday,
            uint256 _operatorRemainingSpendBudget,
            uint256 _operatorMaxPerAction,
            bool _operatorAssetBudgetEnabled,
            uint256 _operatorAssetRemainingBudget,
            uint256 _operatorAssetMaxPerAction
        ) = _evaluateAction(
            nfaId,
            uint8(actionKind),
            policy,
            budget,
            protocolBudget,
            operatorBudget,
            operatorAssetBudget,
            assetId,
            spendAmount,
            adapter,
            protocolId,
            operator
        );

        _operatorBudgetEnabled;
        _operatorRemainingToday;
        _operatorRemainingSpendBudget;
        _operatorMaxPerAction;
        _operatorAssetBudgetEnabled;
        _operatorAssetRemainingBudget;
        _operatorAssetMaxPerAction;

        return (
            check == CheckCode.OK,
            uint8(check),
            remainingActions,
            remainingAssetSpend,
            remainingProtocolSpend,
            balance,
            reserve,
            policy.failureStreak
        );
    }

    function getCapabilityDescriptor(
        uint256 nfaId,
        ActionKind actionKind,
        bytes32 protocolId,
        bytes32 assetId,
        address adapter,
        address operator,
        uint256 spendAmount
    ) external view returns (CapabilityDescriptor memory descriptor) {
        Policy storage policy = _policies[nfaId][uint8(actionKind)];
        AssetBudget storage budget = _assetBudgets[nfaId][uint8(actionKind)][assetId];
        ProtocolAssetBudget storage protocolBudget = _protocolAssetBudgets[nfaId][protocolId][assetId];
        OperatorBudget storage operatorBudget = _operatorBudgets[nfaId][uint8(actionKind)][operator];
        OperatorAssetBudget storage operatorAssetBudget = _operatorAssetBudgets[nfaId][uint8(actionKind)][operator][assetId];
        (
            CheckCode check,
            uint32 remainingActions,
            uint256 remainingAssetSpend,
            uint256 remainingProtocolSpend,
            uint256 balance,
            uint256 reserve,
            bool operatorBudgetEnabled,
            uint32 operatorRemainingToday,
            uint256 operatorRemainingSpendBudget,
            uint256 operatorMaxPerAction,
            bool operatorAssetBudgetEnabled,
            uint256 operatorAssetRemainingBudget,
            uint256 operatorAssetMaxPerAction
        ) = _evaluateAction(
            nfaId,
            uint8(actionKind),
            policy,
            budget,
            protocolBudget,
            operatorBudget,
            operatorAssetBudget,
            assetId,
            spendAmount,
            adapter,
            protocolId,
            operator
        );

        descriptor = CapabilityDescriptor({
            policyEnabled: policy.enabled,
            emergencyPaused: policy.emergencyPaused,
            operatorApproved: operator == address(0) ? false : _approvedOperators[nfaId][uint8(actionKind)][operator],
            adapterApproved: adapter == address(0) ? false : _approvedAdapters[nfaId][uint8(actionKind)][adapter],
            protocolApproved: protocolId == bytes32(0) ? false : _approvedProtocols[nfaId][protocolId],
            assetBudgetEnabled: budget.enabled,
            protocolAssetBudgetEnabled: protocolBudget.enabled,
            operatorBudgetEnabled: operatorBudgetEnabled,
            operatorAssetBudgetEnabled: operatorAssetBudgetEnabled,
            dynamicReserveEnabled: budget.useDynamicReserve,
            protocolDynamicReserveEnabled: protocolBudget.useDynamicReserve,
            allowed: check == CheckCode.OK,
            checkCode: uint8(check),
            riskMode: policy.riskMode,
            operatorRoleMask: operator == address(0) ? 0 : _operatorRoleMasks[nfaId][uint8(actionKind)][operator],
            dailyLimit: policy.dailyLimit,
            actionsUsed: policy.actionsUsed,
            remainingToday: remainingActions,
            operatorRemainingToday: operatorRemainingToday,
            failureStreak: policy.failureStreak,
            actionSpendCap: policy.maxClwPerAction,
            assetMaxPerAction: budget.maxPerAction,
            protocolMaxPerAction: protocolBudget.maxPerAction,
            operatorMaxPerAction: operatorMaxPerAction,
            operatorAssetMaxPerAction: operatorAssetMaxPerAction,
            assetRemainingBudget: remainingAssetSpend,
            protocolRemainingBudget: remainingProtocolSpend,
            operatorRemainingSpendBudget: operatorRemainingSpendBudget,
            operatorAssetRemainingBudget: operatorAssetRemainingBudget,
            currentBalance: balance,
            effectiveReserve: reserve
        });
    }

    function recordActionFailure(
        uint256 nfaId,
        ActionKind actionKind,
        address executor
    ) external {
        if (!executors[msg.sender]) revert NotAuthorizedExecutor();

        Policy storage policy = _policies[nfaId][uint8(actionKind)];
        _rollWindow(policy);

        policy.failureStreak += 1;
        policy.totalFailures += 1;
        policy.lastActionAt = uint64(block.timestamp);

        emit ActionFailureRecorded(
            nfaId,
            uint8(actionKind),
            executor,
            policy.failureStreak,
            policy.totalFailures
        );
    }

    function getRiskState(
        uint256 nfaId,
        ActionKind actionKind
    ) external view returns (
        bool emergencyPaused,
        uint32 maxFailureStreak,
        uint32 failureStreak,
        uint32 totalActions,
        uint32 totalFailures,
        uint64 lastActionAt,
        uint256 minClwReserve
    ) {
        Policy storage policy = _policies[nfaId][uint8(actionKind)];
        return (
            policy.emergencyPaused,
            policy.maxFailureStreak,
            policy.failureStreak,
            policy.totalActions,
            policy.totalFailures,
            policy.lastActionAt,
            policy.minClwReserve
        );
    }

    function isAdapterApproved(
        uint256 nfaId,
        ActionKind actionKind,
        address adapter
    ) external view returns (bool) {
        return _approvedAdapters[nfaId][uint8(actionKind)][adapter];
    }

    function isProtocolApproved(
        uint256 nfaId,
        bytes32 protocolId
    ) external view returns (bool) {
        return _approvedProtocols[nfaId][protocolId];
    }

    function isOperatorApproved(
        uint256 nfaId,
        ActionKind actionKind,
        address operator
    ) external view returns (bool) {
        return _approvedOperators[nfaId][uint8(actionKind)][operator];
    }

    function getOperatorRoleMask(
        uint256 nfaId,
        ActionKind actionKind,
        address operator
    ) external view returns (uint8) {
        return _operatorRoleMasks[nfaId][uint8(actionKind)][operator];
    }

    function hasOperatorRole(
        uint256 nfaId,
        ActionKind actionKind,
        address operator,
        uint8 roleMask
    ) external view returns (bool) {
        return (_operatorRoleMasks[nfaId][uint8(actionKind)][operator] & roleMask) == roleMask;
    }

    function _trackProtocol(uint256 nfaId, bytes32 protocolId) internal {
        if (!_trackedProtocolSeen[nfaId][protocolId]) {
            _trackedProtocolSeen[nfaId][protocolId] = true;
            _trackedProtocols[nfaId].push(protocolId);
        }
    }

    function _trackAsset(uint256 nfaId, bytes32 assetId) internal {
        if (!_trackedAssetSeen[nfaId][assetId]) {
            _trackedAssetSeen[nfaId][assetId] = true;
            _trackedAssets[nfaId].push(assetId);
        }
    }

    function _trackActionAdapter(uint256 nfaId, uint8 actionKind, address adapter) internal {
        if (!_trackedActionAdapterSeen[nfaId][actionKind][adapter]) {
            _trackedActionAdapterSeen[nfaId][actionKind][adapter] = true;
            _trackedActionAdapters[nfaId][actionKind].push(adapter);
        }
    }

    function _trackActionOperator(uint256 nfaId, uint8 actionKind, address operator) internal {
        if (!_trackedActionOperatorSeen[nfaId][actionKind][operator]) {
            _trackedActionOperatorSeen[nfaId][actionKind][operator] = true;
            _trackedActionOperators[nfaId][actionKind].push(operator);
        }
    }

    function _rollWindow(Policy storage policy) internal {
        if (
            policy.windowStart == 0 ||
            block.timestamp >= uint256(policy.windowStart) + 1 days
        ) {
            policy.windowStart = uint64(block.timestamp);
            policy.actionsUsed = 0;
        }
    }

    function _rollAssetWindow(AssetBudget storage budget) internal {
        if (
            budget.windowStart == 0 ||
            block.timestamp >= uint256(budget.windowStart) + 1 days
        ) {
            budget.windowStart = uint64(block.timestamp);
            budget.amountUsedToday = 0;
        }
    }

    function _rollProtocolAssetWindow(ProtocolAssetBudget storage budget) internal {
        if (
            budget.windowStart == 0 ||
            block.timestamp >= uint256(budget.windowStart) + 1 days
        ) {
            budget.windowStart = uint64(block.timestamp);
            budget.amountUsedToday = 0;
        }
    }

    function _rollOperatorWindow(OperatorBudget storage budget) internal {
        if (
            budget.windowStart == 0 ||
            block.timestamp >= uint256(budget.windowStart) + 1 days
        ) {
            budget.windowStart = uint64(block.timestamp);
            budget.actionsUsed = 0;
            budget.spendUsedToday = 0;
        }
    }

    function _rollOperatorAssetWindow(OperatorAssetBudget storage budget) internal {
        if (
            budget.windowStart == 0 ||
            block.timestamp >= uint256(budget.windowStart) + 1 days
        ) {
            budget.windowStart = uint64(block.timestamp);
            budget.amountUsedToday = 0;
        }
    }

    function _assertActionAllowed(
        uint256 nfaId,
        uint8 actionKind,
        Policy storage policy,
        AssetBudget storage budget,
        ProtocolAssetBudget storage protocolBudget,
        OperatorBudget storage operatorBudget,
        OperatorAssetBudget storage operatorAssetBudget,
        bytes32 assetId,
        uint256 spendAmount,
        address adapter,
        bytes32 protocolId,
        address operator
    ) internal view {
        (CheckCode check,,,,,,,,,,,,) = _evaluateAction(
            nfaId,
            actionKind,
            policy,
            budget,
            protocolBudget,
            operatorBudget,
            operatorAssetBudget,
            assetId,
            spendAmount,
            adapter,
            protocolId,
            operator
        );
        _revertForCheck(check);
    }

    function _evaluateAction(
        uint256 nfaId,
        uint8 actionKind,
        Policy storage policy,
        AssetBudget storage budget,
        ProtocolAssetBudget storage protocolBudget,
        OperatorBudget storage operatorBudget,
        OperatorAssetBudget storage operatorAssetBudget,
        bytes32 assetId,
        uint256 spendAmount,
        address adapter,
        bytes32 protocolId,
        address operator
    ) internal view returns (
        CheckCode check,
        uint32 remainingToday,
        uint256 remainingAssetBudget,
        uint256 remainingProtocolBudget,
        uint256 currentBalance,
        uint256 effectiveReserve,
        bool operatorBudgetEnabled,
        uint32 operatorRemainingToday,
        uint256 operatorRemainingSpendBudget,
        uint256 operatorMaxPerAction,
        bool operatorAssetBudgetEnabled,
        uint256 operatorAssetRemainingBudget,
        uint256 operatorAssetMaxPerAction
    ) {
        check = CheckCode.OK;
        uint32 effectiveActionsUsed = policy.actionsUsed;
        if (
            policy.windowStart == 0 ||
            block.timestamp >= uint256(policy.windowStart) + 1 days
        ) {
            effectiveActionsUsed = 0;
        }
        remainingToday = policy.dailyLimit == 0
            ? type(uint32).max
            : (effectiveActionsUsed >= policy.dailyLimit ? 0 : policy.dailyLimit - effectiveActionsUsed);
        remainingAssetBudget = type(uint256).max;
        remainingProtocolBudget = type(uint256).max;
        operatorBudgetEnabled = false;
        operatorRemainingToday = type(uint32).max;
        operatorRemainingSpendBudget = type(uint256).max;
        operatorMaxPerAction = operatorBudget.maxPerAction;
        operatorAssetBudgetEnabled = false;
        operatorAssetRemainingBudget = type(uint256).max;
        operatorAssetMaxPerAction = operatorAssetBudget.maxPerAction;

        if (!policy.enabled) {
            check = CheckCode.POLICY_DISABLED;
            return _packEvaluationResult(
                check,
                remainingToday,
                remainingAssetBudget,
                remainingProtocolBudget,
                currentBalance,
                effectiveReserve,
                operatorBudgetEnabled,
                operatorRemainingToday,
                operatorRemainingSpendBudget,
                operatorMaxPerAction,
                operatorAssetBudgetEnabled,
                operatorAssetRemainingBudget,
                operatorAssetMaxPerAction
            );
        }
        if (policy.emergencyPaused) {
            check = CheckCode.EMERGENCY_PAUSED;
            return _packEvaluationResult(
                check,
                remainingToday,
                remainingAssetBudget,
                remainingProtocolBudget,
                currentBalance,
                effectiveReserve,
                operatorBudgetEnabled,
                operatorRemainingToday,
                operatorRemainingSpendBudget,
                operatorMaxPerAction,
                operatorAssetBudgetEnabled,
                operatorAssetRemainingBudget,
                operatorAssetMaxPerAction
            );
        }
        if (operator != address(0) && !_approvedOperators[nfaId][actionKind][operator]) {
            check = CheckCode.OPERATOR_NOT_APPROVED;
            return _packEvaluationResult(
                check,
                remainingToday,
                remainingAssetBudget,
                remainingProtocolBudget,
                currentBalance,
                effectiveReserve,
                operatorBudgetEnabled,
                operatorRemainingToday,
                operatorRemainingSpendBudget,
                operatorMaxPerAction,
                operatorAssetBudgetEnabled,
                operatorAssetRemainingBudget,
                operatorAssetMaxPerAction
            );
        }
        if (adapter != address(0) && !_approvedAdapters[nfaId][actionKind][adapter]) {
            check = CheckCode.ADAPTER_NOT_APPROVED;
            return _packEvaluationResult(
                check,
                remainingToday,
                remainingAssetBudget,
                remainingProtocolBudget,
                currentBalance,
                effectiveReserve,
                operatorBudgetEnabled,
                operatorRemainingToday,
                operatorRemainingSpendBudget,
                operatorMaxPerAction,
                operatorAssetBudgetEnabled,
                operatorAssetRemainingBudget,
                operatorAssetMaxPerAction
            );
        }
        if (protocolId != bytes32(0) && !_approvedProtocols[nfaId][protocolId]) {
            check = CheckCode.PROTOCOL_NOT_APPROVED;
            return _packEvaluationResult(
                check,
                remainingToday,
                remainingAssetBudget,
                remainingProtocolBudget,
                currentBalance,
                effectiveReserve,
                operatorBudgetEnabled,
                operatorRemainingToday,
                operatorRemainingSpendBudget,
                operatorMaxPerAction,
                operatorAssetBudgetEnabled,
                operatorAssetRemainingBudget,
                operatorAssetMaxPerAction
            );
        }
        if (policy.maxClwPerAction > 0 && spendAmount > policy.maxClwPerAction) {
            check = CheckCode.SPEND_CAP_EXCEEDED;
            return _packEvaluationResult(
                check,
                remainingToday,
                remainingAssetBudget,
                remainingProtocolBudget,
                currentBalance,
                effectiveReserve,
                operatorBudgetEnabled,
                operatorRemainingToday,
                operatorRemainingSpendBudget,
                operatorMaxPerAction,
                operatorAssetBudgetEnabled,
                operatorAssetRemainingBudget,
                operatorAssetMaxPerAction
            );
        }
        if (policy.dailyLimit > 0 && effectiveActionsUsed >= policy.dailyLimit) {
            check = CheckCode.DAILY_LIMIT_REACHED;
            return _packEvaluationResult(
                check,
                remainingToday,
                remainingAssetBudget,
                remainingProtocolBudget,
                currentBalance,
                effectiveReserve,
                operatorBudgetEnabled,
                operatorRemainingToday,
                operatorRemainingSpendBudget,
                operatorMaxPerAction,
                operatorAssetBudgetEnabled,
                operatorAssetRemainingBudget,
                operatorAssetMaxPerAction
            );
        }
        if (policy.maxFailureStreak > 0 && policy.failureStreak >= policy.maxFailureStreak) {
            check = CheckCode.FAILURE_BREAKER_TRIPPED;
            return _packEvaluationResult(
                check,
                remainingToday,
                remainingAssetBudget,
                remainingProtocolBudget,
                currentBalance,
                effectiveReserve,
                operatorBudgetEnabled,
                operatorRemainingToday,
                operatorRemainingSpendBudget,
                operatorMaxPerAction,
                operatorAssetBudgetEnabled,
                operatorAssetRemainingBudget,
                operatorAssetMaxPerAction
            );
        }

        operatorBudgetEnabled = operator != address(0) && operatorBudget.enabled;
        if (operatorBudgetEnabled) {
            uint32 effectiveOperatorActionsUsed = operatorBudget.actionsUsed;
            uint256 effectiveOperatorSpendUsedToday = operatorBudget.spendUsedToday;
            if (
                operatorBudget.windowStart == 0 ||
                block.timestamp >= uint256(operatorBudget.windowStart) + 1 days
            ) {
                effectiveOperatorActionsUsed = 0;
                effectiveOperatorSpendUsedToday = 0;
            }

            operatorRemainingToday = operatorBudget.dailyActionLimit == 0
                ? type(uint32).max
                : (
                    effectiveOperatorActionsUsed >= operatorBudget.dailyActionLimit
                        ? 0
                        : operatorBudget.dailyActionLimit - effectiveOperatorActionsUsed
                );
            operatorRemainingSpendBudget = operatorBudget.dailySpendLimit == 0
                ? type(uint256).max
                : (
                    effectiveOperatorSpendUsedToday >= operatorBudget.dailySpendLimit
                        ? 0
                        : operatorBudget.dailySpendLimit - effectiveOperatorSpendUsedToday
                );

            if (operatorBudget.maxPerAction > 0 && spendAmount > operatorBudget.maxPerAction) {
                check = CheckCode.SPEND_CAP_EXCEEDED;
                return _packEvaluationResult(
                    check,
                    remainingToday,
                    remainingAssetBudget,
                    remainingProtocolBudget,
                    currentBalance,
                    effectiveReserve,
                    operatorBudgetEnabled,
                    operatorRemainingToday,
                    operatorRemainingSpendBudget,
                    operatorMaxPerAction,
                    operatorAssetBudgetEnabled,
                    operatorAssetRemainingBudget,
                    operatorAssetMaxPerAction
                );
            }
            if (operatorBudget.dailyActionLimit > 0 && effectiveOperatorActionsUsed >= operatorBudget.dailyActionLimit) {
                check = CheckCode.DAILY_LIMIT_REACHED;
                return _packEvaluationResult(
                    check,
                    remainingToday,
                    remainingAssetBudget,
                    remainingProtocolBudget,
                    currentBalance,
                    effectiveReserve,
                    operatorBudgetEnabled,
                    operatorRemainingToday,
                    operatorRemainingSpendBudget,
                    operatorMaxPerAction,
                    operatorAssetBudgetEnabled,
                    operatorAssetRemainingBudget,
                    operatorAssetMaxPerAction
                );
            }
            if (
                operatorBudget.dailySpendLimit > 0 &&
                effectiveOperatorSpendUsedToday + spendAmount > operatorBudget.dailySpendLimit
            ) {
                check = CheckCode.DAILY_ASSET_LIMIT_REACHED;
                return _packEvaluationResult(
                    check,
                    remainingToday,
                    remainingAssetBudget,
                    remainingProtocolBudget,
                    currentBalance,
                    effectiveReserve,
                    operatorBudgetEnabled,
                    operatorRemainingToday,
                    operatorRemainingSpendBudget,
                    operatorMaxPerAction,
                    operatorAssetBudgetEnabled,
                    operatorAssetRemainingBudget,
                    operatorAssetMaxPerAction
                );
            }
        }

        operatorAssetBudgetEnabled = operator != address(0) && assetId != bytes32(0) && operatorAssetBudget.enabled;
        if (operatorAssetBudgetEnabled) {
            uint256 effectiveOperatorAssetUsedToday = operatorAssetBudget.amountUsedToday;
            if (
                operatorAssetBudget.windowStart == 0 ||
                block.timestamp >= uint256(operatorAssetBudget.windowStart) + 1 days
            ) {
                effectiveOperatorAssetUsedToday = 0;
            }

            operatorAssetRemainingBudget = operatorAssetBudget.dailyAmountLimit == 0
                ? type(uint256).max
                : (
                    effectiveOperatorAssetUsedToday >= operatorAssetBudget.dailyAmountLimit
                        ? 0
                        : operatorAssetBudget.dailyAmountLimit - effectiveOperatorAssetUsedToday
                );

            if (operatorAssetBudget.maxPerAction > 0 && spendAmount > operatorAssetBudget.maxPerAction) {
                check = CheckCode.SPEND_CAP_EXCEEDED;
                return _packEvaluationResult(
                    check,
                    remainingToday,
                    remainingAssetBudget,
                    remainingProtocolBudget,
                    currentBalance,
                    effectiveReserve,
                    operatorBudgetEnabled,
                    operatorRemainingToday,
                    operatorRemainingSpendBudget,
                    operatorMaxPerAction,
                    operatorAssetBudgetEnabled,
                    operatorAssetRemainingBudget,
                    operatorAssetMaxPerAction
                );
            }
            if (
                operatorAssetBudget.dailyAmountLimit > 0 &&
                effectiveOperatorAssetUsedToday + spendAmount > operatorAssetBudget.dailyAmountLimit
            ) {
                check = CheckCode.DAILY_ASSET_LIMIT_REACHED;
                return _packEvaluationResult(
                    check,
                    remainingToday,
                    remainingAssetBudget,
                    remainingProtocolBudget,
                    currentBalance,
                    effectiveReserve,
                    operatorBudgetEnabled,
                    operatorRemainingToday,
                    operatorRemainingSpendBudget,
                    operatorMaxPerAction,
                    operatorAssetBudgetEnabled,
                    operatorAssetRemainingBudget,
                    operatorAssetMaxPerAction
                );
            }
        }

        if (assetId == bytes32(0)) {
            if (spendAmount != 0) {
                remainingAssetBudget = 0;
                check = CheckCode.MISSING_SPEND_ASSET;
                return _packEvaluationResult(
                    check,
                    remainingToday,
                    remainingAssetBudget,
                    remainingProtocolBudget,
                    currentBalance,
                    effectiveReserve,
                    operatorBudgetEnabled,
                    operatorRemainingToday,
                    operatorRemainingSpendBudget,
                    operatorMaxPerAction,
                    operatorAssetBudgetEnabled,
                    operatorAssetRemainingBudget,
                    operatorAssetMaxPerAction
                );
            }
            return _packEvaluationResult(
                check,
                remainingToday,
                remainingAssetBudget,
                remainingProtocolBudget,
                currentBalance,
                effectiveReserve,
                operatorBudgetEnabled,
                operatorRemainingToday,
                operatorRemainingSpendBudget,
                operatorMaxPerAction,
                operatorAssetBudgetEnabled,
                operatorAssetRemainingBudget,
                operatorAssetMaxPerAction
            );
        }

        bool hasAssetConstraint = false;
        if (budget.enabled) {
            hasAssetConstraint = true;
            if (budget.maxPerAction > 0 && spendAmount > budget.maxPerAction) {
                remainingAssetBudget = 0;
                check = CheckCode.SPEND_CAP_EXCEEDED;
                return _packEvaluationResult(
                    check,
                    remainingToday,
                    remainingAssetBudget,
                    remainingProtocolBudget,
                    currentBalance,
                    effectiveReserve,
                    operatorBudgetEnabled,
                    operatorRemainingToday,
                    operatorRemainingSpendBudget,
                    operatorMaxPerAction,
                    operatorAssetBudgetEnabled,
                    operatorAssetRemainingBudget,
                    operatorAssetMaxPerAction
                );
            }

            uint256 effectiveUsedToday = budget.amountUsedToday;
            if (
                budget.windowStart == 0 ||
                block.timestamp >= uint256(budget.windowStart) + 1 days
            ) {
                effectiveUsedToday = 0;
            }

            remainingAssetBudget = budget.dailyAmountLimit == 0
                ? type(uint256).max
                : (effectiveUsedToday >= budget.dailyAmountLimit ? 0 : budget.dailyAmountLimit - effectiveUsedToday);

            if (
                budget.dailyAmountLimit > 0 &&
                effectiveUsedToday + spendAmount > budget.dailyAmountLimit
            ) {
                check = CheckCode.DAILY_ASSET_LIMIT_REACHED;
                return _packEvaluationResult(
                    check,
                    remainingToday,
                    remainingAssetBudget,
                    remainingProtocolBudget,
                    currentBalance,
                    effectiveReserve,
                    operatorBudgetEnabled,
                    operatorRemainingToday,
                    operatorRemainingSpendBudget,
                    operatorMaxPerAction,
                    operatorAssetBudgetEnabled,
                    operatorAssetRemainingBudget,
                    operatorAssetMaxPerAction
                );
            }

            uint256 assetReserve = budget.minReserve;
            if (budget.useDynamicReserve) {
                IAutonomyReserveSource reserveSource = assetReserveSources[assetId];
                if (address(reserveSource) == address(0)) {
                    effectiveReserve = assetReserve;
                    check = CheckCode.RESERVE_SOURCE_NOT_SET;
                    return _packEvaluationResult(
                        check,
                        remainingToday,
                        remainingAssetBudget,
                        remainingProtocolBudget,
                        currentBalance,
                        effectiveReserve,
                        operatorBudgetEnabled,
                        operatorRemainingToday,
                        operatorRemainingSpendBudget,
                        operatorMaxPerAction,
                        operatorAssetBudgetEnabled,
                        operatorAssetRemainingBudget,
                        operatorAssetMaxPerAction
                    );
                }

                uint256 dynamicReserve = reserveSource.autonomyRequiredReserveOf(
                    nfaId,
                    actionKind,
                    assetId
                );
                if (dynamicReserve > 0) {
                    uint256 bufferedDynamicReserve = dynamicReserve +
                        ((dynamicReserve * budget.dynamicReserveBufferBps) / 10_000);
                    if (bufferedDynamicReserve > assetReserve) {
                        assetReserve = bufferedDynamicReserve;
                    }
                }
            }
            effectiveReserve = assetReserve;
        } else if (assetId == ASSET_CLAWORLD) {
            hasAssetConstraint = true;
            effectiveReserve = policy.minClwReserve;
        }

        if (protocolId != bytes32(0) && protocolBudget.enabled) {
            hasAssetConstraint = true;
            if (protocolBudget.maxPerAction > 0 && spendAmount > protocolBudget.maxPerAction) {
                remainingProtocolBudget = 0;
                check = CheckCode.SPEND_CAP_EXCEEDED;
                return _packEvaluationResult(
                    check,
                    remainingToday,
                    remainingAssetBudget,
                    remainingProtocolBudget,
                    currentBalance,
                    effectiveReserve,
                    operatorBudgetEnabled,
                    operatorRemainingToday,
                    operatorRemainingSpendBudget,
                    operatorMaxPerAction,
                    operatorAssetBudgetEnabled,
                    operatorAssetRemainingBudget,
                    operatorAssetMaxPerAction
                );
            }

            uint256 effectiveProtocolUsedToday = protocolBudget.amountUsedToday;
            if (
                protocolBudget.windowStart == 0 ||
                block.timestamp >= uint256(protocolBudget.windowStart) + 1 days
            ) {
                effectiveProtocolUsedToday = 0;
            }

            remainingProtocolBudget = protocolBudget.dailyAmountLimit == 0
                ? type(uint256).max
                : (
                    effectiveProtocolUsedToday >= protocolBudget.dailyAmountLimit
                        ? 0
                        : protocolBudget.dailyAmountLimit - effectiveProtocolUsedToday
                );

            if (
                protocolBudget.dailyAmountLimit > 0 &&
                effectiveProtocolUsedToday + spendAmount > protocolBudget.dailyAmountLimit
            ) {
                check = CheckCode.DAILY_ASSET_LIMIT_REACHED;
                return _packEvaluationResult(
                    check,
                    remainingToday,
                    remainingAssetBudget,
                    remainingProtocolBudget,
                    currentBalance,
                    effectiveReserve,
                    operatorBudgetEnabled,
                    operatorRemainingToday,
                    operatorRemainingSpendBudget,
                    operatorMaxPerAction,
                    operatorAssetBudgetEnabled,
                    operatorAssetRemainingBudget,
                    operatorAssetMaxPerAction
                );
            }

            uint256 protocolReserve = protocolBudget.minReserve;
            if (protocolBudget.useDynamicReserve) {
                IAutonomyReserveSource reserveSource = assetReserveSources[assetId];
                if (address(reserveSource) == address(0)) {
                    effectiveReserve = protocolReserve;
                    check = CheckCode.RESERVE_SOURCE_NOT_SET;
                    return _packEvaluationResult(
                        check,
                        remainingToday,
                        remainingAssetBudget,
                        remainingProtocolBudget,
                        currentBalance,
                        effectiveReserve,
                        operatorBudgetEnabled,
                        operatorRemainingToday,
                        operatorRemainingSpendBudget,
                        operatorMaxPerAction,
                        operatorAssetBudgetEnabled,
                        operatorAssetRemainingBudget,
                        operatorAssetMaxPerAction
                    );
                }

                uint256 dynamicReserve = reserveSource.autonomyRequiredReserveOf(
                    nfaId,
                    actionKind,
                    assetId
                );
                if (dynamicReserve > 0) {
                    uint256 bufferedDynamicReserve = dynamicReserve +
                        ((dynamicReserve * protocolBudget.dynamicReserveBufferBps) / 10_000);
                    if (bufferedDynamicReserve > protocolReserve) {
                        protocolReserve = bufferedDynamicReserve;
                    }
                }
            }
            if (protocolReserve > effectiveReserve) {
                effectiveReserve = protocolReserve;
            }
        }

        if (!hasAssetConstraint) {
            remainingAssetBudget = 0;
            check = CheckCode.ASSET_BUDGET_NOT_CONFIGURED;
            return _packEvaluationResult(
                check,
                remainingToday,
                remainingAssetBudget,
                remainingProtocolBudget,
                currentBalance,
                effectiveReserve,
                operatorBudgetEnabled,
                operatorRemainingToday,
                operatorRemainingSpendBudget,
                operatorMaxPerAction,
                operatorAssetBudgetEnabled,
                operatorAssetRemainingBudget,
                operatorAssetMaxPerAction
            );
        }

        if (effectiveReserve > 0) {
            IAutonomyBalanceSource source = assetBalanceSources[assetId];
            if (address(source) == address(0)) {
                check = CheckCode.ASSET_SOURCE_NOT_SET;
                return _packEvaluationResult(
                    check,
                    remainingToday,
                    remainingAssetBudget,
                    remainingProtocolBudget,
                    currentBalance,
                    effectiveReserve,
                    operatorBudgetEnabled,
                    operatorRemainingToday,
                    operatorRemainingSpendBudget,
                    operatorMaxPerAction,
                    operatorAssetBudgetEnabled,
                    operatorAssetRemainingBudget,
                    operatorAssetMaxPerAction
                );
            }
            currentBalance = source.autonomyBalanceOf(nfaId);
            if (currentBalance < spendAmount + effectiveReserve) {
                check = CheckCode.RESERVE_FLOOR_BREACHED;
                return _packEvaluationResult(
                    check,
                    remainingToday,
                    remainingAssetBudget,
                    remainingProtocolBudget,
                    currentBalance,
                    effectiveReserve,
                    operatorBudgetEnabled,
                    operatorRemainingToday,
                    operatorRemainingSpendBudget,
                    operatorMaxPerAction,
                    operatorAssetBudgetEnabled,
                    operatorAssetRemainingBudget,
                    operatorAssetMaxPerAction
                );
            }
        }

        return _packEvaluationResult(
            check,
            remainingToday,
            remainingAssetBudget,
            remainingProtocolBudget,
            currentBalance,
            effectiveReserve,
            operatorBudgetEnabled,
            operatorRemainingToday,
            operatorRemainingSpendBudget,
            operatorMaxPerAction,
            operatorAssetBudgetEnabled,
            operatorAssetRemainingBudget,
            operatorAssetMaxPerAction
        );
    }

    function _packEvaluationResult(
        CheckCode check,
        uint32 remainingToday,
        uint256 remainingAssetBudget,
        uint256 remainingProtocolBudget,
        uint256 currentBalance,
        uint256 effectiveReserve,
        bool operatorBudgetEnabled,
        uint32 operatorRemainingToday,
        uint256 operatorRemainingSpendBudget,
        uint256 operatorMaxPerAction,
        bool operatorAssetBudgetEnabled,
        uint256 operatorAssetRemainingBudget,
        uint256 operatorAssetMaxPerAction
    ) internal pure returns (
        CheckCode,
        uint32,
        uint256,
        uint256,
        uint256,
        uint256,
        bool,
        uint32,
        uint256,
        uint256,
        bool,
        uint256,
        uint256
    ) {
        return (
            check,
            remainingToday,
            remainingAssetBudget,
            remainingProtocolBudget,
            currentBalance,
            effectiveReserve,
            operatorBudgetEnabled,
            operatorRemainingToday,
            operatorRemainingSpendBudget,
            operatorMaxPerAction,
            operatorAssetBudgetEnabled,
            operatorAssetRemainingBudget,
            operatorAssetMaxPerAction
        );
    }

    function _requireNfaOwner(uint256 nfaId) internal view {
        if (nfa.ownerOf(nfaId) != msg.sender) revert NotNfaOwner();
    }

    function _requireAsset(bytes32 assetId) internal pure {
        if (assetId == bytes32(0)) revert InvalidAsset();
    }

    function _requireProtocol(bytes32 protocolId) internal pure {
        if (protocolId == bytes32(0)) revert InvalidProtocol();
    }

    function _requireOperator(address operator) internal pure {
        if (operator == address(0)) revert InvalidOperator();
    }

    function _requireAdapter(address adapter) internal pure {
        if (adapter == address(0)) revert InvalidAdapter();
    }

    function _revertForCheck(CheckCode check) internal pure {
        if (check == CheckCode.OK) {
            return;
        }
        if (check == CheckCode.POLICY_DISABLED) revert PolicyDisabled();
        if (check == CheckCode.EMERGENCY_PAUSED) revert EmergencyPaused();
        if (check == CheckCode.ADAPTER_NOT_APPROVED) revert AdapterNotApproved();
        if (check == CheckCode.PROTOCOL_NOT_APPROVED) revert ProtocolNotApproved();
        if (check == CheckCode.OPERATOR_NOT_APPROVED) revert OperatorNotApproved();
        if (check == CheckCode.SPEND_CAP_EXCEEDED) revert SpendCapExceeded();
        if (check == CheckCode.DAILY_LIMIT_REACHED) revert DailyLimitReached();
        if (check == CheckCode.FAILURE_BREAKER_TRIPPED) revert FailureBreakerTripped();
        if (check == CheckCode.MISSING_SPEND_ASSET) revert MissingSpendAsset();
        if (check == CheckCode.ASSET_BUDGET_NOT_CONFIGURED) revert AssetBudgetNotConfigured();
        if (check == CheckCode.DAILY_ASSET_LIMIT_REACHED) revert DailyAssetLimitReached();
        if (check == CheckCode.ASSET_SOURCE_NOT_SET) revert AssetSourceNotSet();
        if (check == CheckCode.RESERVE_SOURCE_NOT_SET) revert ReserveSourceNotSet();
        if (check == CheckCode.RESERVE_FLOOR_BREACHED) revert ReserveFloorBreached();
        revert UnknownCheckFailure();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    uint256[25] private __gap;
}
