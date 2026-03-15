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
        uint8 rarity, uint8 shelter,
        uint8 courage, uint8 wisdom, uint8 social, uint8 create, uint8 grit,
        uint8 str, uint8 def, uint8 spd, uint8 vit,
        bytes32 mutation1, bytes32 mutation2,
        uint16 level, uint32 xp, uint64 lastUpkeepTime
    );
}

interface IPKClawNFA {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title PKSkill
 * @dev PvP combat system using Commit-Reveal for strategy selection.
 *      Strategies: 0=AllAttack, 1=Balanced, 2=AllDefense
 *      Winner gets 50% of total stake, 10% burned, 40% returned to winner.
 *      10% mutation chance when beating opponent 5+ levels above.
 */
contract PKSkill is
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    IPKRouter public router;
    IPKClawNFA public nfa;

    uint256 public constant COMMIT_TIMEOUT = 1 hours;
    uint256 public constant REVEAL_TIMEOUT = 30 minutes;
    uint256 public constant BURN_BPS = 1000;    // 10%
    uint256 public constant WINNER_BPS = 5000;  // 50%
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
    }

    uint256 private _matchIdCounter;
    mapping(uint256 => PKMatch) public matches;

    event MatchCreated(uint256 indexed matchId, uint256 indexed nfaA, uint256 stake);
    event MatchJoined(uint256 indexed matchId, uint256 indexed nfaB);
    event StrategyCommitted(uint256 indexed matchId, uint256 indexed nfaId);
    event StrategyRevealed(uint256 indexed matchId, uint256 indexed nfaId, uint8 strategy);
    event MatchSettled(uint256 indexed matchId, uint256 winner, uint256 loser, uint256 reward, uint256 burned);
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

    // ============================================
    // PK FLOW
    // ============================================

    function createMatch(uint256 nfaId, uint256 stake) external returns (uint256) {
        require(nfa.ownerOf(nfaId) == msg.sender, "Not NFA owner");
        require(stake > 0, "Zero stake");
        require(router.clwBalances(nfaId) >= stake, "Insufficient CLW");

        // Lock stake
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
            revealedB: false
        });

        emit MatchCreated(matchId, nfaId, stake);
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

        emit MatchJoined(matchId, nfaId);
    }

    function commitStrategy(uint256 matchId, bytes32 commitHash) external {
        PKMatch storage m = matches[matchId];
        require(m.phase == Phase.JOINED, "Not in commit phase");

        if (nfa.ownerOf(m.nfaA) == msg.sender) {
            require(m.commitA == bytes32(0), "Already committed");
            m.commitA = commitHash;
        } else if (nfa.ownerOf(m.nfaB) == msg.sender) {
            require(m.commitB == bytes32(0), "Already committed");
            m.commitB = commitHash;
        } else {
            revert("Not a participant");
        }

        emit StrategyCommitted(matchId, _getNfaId(m, msg.sender));

        if (m.commitA != bytes32(0) && m.commitB != bytes32(0)) {
            m.phase = Phase.COMMITTED;
            m.phaseTimestamp = uint64(block.timestamp);
        }
    }

    function revealStrategy(uint256 matchId, uint8 strategy, bytes32 salt) external {
        PKMatch storage m = matches[matchId];
        require(m.phase == Phase.COMMITTED, "Not in reveal phase");
        require(strategy <= 2, "Invalid strategy");

        bytes32 expectedHash = keccak256(abi.encodePacked(strategy, salt, msg.sender));

        if (nfa.ownerOf(m.nfaA) == msg.sender) {
            require(!m.revealedA, "Already revealed");
            require(m.commitA == expectedHash, "Invalid reveal");
            m.strategyA = strategy;
            m.revealedA = true;
        } else if (nfa.ownerOf(m.nfaB) == msg.sender) {
            require(!m.revealedB, "Already revealed");
            require(m.commitB == expectedHash, "Invalid reveal");
            m.strategyB = strategy;
            m.revealedB = true;
        } else {
            revert("Not a participant");
        }

        emit StrategyRevealed(matchId, _getNfaId(m, msg.sender), strategy);

        if (m.revealedA && m.revealedB) {
            m.phase = Phase.REVEALED;
            m.phaseTimestamp = uint64(block.timestamp);
        }
    }

    /**
     * @dev Settle the match. Anyone can call once both strategies are revealed,
     *      or after reveal timeout (one side wins by default).
     */
    function settle(uint256 matchId) external nonReentrant {
        PKMatch storage m = matches[matchId];

        if (m.phase == Phase.REVEALED) {
            _settleNormal(matchId, m);
        } else if (m.phase == Phase.COMMITTED) {
            // Timeout: one didn't reveal
            require(block.timestamp > m.phaseTimestamp + REVEAL_TIMEOUT, "Reveal window open");
            _settleTimeout(matchId, m);
        } else {
            revert("Cannot settle");
        }
    }

    /**
     * @dev Cancel a match if no one joined within timeout.
     */
    function cancelMatch(uint256 matchId) external {
        PKMatch storage m = matches[matchId];
        require(m.phase == Phase.OPEN, "Not open");
        require(
            nfa.ownerOf(m.nfaA) == msg.sender ||
            block.timestamp > m.phaseTimestamp + COMMIT_TIMEOUT,
            "Cannot cancel yet"
        );

        m.phase = Phase.CANCELLED;
        // Return stake to A
        router.addCLW(m.nfaA, m.stake);

        emit MatchCancelled(matchId);
    }

    // ============================================
    // COMBAT RESOLUTION
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
        uint256 winner;
        uint256 loser;

        if (m.revealedA && !m.revealedB) {
            winner = m.nfaA;
            loser = m.nfaB;
        } else if (!m.revealedA && m.revealedB) {
            winner = m.nfaB;
            loser = m.nfaA;
        } else {
            // Neither revealed — return stakes
            router.addCLW(m.nfaA, m.stake);
            router.addCLW(m.nfaB, m.stake);
            m.phase = Phase.CANCELLED;
            emit MatchCancelled(matchId);
            return;
        }

        _distributeRewards(matchId, m, winner, loser);
    }

    function _distributeRewards(uint256 matchId, PKMatch storage m, uint256 winner, uint256 loser) internal {
        uint256 totalStake = m.stake * 2;
        uint256 burned = totalStake * BURN_BPS / 10000;
        uint256 winnerReward = totalStake - burned;

        // Winner gets reward
        router.addCLW(winner, winnerReward);

        // XP for both
        router.addXP(winner, uint32(PK_XP));
        router.addXP(loser, uint32(PK_XP / 2));

        m.phase = Phase.SETTLED;

        emit MatchSettled(matchId, winner, loser, winnerReward, burned);

        // Mutation check: if winner beat someone 5+ levels higher
        _checkMutation(matchId, winner, loser);
    }

    function _calculateCombat(PKMatch storage m) internal view returns (uint256 damageA, uint256 damageB) {
        (,,,,,,,uint8 strA, uint8 defA, uint8 spdA, uint8 vitA,,,,,) = router.lobsters(m.nfaA);
        (,,,,,,,uint8 strB, uint8 defB, uint8 spdB, uint8 vitB,,,,,) = router.lobsters(m.nfaB);

        // Strategy multipliers: [attack_mul, defense_mul] in basis points
        // AllAttack: 150% ATK, 50% DEF
        // Balanced: 100% ATK, 100% DEF
        // AllDefense: 50% ATK, 150% DEF
        (uint256 atkMulA, uint256 defMulA) = _getStrategyMuls(m.strategyA);
        (uint256 atkMulB, uint256 defMulB) = _getStrategyMuls(m.strategyB);

        // Effective values
        uint256 effStrA = uint256(strA) * atkMulA / 10000;
        uint256 effDefA = uint256(defA) * defMulA / 10000;
        uint256 effStrB = uint256(strB) * atkMulB / 10000;
        uint256 effDefB = uint256(defB) * defMulB / 10000;

        // First strike: higher SPD attacks first (bonus 10%)
        uint256 fsBonus = 1000; // 10% in basis points

        // A attacks B
        uint256 rawDmgA = effStrA > effDefB ? effStrA - effDefB : 1;
        // B attacks A
        uint256 rawDmgB = effStrB > effDefA ? effStrB - effDefA : 1;

        // Speed advantage
        if (spdA > spdB) {
            rawDmgA = rawDmgA * (10000 + fsBonus) / 10000;
        } else if (spdB > spdA) {
            rawDmgB = rawDmgB * (10000 + fsBonus) / 10000;
        }

        // HP = VIT × 10
        uint256 hpA = uint256(vitA) * 10;
        uint256 hpB = uint256(vitB) * 10;

        // Damage score = rawDmg relative to opponent HP
        damageA = rawDmgA * 10000 / (hpB > 0 ? hpB : 1);
        damageB = rawDmgB * 10000 / (hpA > 0 ? hpA : 1);
    }

    function _getStrategyMuls(uint8 strategy) internal pure returns (uint256 atkMul, uint256 defMul) {
        if (strategy == 0) return (15000, 5000);   // AllAttack
        if (strategy == 1) return (10000, 10000);   // Balanced
        return (5000, 15000);                        // AllDefense
    }

    function _checkMutation(uint256 matchId, uint256 winner, uint256 loser) internal {
        (,,,,,,,,,,,,,uint16 winnerLevel,,) = router.lobsters(winner);
        (,,,,,,,,,,,,,uint16 loserLevel,,) = router.lobsters(loser);

        if (loserLevel >= winnerLevel + 5) {
            // 10% chance of mutation
            uint256 rand = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, matchId))) % 100;
            if (rand < 10) {
                uint8 gene = uint8(rand % 4);
                // Boost by 5
                (,,,,,,,uint8 str, uint8 def, uint8 spd, uint8 vit,,,,, ) = router.lobsters(winner);
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

    function _getNfaId(PKMatch storage m, address sender) internal view returns (uint256) {
        if (nfa.ownerOf(m.nfaA) == sender) return m.nfaA;
        return m.nfaB;
    }

    // ============================================
    // VIEW
    // ============================================

    function getMatch(uint256 matchId) external view returns (PKMatch memory) {
        return matches[matchId];
    }

    function getStrategyHash(uint8 strategy, bytes32 salt, address sender) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(strategy, salt, sender));
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
