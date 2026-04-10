// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IClawRouter.sol";

interface IBattleRoyaleNFA {
    function balanceOf(address owner) external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
}

contract BattleRoyale is
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    uint8 public constant MAX_ROOMS = 10;
    uint256 public constant BLOCKHASH_SAFE = 256;
    uint8 public constant MAX_TRIGGER_COUNT = 50;
    uint256 public constant MAX_TREASURY_BPS = 2000;
    uint256 public constant MAX_REVEAL_DELAY = 50;
    uint256 public constant DEFAULT_MIN_STAKE = 100 ether;
    uint8 public constant DEFAULT_TRIGGER_COUNT = 10;
    uint256 public constant DEFAULT_TREASURY_BPS = 1000;
    uint8 public constant DEFAULT_REVEAL_DELAY = 5;
    uint8 public constant MAX_ROOM_CHANGES_PER_MATCH = 1;
    uint256 public constant MAX_SPEED_BONUS_BPS = 10000;
    uint256 public constant BASE_BPS = 10000;

    enum MatchStatus { OPEN, PENDING_REVEAL, SETTLED }

    struct BRMatch {
        MatchStatus status;
        uint8 totalPlayers;
        uint256 revealBlock;
        uint8 losingRoom;
        uint256 roundId;
    }

    struct MatchConfig {
        uint256 minStake;
        uint256 treasuryBps;
        uint8 triggerCount;
        uint8 revealDelay;
        bool initialized;
    }

    struct MatchSettlement {
        uint256 loserTotal;
        uint256 survivorBaseTotal;
        uint256 treasuryFee;
        uint256 survivorPrize;
        uint256 totalSurvivorWeight;
        bool fallbackEntropyUsed;
    }

    IERC20 public clwToken;
    address public treasury;

    uint256 public matchCount;
    uint256 public roundIdCounter;

    mapping(uint256 => BRMatch) public matches;
    mapping(uint256 => mapping(uint8 => address[])) public roomPlayers;
    mapping(uint256 => mapping(uint8 => uint256)) public roomTotal;
    mapping(uint256 => mapping(address => uint8)) public playerRoom;
    mapping(uint256 => mapping(address => uint256)) public playerStake;
    mapping(uint256 => mapping(uint8 => bool)) public roomOccupied;
    mapping(uint256 => uint256) public matchTotal;

    uint256 public minStake;
    uint256 public treasuryBps;
    uint256 public speedBonusBps;
    address public router;
    address public nfa;
    uint8 public triggerCount;
    uint8 public revealDelay;

    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(uint256 => mapping(address => uint8)) public roomChangeCount;
    mapping(uint256 => MatchConfig) public matchConfigs;
    mapping(uint256 => MatchSettlement) public matchSettlements;
    mapping(uint256 => mapping(address => uint256)) public survivorWeight;
    mapping(uint256 => mapping(address => uint256)) public playerNfa;
    mapping(address => bool) public autonomousResolvers;
    mapping(uint256 => mapping(address => uint256)) public autonomousPlayerNfa;

    event MatchOpened(
        uint256 indexed matchId,
        uint256 roundId,
        uint256 minStake,
        uint8 triggerCount,
        uint256 treasuryBps,
        uint8 revealDelay
    );
    event PlayerEntered(
        uint256 indexed matchId,
        address indexed player,
        uint8 roomId,
        uint256 stake
    );
    event PlayerAddedStake(
        uint256 indexed matchId,
        address indexed player,
        uint8 roomId,
        uint256 addedAmount,
        uint256 newTotalStake
    );
    event RoundTriggered(uint256 indexed matchId, uint256 revealBlock);
    event RoundSettled(
        uint256 indexed matchId,
        uint8 losingRoom,
        uint256 loserTotal,
        uint256 treasuryAmount,
        uint256 survivorPrize,
        bool fallbackEntropyUsed
    );
    event PlayerClaimed(
        uint256 indexed matchId,
        address indexed player,
        uint256 stakeReturned,
        uint256 prize,
        uint256 totalAmount
    );
    event LoserEliminated(
        uint256 indexed matchId,
        address indexed player,
        uint256 stakeForfeited
    );
    event PlayerChangedRoom(
        uint256 indexed matchId,
        address indexed player,
        uint8 fromRoom,
        uint8 toRoom,
        uint256 stake
    );
    event MinStakeUpdated(uint256 oldValue, uint256 newValue);
    event TriggerCountUpdated(uint8 oldValue, uint8 newValue);
    event TreasuryBpsUpdated(uint256 oldValue, uint256 newValue);
    event RevealDelayUpdated(uint8 oldValue, uint8 newValue);
    event RouterUpdated(address oldValue, address newValue);
    event NfaUpdated(address oldValue, address newValue);
    event SpeedBonusBpsUpdated(uint256 oldValue, uint256 newValue);
    event PlayerNfaSelected(uint256 indexed matchId, address indexed player, uint256 indexed nfaId);
    event AutonomousResolverUpdated(address indexed resolver, bool authorized);
    event AutonomousPlayerEntered(
        uint256 indexed matchId,
        address indexed participant,
        uint256 indexed nfaId,
        uint8 roomId,
        uint256 stake
    );
    event AutonomousClaimed(
        uint256 indexed matchId,
        address indexed participant,
        uint256 indexed nfaId,
        uint256 amount
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _clwToken, address _treasury) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(_clwToken != address(0), "Zero token");
        require(_treasury != address(0), "Zero treasury");

        clwToken = IERC20(_clwToken);
        treasury = _treasury;
        minStake = DEFAULT_MIN_STAKE;
        triggerCount = DEFAULT_TRIGGER_COUNT;
        treasuryBps = DEFAULT_TREASURY_BPS;
        revealDelay = DEFAULT_REVEAL_DELAY;

        _openMatch();
    }

    function initializeV2(
        address _router,
        address _nfa,
        uint256 _speedBonusBps
    ) external reinitializer(2) {
        if (minStake == 0) minStake = DEFAULT_MIN_STAKE;
        if (triggerCount == 0) triggerCount = DEFAULT_TRIGGER_COUNT;
        if (treasuryBps == 0) treasuryBps = DEFAULT_TREASURY_BPS;
        if (revealDelay == 0) revealDelay = DEFAULT_REVEAL_DELAY;

        router = _router;
        nfa = _nfa;
        require(_speedBonusBps <= MAX_SPEED_BONUS_BPS, "Speed bonus too high");
        speedBonusBps = _speedBonusBps;
    }

    function enterRoom(
        uint256 matchId,
        uint8 roomId,
        uint256 amount
    ) external nonReentrant {
        require(roomId >= 1 && roomId <= MAX_ROOMS, "Invalid room: 1-10");

        BRMatch storage m = matches[matchId];
        require(m.status == MatchStatus.OPEN, "Match not open");
        require(playerRoom[matchId][msg.sender] == 0, "Already entered this match");
        require(amount >= _minStakeForMatch(matchId), "Stake below match minimum");

        clwToken.safeTransferFrom(msg.sender, address(this), amount);

        roomPlayers[matchId][roomId].push(msg.sender);
        roomTotal[matchId][roomId] += amount;
        playerRoom[matchId][msg.sender] = roomId;
        playerStake[matchId][msg.sender] = amount;
        matchTotal[matchId] += amount;
        roomOccupied[matchId][roomId] = true;

        m.totalPlayers++;
        emit PlayerEntered(matchId, msg.sender, roomId, amount);

        if (m.totalPlayers == _triggerCountForMatch(matchId)) {
            m.revealBlock = block.number + _revealDelayForMatch(matchId);
            m.status = MatchStatus.PENDING_REVEAL;
            emit RoundTriggered(matchId, m.revealBlock);
        }
    }

    function addStake(uint256 matchId, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be positive");

        BRMatch storage m = matches[matchId];
        require(m.status == MatchStatus.OPEN, "Match locked: cannot add stake");

        uint8 currentRoom = playerRoom[matchId][msg.sender];
        require(currentRoom != 0, "Not in this match");

        clwToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 newTotalStake = playerStake[matchId][msg.sender] + amount;
        playerStake[matchId][msg.sender] = newTotalStake;
        roomTotal[matchId][currentRoom] += amount;
        matchTotal[matchId] += amount;

        emit PlayerAddedStake(matchId, msg.sender, currentRoom, amount, newTotalStake);
    }

    function changeRoom(uint256 matchId, uint8 newRoomId) external nonReentrant {
        require(newRoomId >= 1 && newRoomId <= MAX_ROOMS, "Invalid room: 1-10");

        BRMatch storage m = matches[matchId];
        require(m.status == MatchStatus.OPEN, "Match locked: cannot change room");

        uint8 currentRoom = playerRoom[matchId][msg.sender];
        require(currentRoom != 0, "Not in this match");
        require(currentRoom != newRoomId, "Already in this room");
        require(
            roomChangeCount[matchId][msg.sender] < MAX_ROOM_CHANGES_PER_MATCH,
            "Room change limit reached"
        );

        uint256 currentStake = playerStake[matchId][msg.sender];
        address[] storage oldPlayers = roomPlayers[matchId][currentRoom];
        for (uint256 i = 0; i < oldPlayers.length; i++) {
            if (oldPlayers[i] == msg.sender) {
                oldPlayers[i] = oldPlayers[oldPlayers.length - 1];
                oldPlayers.pop();
                break;
            }
        }

        roomTotal[matchId][currentRoom] -= currentStake;
        if (oldPlayers.length == 0) {
            roomOccupied[matchId][currentRoom] = false;
        }

        roomPlayers[matchId][newRoomId].push(msg.sender);
        roomTotal[matchId][newRoomId] += currentStake;
        playerRoom[matchId][msg.sender] = newRoomId;
        roomOccupied[matchId][newRoomId] = true;
        roomChangeCount[matchId][msg.sender] += 1;

        emit PlayerChangedRoom(matchId, msg.sender, currentRoom, newRoomId, currentStake);
    }

    function selectPlayerNfa(uint256 matchId, uint256 nfaId) external {
        BRMatch storage m = matches[matchId];
        require(m.status == MatchStatus.OPEN, "Match locked: cannot select NFA");
        require(playerRoom[matchId][msg.sender] != 0, "Not in this match");
        require(nfa != address(0), "NFA not set");
        require(IBattleRoyaleNFA(nfa).ownerOf(nfaId) == msg.sender, "Not NFA owner");

        playerNfa[matchId][msg.sender] = nfaId;
        emit PlayerNfaSelected(matchId, msg.sender, nfaId);
    }

    function setAutonomousResolver(address resolver, bool authorized) external onlyOwner {
        autonomousResolvers[resolver] = authorized;
        emit AutonomousResolverUpdated(resolver, authorized);
    }

    function autonomousEnterRoomFor(
        uint256 matchId,
        address participant,
        uint256 nfaId,
        uint8 roomId,
        uint256 amount
    ) external nonReentrant {
        require(autonomousResolvers[msg.sender], "Not autonomous resolver");
        require(participant != address(0), "Invalid participant");
        require(roomId >= 1 && roomId <= MAX_ROOMS, "Invalid room: 1-10");

        BRMatch storage m = matches[matchId];
        require(m.status == MatchStatus.OPEN, "Match not open");
        require(playerRoom[matchId][participant] == 0, "Already entered this match");
        require(amount >= _minStakeForMatch(matchId), "Stake below match minimum");
        require(router != address(0), "Router not set");
        require(nfa != address(0), "NFA not set");

        IClawRouter(router).spendCLW(nfaId, amount);

        roomPlayers[matchId][roomId].push(participant);
        roomTotal[matchId][roomId] += amount;
        playerRoom[matchId][participant] = roomId;
        playerStake[matchId][participant] = amount;
        matchTotal[matchId] += amount;
        roomOccupied[matchId][roomId] = true;
        autonomousPlayerNfa[matchId][participant] = nfaId;
        playerNfa[matchId][participant] = nfaId;

        m.totalPlayers++;
        emit PlayerEntered(matchId, participant, roomId, amount);
        emit PlayerNfaSelected(matchId, participant, nfaId);
        emit AutonomousPlayerEntered(matchId, participant, nfaId, roomId, amount);

        if (m.totalPlayers == _triggerCountForMatch(matchId)) {
            m.revealBlock = block.number + _revealDelayForMatch(matchId);
            m.status = MatchStatus.PENDING_REVEAL;
            emit RoundTriggered(matchId, m.revealBlock);
        }
    }

    function autonomousAddStakeFor(
        uint256 matchId,
        address participant,
        uint256 nfaId,
        uint256 amount
    ) external nonReentrant {
        require(autonomousResolvers[msg.sender], "Not autonomous resolver");
        require(participant != address(0), "Invalid participant");
        require(amount > 0, "Amount must be positive");
        require(autonomousPlayerNfa[matchId][participant] == nfaId, "Wrong autonomous NFA");
        require(router != address(0), "Router not set");

        BRMatch storage m = matches[matchId];
        require(m.status == MatchStatus.OPEN, "Match locked: cannot add stake");

        uint8 currentRoom = playerRoom[matchId][participant];
        require(currentRoom != 0, "Not in this match");

        IClawRouter(router).spendCLW(nfaId, amount);

        uint256 newTotalStake = playerStake[matchId][participant] + amount;
        playerStake[matchId][participant] = newTotalStake;
        roomTotal[matchId][currentRoom] += amount;
        matchTotal[matchId] += amount;

        emit PlayerAddedStake(matchId, participant, currentRoom, amount, newTotalStake);
    }

    function autonomousChangeRoomFor(
        uint256 matchId,
        address participant,
        uint256 nfaId,
        uint8 newRoomId
    ) external nonReentrant {
        require(autonomousResolvers[msg.sender], "Not autonomous resolver");
        require(participant != address(0), "Invalid participant");
        require(roomIdValid(newRoomId), "Invalid room: 1-10");
        require(autonomousPlayerNfa[matchId][participant] == nfaId, "Wrong autonomous NFA");

        BRMatch storage m = matches[matchId];
        require(m.status == MatchStatus.OPEN, "Match locked: cannot change room");

        uint8 currentRoom = playerRoom[matchId][participant];
        require(currentRoom != 0, "Not in this match");
        require(currentRoom != newRoomId, "Already in this room");
        require(
            roomChangeCount[matchId][participant] < MAX_ROOM_CHANGES_PER_MATCH,
            "Room change limit reached"
        );

        uint256 currentStake = playerStake[matchId][participant];
        address[] storage oldPlayers = roomPlayers[matchId][currentRoom];
        for (uint256 i = 0; i < oldPlayers.length; i++) {
            if (oldPlayers[i] == participant) {
                oldPlayers[i] = oldPlayers[oldPlayers.length - 1];
                oldPlayers.pop();
                break;
            }
        }

        roomTotal[matchId][currentRoom] -= currentStake;
        if (oldPlayers.length == 0) {
            roomOccupied[matchId][currentRoom] = false;
        }

        roomPlayers[matchId][newRoomId].push(participant);
        roomTotal[matchId][newRoomId] += currentStake;
        playerRoom[matchId][participant] = newRoomId;
        roomOccupied[matchId][newRoomId] = true;
        roomChangeCount[matchId][participant] += 1;

        emit PlayerChangedRoom(matchId, participant, currentRoom, newRoomId, currentStake);
    }

    function autonomousClaimFor(
        uint256 matchId,
        address participant,
        uint256 nfaId
    ) external nonReentrant returns (uint256 amount) {
        require(autonomousResolvers[msg.sender], "Not autonomous resolver");
        require(participant != address(0), "Invalid participant");
        require(autonomousPlayerNfa[matchId][participant] == nfaId, "Wrong autonomous NFA");
        require(router != address(0), "Router not set");

        BRMatch storage m = matches[matchId];
        require(m.status == MatchStatus.SETTLED, "Match not settled");
        require(!claimed[matchId][participant], "Already claimed");

        claimed[matchId][participant] = true;

        uint8 roomId = playerRoom[matchId][participant];
        if (roomId == 0 || roomId == m.losingRoom) {
            emit PlayerClaimed(matchId, participant, 0, 0, 0);
            emit AutonomousClaimed(matchId, participant, nfaId, 0);
            return 0;
        }

        MatchSettlement storage settlement = matchSettlements[matchId];
        uint256 stake = playerStake[matchId][participant];
        uint256 weight = survivorWeight[matchId][participant];
        uint256 prize = settlement.totalSurvivorWeight > 0
            ? (weight * settlement.survivorPrize) / settlement.totalSurvivorWeight
            : 0;

        amount = stake + prize;
        IClawRouter(router).addCLW(nfaId, amount);
        emit PlayerClaimed(matchId, participant, stake, prize, amount);
        emit AutonomousClaimed(matchId, participant, nfaId, amount);
    }

    function reveal(uint256 matchId) external nonReentrant {
        BRMatch storage m = matches[matchId];
        require(m.status == MatchStatus.PENDING_REVEAL, "Not pending reveal");
        require(block.number > m.revealBlock, "Too early: wait for reveal block");
        require(block.number - m.revealBlock <= BLOCKHASH_SAFE, "Reveal window expired");

        bytes32 seed = keccak256(abi.encodePacked(
            blockhash(m.revealBlock),
            matchId,
            m.roundId
        ));

        _settle(matchId, m, seed, false);
    }

    function emergencyReveal(uint256 matchId) external onlyOwner nonReentrant {
        BRMatch storage m = matches[matchId];
        require(m.status == MatchStatus.PENDING_REVEAL, "Not pending reveal");
        require(block.number > m.revealBlock + BLOCKHASH_SAFE, "Use reveal() first");

        bytes32 seed = keccak256(abi.encodePacked(
            block.prevrandao,
            block.timestamp,
            blockhash(block.number - 1),
            matchId,
            m.roundId
        ));

        _settle(matchId, m, seed, true);
    }

    function claim(uint256 matchId) external nonReentrant returns (uint256 amount) {
        BRMatch storage m = matches[matchId];
        require(m.status == MatchStatus.SETTLED, "Match not settled");
        require(!claimed[matchId][msg.sender], "Already claimed");

        claimed[matchId][msg.sender] = true;

        uint8 roomId = playerRoom[matchId][msg.sender];
        if (roomId == 0 || roomId == m.losingRoom) {
            emit PlayerClaimed(matchId, msg.sender, 0, 0, 0);
            return 0;
        }

        MatchSettlement storage settlement = matchSettlements[matchId];
        uint256 stake = playerStake[matchId][msg.sender];
        uint256 weight = survivorWeight[matchId][msg.sender];
        uint256 prize = settlement.totalSurvivorWeight > 0
            ? (weight * settlement.survivorPrize) / settlement.totalSurvivorWeight
            : 0;

        amount = stake + prize;
        clwToken.safeTransfer(msg.sender, amount);
        emit PlayerClaimed(matchId, msg.sender, stake, prize, amount);
    }

    function _settle(
        uint256 matchId,
        BRMatch storage m,
        bytes32 seed,
        bool fallbackEntropyUsed
    ) internal {
        uint8[10] memory occupied;
        uint8 count = 0;
        for (uint8 i = 1; i <= MAX_ROOMS; i++) {
            if (roomOccupied[matchId][i]) {
                occupied[count] = i;
                count++;
            }
        }
        require(count > 0, "No occupied rooms");

        uint8 losingRoom = occupied[uint256(seed) % count];
        uint256 loserTotal = roomTotal[matchId][losingRoom];
        uint256 survivorBaseTotal = matchTotal[matchId] - loserTotal;
        uint256 treasuryFee = treasury != address(0)
            ? (loserTotal * _treasuryBpsForMatch(matchId)) / BASE_BPS
            : 0;
        uint256 survivorPrize = loserTotal - treasuryFee;

        if (survivorBaseTotal == 0) {
            treasuryFee = loserTotal;
            survivorPrize = 0;
        }

        m.losingRoom = losingRoom;
        m.status = MatchStatus.SETTLED;

        MatchSettlement storage settlement = matchSettlements[matchId];
        settlement.loserTotal = loserTotal;
        settlement.survivorBaseTotal = survivorBaseTotal;
        settlement.treasuryFee = treasuryFee;
        settlement.survivorPrize = survivorPrize;
        settlement.fallbackEntropyUsed = fallbackEntropyUsed;

        uint256 totalWeight = 0;
        if (survivorBaseTotal > 0) {
            for (uint8 roomId = 1; roomId <= MAX_ROOMS; roomId++) {
                if (!roomOccupied[matchId][roomId] || roomId == losingRoom) {
                    continue;
                }

                address[] storage survivors = roomPlayers[matchId][roomId];
                for (uint256 i = 0; i < survivors.length; i++) {
                    address survivor = survivors[i];
                    uint256 weight = _computeSurvivorWeight(matchId, survivor, playerStake[matchId][survivor]);
                    survivorWeight[matchId][survivor] = weight;
                    totalWeight += weight;
                }
            }
        }
        settlement.totalSurvivorWeight = totalWeight;

        emit RoundSettled(matchId, losingRoom, loserTotal, treasuryFee, survivorPrize, fallbackEntropyUsed);

        // Treasury fees remain recorded in settlement metadata, but reveal must not
        // assume this contract already custody-mirrors all autonomous router stakes.
        // Immediate token transfers here can brick autonomy-backed rounds.

        address[] storage losers = roomPlayers[matchId][losingRoom];
        for (uint256 i = 0; i < losers.length; i++) {
            emit LoserEliminated(matchId, losers[i], playerStake[matchId][losers[i]]);
        }

        _openMatch();
    }

    function _openMatch() internal returns (uint256 matchId) {
        matchId = ++matchCount;
        roundIdCounter++;

        matches[matchId] = BRMatch({
            status: MatchStatus.OPEN,
            totalPlayers: 0,
            revealBlock: 0,
            losingRoom: 0,
            roundId: roundIdCounter
        });

        matchConfigs[matchId] = MatchConfig({
            minStake: minStake,
            treasuryBps: treasuryBps,
            triggerCount: triggerCount,
            revealDelay: revealDelay,
            initialized: true
        });

        emit MatchOpened(matchId, roundIdCounter, minStake, triggerCount, treasuryBps, revealDelay);
    }

    function _computeSurvivorWeight(
        uint256 matchId,
        address player,
        uint256 stake
    ) internal view returns (uint256) {
        uint256 nfaId = _effectivePlayerNfa(matchId, player);
        if (nfaId == 0 || router == address(0) || speedBonusBps == 0) {
            return stake;
        }

        uint8 spd;
        try IClawRouter(router).lobsters(nfaId) returns (
            uint8,
            uint8,
            uint8,
            uint8,
            uint8,
            uint8,
            uint8,
            uint8,
            uint8,
            uint8 _spd,
            uint8,
            bytes32,
            bytes32,
            uint16,
            uint32,
            uint64
        ) {
            spd = _spd;
        } catch {
            return stake;
        }

        return (stake * (BASE_BPS + uint256(spd) * speedBonusBps)) / BASE_BPS;
    }

    function _effectivePlayerNfa(uint256 matchId, address player) internal view returns (uint256) {
        if (nfa == address(0)) {
            return 0;
        }

        uint256 autonomousSelected = autonomousPlayerNfa[matchId][player];
        if (autonomousSelected != 0) {
            return autonomousSelected;
        }

        uint256 selected = playerNfa[matchId][player];
        if (selected != 0) {
            try IBattleRoyaleNFA(nfa).ownerOf(selected) returns (address owner) {
                if (owner == player) {
                    return selected;
                }
            } catch {}
        }

        uint256 balance;
        try IBattleRoyaleNFA(nfa).balanceOf(player) returns (uint256 owned) {
            balance = owned;
        } catch {
            return 0;
        }

        if (balance != 1) {
            return 0;
        }

        try IBattleRoyaleNFA(nfa).tokenOfOwnerByIndex(player, 0) returns (uint256 tokenId) {
            return tokenId;
        } catch {
            return 0;
        }
    }

    function _minStakeForMatch(uint256 matchId) internal view returns (uint256) {
        MatchConfig storage cfg = matchConfigs[matchId];
        return cfg.initialized ? cfg.minStake : minStake;
    }

    function _triggerCountForMatch(uint256 matchId) internal view returns (uint8) {
        MatchConfig storage cfg = matchConfigs[matchId];
        return cfg.initialized ? cfg.triggerCount : triggerCount;
    }

    function _treasuryBpsForMatch(uint256 matchId) internal view returns (uint256) {
        MatchConfig storage cfg = matchConfigs[matchId];
        return cfg.initialized ? cfg.treasuryBps : treasuryBps;
    }

    function _revealDelayForMatch(uint256 matchId) internal view returns (uint8) {
        MatchConfig storage cfg = matchConfigs[matchId];
        return cfg.initialized ? cfg.revealDelay : revealDelay;
    }

    function _recentStart(uint256 window) internal view returns (uint256) {
        if (matchCount == 0) {
            return 0;
        }
        if (matchCount > window) {
            return matchCount - window + 1;
        }
        return 1;
    }

    function openMatch() external returns (uint256) {
        uint256 start = _recentStart(5);
        if (start != 0) {
            for (uint256 i = start; i <= matchCount; i++) {
                if (matches[i].status == MatchStatus.OPEN) revert("Match already open");
            }
        }
        return _openMatch();
    }

    function latestOpenMatch() external view returns (uint256 matchId) {
        uint256 start = _recentStart(matchCount);
        if (start == 0) {
            return 0;
        }

        for (uint256 i = matchCount + 1; i > start; i--) {
            uint256 current = i - 1;
            if (matches[current].status == MatchStatus.OPEN) {
                return current;
            }
        }
        return 0;
    }

    function getMatchInfo(uint256 matchId) external view returns (
        MatchStatus status,
        uint8 totalPlayers,
        uint256 revealBlock,
        uint8 losingRoom,
        uint256 total,
        uint256 roundId
    ) {
        BRMatch storage m = matches[matchId];
        return (
            m.status,
            m.totalPlayers,
            m.revealBlock,
            m.losingRoom,
            matchTotal[matchId],
            m.roundId
        );
    }

    function getMatchSnapshot(uint256 matchId) external view returns (
        uint256[10] memory playerCounts,
        uint256[10] memory roomTotals
    ) {
        for (uint8 i = 1; i <= MAX_ROOMS; i++) {
            playerCounts[i - 1] = roomPlayers[matchId][i].length;
            roomTotals[i - 1] = roomTotal[matchId][i];
        }
    }

    function getRoomPlayers(uint256 matchId, uint8 roomId)
        external
        view
        returns (address[] memory)
    {
        return roomPlayers[matchId][roomId];
    }

    function getPlayerInfo(uint256 matchId, address player)
        external
        view
        returns (uint8 roomId, uint256 stake)
    {
        roomId = playerRoom[matchId][player];
        stake = playerStake[matchId][player];
    }

    function getClaimable(uint256 matchId, address player)
        external
        view
        returns (uint256)
    {
        BRMatch storage m = matches[matchId];
        if (m.status != MatchStatus.SETTLED || claimed[matchId][player]) {
            return 0;
        }

        uint8 roomId = playerRoom[matchId][player];
        if (roomId == 0 || roomId == m.losingRoom) {
            return 0;
        }

        MatchSettlement storage settlement = matchSettlements[matchId];
        uint256 stake = playerStake[matchId][player];
        uint256 weight = survivorWeight[matchId][player];
        uint256 prize = settlement.totalSurvivorWeight > 0
            ? (weight * settlement.survivorPrize) / settlement.totalSurvivorWeight
            : 0;
        return stake + prize;
    }

    function getMatchConfig(uint256 matchId)
        external
        view
        returns (uint256, uint8, uint256, uint8)
    {
        return (
            _minStakeForMatch(matchId),
            _triggerCountForMatch(matchId),
            _treasuryBpsForMatch(matchId),
            _revealDelayForMatch(matchId)
        );
    }

    function getMatchSettlement(uint256 matchId)
        external
        view
        returns (
            uint256 loserTotal,
            uint256 survivorBaseTotal,
            uint256 treasuryFee,
            uint256 survivorPrize,
            uint256 totalSurvivorWeight,
            bool fallbackEntropyUsed
        )
    {
        MatchSettlement storage settlement = matchSettlements[matchId];
        return (
            settlement.loserTotal,
            settlement.survivorBaseTotal,
            settlement.treasuryFee,
            settlement.survivorPrize,
            settlement.totalSurvivorWeight,
            settlement.fallbackEntropyUsed
        );
    }

    function getEffectivePlayerNfa(uint256 matchId, address player) external view returns (uint256) {
        return _effectivePlayerNfa(matchId, player);
    }

    function setClwToken(address _token) external onlyOwner {
        require(_token != address(0), "Zero address");
        clwToken = IERC20(_token);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
    }

    function setMinStake(uint256 newMinStake) external onlyOwner {
        require(newMinStake > 0, "Invalid min stake");
        emit MinStakeUpdated(minStake, newMinStake);
        minStake = newMinStake;
    }

    function setTriggerCount(uint8 newTriggerCount) external onlyOwner {
        require(newTriggerCount >= 2 && newTriggerCount <= MAX_TRIGGER_COUNT, "Invalid trigger count");
        emit TriggerCountUpdated(triggerCount, newTriggerCount);
        triggerCount = newTriggerCount;
    }

    function setTreasuryBps(uint256 newTreasuryBps) external onlyOwner {
        require(newTreasuryBps <= MAX_TREASURY_BPS, "Treasury bps too high");
        emit TreasuryBpsUpdated(treasuryBps, newTreasuryBps);
        treasuryBps = newTreasuryBps;
    }

    function setRevealDelay(uint8 newRevealDelay) external onlyOwner {
        require(newRevealDelay > 0 && newRevealDelay <= MAX_REVEAL_DELAY, "Invalid reveal delay");
        emit RevealDelayUpdated(revealDelay, newRevealDelay);
        revealDelay = newRevealDelay;
    }

    function setRouter(address newRouter) external onlyOwner {
        emit RouterUpdated(router, newRouter);
        router = newRouter;
    }

    function setNfa(address newNfa) external onlyOwner {
        emit NfaUpdated(nfa, newNfa);
        nfa = newNfa;
    }

    function setSpeedBonusBps(uint256 newSpeedBonusBps) external onlyOwner {
        require(newSpeedBonusBps <= MAX_SPEED_BONUS_BPS, "Speed bonus too high");
        emit SpeedBonusBpsUpdated(speedBonusBps, newSpeedBonusBps);
        speedBonusBps = newSpeedBonusBps;
    }

    function recoverToken(address token, uint256 amount) external onlyOwner {
        if (token == address(clwToken)) {
            uint256 start = _recentStart(10);
            if (start != 0) {
                for (uint256 i = start; i <= matchCount; i++) {
                    MatchStatus s = matches[i].status;
                    require(
                        s != MatchStatus.OPEN && s != MatchStatus.PENDING_REVEAL,
                        "Active match in progress"
                    );
                }
            }
        }
        IERC20(token).safeTransfer(owner(), amount);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function roomIdValid(uint8 roomId) private pure returns (bool) {
        return roomId >= 1 && roomId <= MAX_ROOMS;
    }

    uint256[27] private __gap;
}
