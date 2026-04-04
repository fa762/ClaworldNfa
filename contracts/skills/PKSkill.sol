// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

interface IPKRouter {
    function spendCLW(uint256 nfaId, uint256 amount) external;
    function addCLW(uint256 nfaId, uint256 amount) external;
    function addXP(uint256 nfaId, uint32 amount) external;
    function mutateDNA(uint256 nfaId, uint8 gene, uint8 newValue, bytes32 mutationData) external;
    function clwBalances(uint256 nfaId) external view returns (uint256);

    function lobsters(uint256 nfaId) external view returns (
        uint8 rarity,
        uint8 shelter,
        uint8 courage,
        uint8 wisdom,
        uint8 social,
        uint8 create,
        uint8 grit,
        uint8 str,
        uint8 def,
        uint8 spd,
        uint8 vit,
        bytes32 mutation1,
        bytes32 mutation2,
        uint16 level,
        uint32 xp,
        uint64 lastUpkeepTime
    );
}

interface IPKClawNFA {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IPKWorldState {
    function mutationBonus() external view returns (uint256);
    function pkStakeLimit() external view returns (uint256);
}

/**
 * @title PKSkill
 * @dev PvP combat system using commit-reveal for strategy selection.
 *      Strategies: 0=AllAttack, 1=Balanced, 2=AllDefense
 *      Winner receives the combined stake minus the 10% burn.
 *      Reveal timeout never grants a free win. Stuck matches refund both sides.
 */
contract PKSkill is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    IPKRouter public router;
    IPKClawNFA public nfa;
    IPKWorldState public worldState;

    uint256 public constant COMMIT_TIMEOUT = 1 hours;
    uint256 public constant REVEAL_TIMEOUT = 30 minutes;
    uint256 public constant BURN_BPS = 1000;    // 10%
    uint256 public constant WINNER_BPS = 5000;  // Reserved constant, kept for compatibility
    uint256 public constant PK_XP = 50;

    enum Phase { OPEN, JOINED, COMMITTED, REVEALED, SETTLED, CANCELLED }

    struct PKMatch {
        uint256 nfaA;
        uint256 nfaB;
        bytes32 commitA;
        bytes32 commitB;
        uint8 strategyA;
        uint8 strategyB;
        uint256 stake;
        Phase phase;
        uint64 phaseTimestamp;
        bool revealedA;
        bool revealedB;
        bytes32 saltA;
        bytes32 saltB;
    }

    uint256 private _matchIdCounter;
    mapping(uint256 => PKMatch) public matches;

    uint256 public entropyNonce;

    mapping(uint256 => uint32) public pkWins;
    mapping(uint256 => uint32) public pkLosses;
    mapping(uint256 => uint256) public totalPkClwWon;
    mapping(uint256 => uint256) public totalPkClwLost;
    mapping(uint256 => address) public participantAOf;
    mapping(uint256 => address) public participantBOf;

    event MatchCreated(uint256 indexed matchId, uint256 indexed nfaA, uint256 stake);
    event MatchJoined(uint256 indexed matchId, uint256 indexed nfaB);
    event ParticipantsRegistered(uint256 indexed matchId, address indexed participantA, address indexed participantB);
    event StrategyCommitted(uint256 indexed matchId, uint256 indexed nfaId);
    event StrategyRevealed(uint256 indexed matchId, uint256 indexed nfaId, uint8 strategy);
    event MatchSettled(
        uint256 indexed matchId,
        uint256 indexed winner,
        uint256 indexed loser,
        uint256 reward,
        uint256 burned
    );
    event MatchCancelled(uint256 indexed matchId);
    event MutationTriggered(uint256 indexed matchId, uint256 indexed nfaId, uint8 gene, uint8 newValue);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _router, address _nfa) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        router = IPKRouter(_router);
        nfa = IPKClawNFA(_nfa);
    }

    function setWorldState(address _worldState) external onlyOwner {
        worldState = IPKWorldState(_worldState);
    }

    // ============================================
    // Arena flow
    // ============================================

    function createMatchWithCommit(uint256 nfaId, uint256 stake, bytes32 commitHash) external returns (uint256) {
        require(nfa.ownerOf(nfaId) == msg.sender, "Not NFA owner");
        require(stake > 0, "Zero stake");
        require(commitHash != bytes32(0), "Empty commit");
        require(router.clwBalances(nfaId) >= stake, "Insufficient CLW");
        if (address(worldState) != address(0)) {
            require(stake <= worldState.pkStakeLimit(), "Exceeds stake limit");
        }

        router.spendCLW(nfaId, stake);

        uint256 matchId = ++_matchIdCounter;
        matches[matchId] = PKMatch({
            nfaA: nfaId,
            nfaB: 0,
            commitA: commitHash,
            commitB: bytes32(0),
            strategyA: 0,
            strategyB: 0,
            stake: stake,
            phase: Phase.OPEN,
            phaseTimestamp: uint64(block.timestamp),
            revealedA: false,
            revealedB: false,
            saltA: bytes32(0),
            saltB: bytes32(0)
        });
        participantAOf[matchId] = msg.sender;

        emit MatchCreated(matchId, nfaId, stake);
        emit StrategyCommitted(matchId, nfaId);
        emit ParticipantsRegistered(matchId, msg.sender, address(0));
        return matchId;
    }

    function joinMatchWithCommit(uint256 matchId, uint256 nfaId, bytes32 commitHash) external {
        PKMatch storage m = matches[matchId];
        require(m.phase == Phase.OPEN, "Not open");
        require(nfa.ownerOf(nfaId) == msg.sender, "Not NFA owner");
        require(nfaId != m.nfaA, "Cannot fight self");
        require(commitHash != bytes32(0), "Empty commit");
        require(router.clwBalances(nfaId) >= m.stake, "Insufficient CLW");

        router.spendCLW(nfaId, m.stake);
        m.nfaB = nfaId;
        m.commitB = commitHash;
        m.phase = m.commitA != bytes32(0) ? Phase.COMMITTED : Phase.JOINED;
        m.phaseTimestamp = uint64(block.timestamp);
        participantBOf[matchId] = msg.sender;

        emit MatchJoined(matchId, nfaId);
        emit StrategyCommitted(matchId, nfaId);
        emit ParticipantsRegistered(matchId, participantAOf[matchId], msg.sender);
    }

    function recommitStrategy(uint256 matchId, bytes32 newCommitHash) external {
        PKMatch storage m = matches[matchId];
        require(m.phase == Phase.OPEN, "Not open");
        require(m.nfaB == 0, "Challenger already joined");
        require(_participantA(matchId, m) == msg.sender, "Not creator");
        require(newCommitHash != bytes32(0), "Empty commit");

        m.commitA = newCommitHash;
        emit StrategyCommitted(matchId, m.nfaA);
    }

    // ============================================
    // Legacy flow
    // ============================================

    function createMatch(uint256 nfaId, uint256 stake) external returns (uint256) {
        require(nfa.ownerOf(nfaId) == msg.sender, "Not NFA owner");
        require(stake > 0, "Zero stake");
        require(router.clwBalances(nfaId) >= stake, "Insufficient CLW");
        if (address(worldState) != address(0)) {
            require(stake <= worldState.pkStakeLimit(), "Exceeds stake limit");
        }

        router.spendCLW(nfaId, stake);

        uint256 matchId = ++_matchIdCounter;
        matches[matchId] = PKMatch({
            nfaA: nfaId,
            nfaB: 0,
            commitA: bytes32(0),
            commitB: bytes32(0),
            strategyA: 0,
            strategyB: 0,
            stake: stake,
            phase: Phase.OPEN,
            phaseTimestamp: uint64(block.timestamp),
            revealedA: false,
            revealedB: false,
            saltA: bytes32(0),
            saltB: bytes32(0)
        });
        participantAOf[matchId] = msg.sender;

        emit MatchCreated(matchId, nfaId, stake);
        emit ParticipantsRegistered(matchId, msg.sender, address(0));
        return matchId;
    }

    function joinMatch(uint256 matchId, uint256 nfaId) external {
        PKMatch storage m = matches[matchId];
        require(m.phase == Phase.OPEN, "Not open");
        require(nfa.ownerOf(nfaId) == msg.sender, "Not NFA owner");
        require(nfaId != m.nfaA, "Cannot fight self");
        require(router.clwBalances(nfaId) >= m.stake, "Insufficient CLW");

        router.spendCLW(nfaId, m.stake);
        m.nfaB = nfaId;
        m.phase = Phase.JOINED;
        m.phaseTimestamp = uint64(block.timestamp);
        participantBOf[matchId] = msg.sender;

        emit MatchJoined(matchId, nfaId);
        emit ParticipantsRegistered(matchId, participantAOf[matchId], msg.sender);
    }

    function commitStrategy(uint256 matchId, bytes32 commitHash) external {
        PKMatch storage m = matches[matchId];
        require(m.phase == Phase.JOINED, "Not in commit phase");

        if (_participantA(matchId, m) == msg.sender) {
            require(m.commitA == bytes32(0), "Already committed");
            m.commitA = commitHash;
        } else if (_participantB(matchId, m) == msg.sender) {
            require(m.commitB == bytes32(0), "Already committed");
            m.commitB = commitHash;
        } else {
            revert("Not a participant");
        }

        emit StrategyCommitted(matchId, _getNfaId(matchId, m, msg.sender));

        if (m.commitA != bytes32(0) && m.commitB != bytes32(0)) {
            m.phase = Phase.COMMITTED;
            m.phaseTimestamp = uint64(block.timestamp);
        }
    }

    function revealStrategy(uint256 matchId, uint8 strategy, bytes32 salt) external {
        PKMatch storage m = matches[matchId];
        require(m.phase == Phase.COMMITTED, "Not in reveal phase");
        require(strategy <= 2, "Invalid strategy");

        if (_participantA(matchId, m) == msg.sender) {
            _applyReveal(matchId, m, true, strategy, salt);
        } else if (_participantB(matchId, m) == msg.sender) {
            _applyReveal(matchId, m, false, strategy, salt);
        } else {
            revert("Not a participant");
        }

        emit StrategyRevealed(matchId, _getNfaId(matchId, m, msg.sender), strategy);

        if (m.revealedA && m.revealedB) {
            m.phase = Phase.REVEALED;
            m.phaseTimestamp = uint64(block.timestamp);
        }
    }

    function revealBothAndSettle(
        uint256 matchId,
        uint8 strategyA,
        bytes32 saltA,
        uint8 strategyB,
        bytes32 saltB
    ) external nonReentrant {
        PKMatch storage m = matches[matchId];
        require(m.phase == Phase.COMMITTED || m.phase == Phase.REVEALED, "Not ready");
        require(strategyA <= 2 && strategyB <= 2, "Invalid strategy");

        if (!m.revealedA) {
            _applyReveal(matchId, m, true, strategyA, saltA);
            emit StrategyRevealed(matchId, m.nfaA, strategyA);
        }
        if (!m.revealedB) {
            _applyReveal(matchId, m, false, strategyB, saltB);
            emit StrategyRevealed(matchId, m.nfaB, strategyB);
        }

        require(m.revealedA && m.revealedB, "Both reveals required");
        m.phase = Phase.REVEALED;
        m.phaseTimestamp = uint64(block.timestamp);
        _settleNormal(matchId, m);
    }

    // ============================================
    // Settlement and cancellation
    // ============================================

    function settle(uint256 matchId) external nonReentrant {
        PKMatch storage m = matches[matchId];

        if (m.phase == Phase.REVEALED) {
            _settleNormal(matchId, m);
        } else if (m.phase == Phase.COMMITTED) {
            require(block.timestamp > m.phaseTimestamp + REVEAL_TIMEOUT, "Reveal window open");
            _settleTimeout(matchId, m);
        } else {
            revert("Cannot settle");
        }
    }

    function cancelMatch(uint256 matchId) external {
        PKMatch storage m = matches[matchId];
        require(m.phase == Phase.OPEN, "Not open");
        require(
            _participantA(matchId, m) == msg.sender ||
            block.timestamp > m.phaseTimestamp + COMMIT_TIMEOUT,
            "Cannot cancel yet"
        );

        m.phase = Phase.CANCELLED;
        router.addCLW(m.nfaA, m.stake);

        emit MatchCancelled(matchId);
    }

    function cancelJoinedMatch(uint256 matchId) external {
        PKMatch storage m = matches[matchId];
        require(m.phase == Phase.JOINED, "Not in joined phase");
        require(
            block.timestamp > m.phaseTimestamp + COMMIT_TIMEOUT,
            "Commit window still open"
        );

        m.phase = Phase.CANCELLED;
        router.addCLW(m.nfaA, m.stake);
        router.addCLW(m.nfaB, m.stake);

        emit MatchCancelled(matchId);
    }

    function cancelCommittedMatch(uint256 matchId) external {
        PKMatch storage m = matches[matchId];
        require(m.phase == Phase.COMMITTED, "Not in committed phase");
        require(
            block.timestamp > m.phaseTimestamp + REVEAL_TIMEOUT,
            "Reveal window still open"
        );

        router.addCLW(m.nfaA, m.stake);
        router.addCLW(m.nfaB, m.stake);
        m.phase = Phase.CANCELLED;
        emit MatchCancelled(matchId);
    }

    // ============================================
    // Combat resolution
    // ============================================

    function _settleNormal(uint256 matchId, PKMatch storage m) internal {
        (uint256 damageA, uint256 damageB) = _calculateCombat(m);

        uint256 winner;
        uint256 loser;

        if (damageA >= damageB) {
            winner = m.nfaA;
            loser = m.nfaB;
        } else {
            winner = m.nfaB;
            loser = m.nfaA;
        }

        _distributeRewards(matchId, m, winner, loser);
    }

    function _settleTimeout(uint256 matchId, PKMatch storage m) internal {
        router.addCLW(m.nfaA, m.stake);
        router.addCLW(m.nfaB, m.stake);
        m.phase = Phase.CANCELLED;
        emit MatchCancelled(matchId);
    }

    function _distributeRewards(uint256 matchId, PKMatch storage m, uint256 winner, uint256 loser) internal {
        uint256 totalStake = m.stake * 2;
        uint256 burned = totalStake * BURN_BPS / 10000;
        uint256 winnerReward = totalStake - burned;

        router.addCLW(winner, winnerReward);
        router.addXP(winner, uint32(PK_XP));
        router.addXP(loser, uint32(PK_XP / 2));

        m.phase = Phase.SETTLED;

        pkWins[winner]++;
        pkLosses[loser]++;
        totalPkClwWon[winner] += winnerReward;
        totalPkClwLost[loser] += m.stake;

        emit MatchSettled(matchId, winner, loser, winnerReward, burned);
        _checkMutation(matchId, winner, loser);
    }

    struct CombatUnit {
        uint256 str;
        uint256 def;
        uint256 spd;
        uint256 vit;
        uint256 atkMul;
        uint256 defMul;
    }

    function _buildUnit(uint256 nfaId, uint8 strategy) internal view returns (CombatUnit memory u) {
        (
            ,
            ,
            uint8 cour,
            uint8 wis,
            ,
            ,
            uint8 grit,
            uint8 s,
            uint8 d,
            uint8 sp,
            uint8 v,
            ,
            ,
            ,
            ,
            
        ) = router.lobsters(nfaId);
        (u.atkMul, u.defMul) = _getStrategyMuls(strategy);
        u.str = s;
        u.def = d;
        u.spd = sp;
        u.vit = v;

        if (strategy == 0 && cour >= 70) u.atkMul += 500;
        if (strategy == 2 && grit >= 70) u.defMul += 500;
        if (strategy == 1 && wis >= 70) {
            u.atkMul += 300;
            u.defMul += 300;
        }
    }

    function _calculateCombat(PKMatch storage m) internal view returns (uint256 damageA, uint256 damageB) {
        CombatUnit memory a = _buildUnit(m.nfaA, m.strategyA);
        CombatUnit memory b = _buildUnit(m.nfaB, m.strategyB);

        uint256 effStrA = a.str * a.atkMul / 10000;
        uint256 effDefA = a.def * a.defMul / 10000;
        uint256 effStrB = b.str * b.atkMul / 10000;
        uint256 effDefB = b.def * b.defMul / 10000;

        uint256 rawDmgA = effStrA > effDefB ? effStrA - effDefB : 1;
        uint256 rawDmgB = effStrB > effDefA ? effStrB - effDefA : 1;

        if (a.spd > b.spd) rawDmgA = rawDmgA * 11000 / 10000;
        else if (b.spd > a.spd) rawDmgB = rawDmgB * 11000 / 10000;

        uint256 hpA = a.vit * 10;
        uint256 hpB = b.vit * 10;

        damageA = rawDmgA * 10000 / (hpB > 0 ? hpB : 1);
        damageB = rawDmgB * 10000 / (hpA > 0 ? hpA : 1);
    }

    function _getStrategyMuls(uint8 strategy) internal pure returns (uint256 atkMul, uint256 defMul) {
        if (strategy == 0) return (15000, 5000);
        if (strategy == 1) return (10000, 10000);
        return (5000, 15000);
    }

    function _applyReveal(
        uint256 matchId,
        PKMatch storage m,
        bool isA,
        uint8 strategy,
        bytes32 salt
    ) internal {
        address participant = isA ? _participantA(matchId, m) : _participantB(matchId, m);
        require(participant != address(0), "Missing participant");

        bytes32 expectedHash = keccak256(abi.encodePacked(strategy, salt, participant));
        if (isA) {
            require(!m.revealedA, "Already revealed");
            require(m.commitA == expectedHash, "Invalid reveal");
            m.strategyA = strategy;
            m.revealedA = true;
            m.saltA = salt;
        } else {
            require(!m.revealedB, "Already revealed");
            require(m.commitB == expectedHash, "Invalid reveal");
            m.strategyB = strategy;
            m.revealedB = true;
            m.saltB = salt;
        }
    }

    function _checkMutation(uint256 matchId, uint256 winner, uint256 loser) internal {
        PKMatch storage m = matches[matchId];
        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            uint16 winnerLevel,
            ,
            
        ) = router.lobsters(winner);
        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            uint16 loserLevel,
            ,
            
        ) = router.lobsters(loser);

        if (loserLevel >= winnerLevel + 5) {
            uint256 mutChance = 10;
            if (address(worldState) != address(0)) {
                mutChance = mutChance * worldState.mutationBonus() / 10000;
            }

            uint256 rand = uint256(
                keccak256(
                    abi.encodePacked(
                        block.prevrandao,
                        block.timestamp,
                        matchId,
                        m.saltA,
                        m.saltB,
                        gasleft(),
                        ++entropyNonce
                    )
                )
            ) % 100;
            if (rand < mutChance) {
                uint8 gene = uint8(uint256(keccak256(abi.encodePacked(rand, entropyNonce))) % 4);
                (
                    ,
                    ,
                    ,
                    ,
                    ,
                    ,
                    ,
                    uint8 str,
                    uint8 def,
                    uint8 spd,
                    uint8 vit,
                    ,
                    ,
                    ,
                    ,
                    
                ) = router.lobsters(winner);

                uint8 currentVal;
                if (gene == 0) currentVal = str;
                else if (gene == 1) currentVal = def;
                else if (gene == 2) currentVal = spd;
                else currentVal = vit;

                uint8 newVal = currentVal + 5 > 100 ? 100 : currentVal + 5;
                bytes32 mutData = keccak256(abi.encodePacked("pk_mutation", matchId));
                router.mutateDNA(winner, gene, newVal, mutData);

                emit MutationTriggered(matchId, winner, gene, newVal);
            }
        }
    }

    function _participantA(uint256 matchId, PKMatch storage m) internal view returns (address) {
        address participant = participantAOf[matchId];
        return participant == address(0) ? nfa.ownerOf(m.nfaA) : participant;
    }

    function _participantB(uint256 matchId, PKMatch storage m) internal view returns (address) {
        address participant = participantBOf[matchId];
        if (participant != address(0)) return participant;
        if (m.nfaB == 0) return address(0);
        return nfa.ownerOf(m.nfaB);
    }

    function _getNfaId(uint256 matchId, PKMatch storage m, address sender) internal view returns (uint256) {
        if (_participantA(matchId, m) == sender || nfa.ownerOf(m.nfaA) == sender) {
            return m.nfaA;
        }
        return m.nfaB;
    }

    // ============================================
    // View
    // ============================================

    function getMatchCount() external view returns (uint256) {
        return _matchIdCounter;
    }

    function getMatch(uint256 matchId) external view returns (PKMatch memory) {
        return matches[matchId];
    }

    function getStrategyHash(uint8 strategy, bytes32 salt, address sender) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(strategy, salt, sender));
    }

    function getPkStats(uint256 nfaId) external view returns (
        uint32 wins,
        uint32 losses,
        uint256 clwWon,
        uint256 clwLost
    ) {
        return (pkWins[nfaId], pkLosses[nfaId], totalPkClwWon[nfaId], totalPkClwLost[nfaId]);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    uint256[34] private __gap;
}
