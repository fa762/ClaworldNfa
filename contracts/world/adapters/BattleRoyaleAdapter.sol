// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IClawActionAdapter.sol";

interface IBattleRoyaleAutonomyTarget {
    function autonomousEnterRoomFor(
        uint256 matchId,
        address participant,
        uint256 nfaId,
        uint8 roomId,
        uint256 amount
    ) external;

    function autonomousAddStakeFor(
        uint256 matchId,
        address participant,
        uint256 nfaId,
        uint256 amount
    ) external;

    function autonomousChangeRoomFor(
        uint256 matchId,
        address participant,
        uint256 nfaId,
        uint8 newRoomId
    ) external;

    function autonomousClaimFor(
        uint256 matchId,
        address participant,
        uint256 nfaId
    ) external returns (uint256 amount);
}

interface IBattleRoyaleAutonomyNfa {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title BattleRoyaleAdapter
 * @dev Direct autonomy adapter for the existing BattleRoyale contract.
 *      Payload format: abi.encode(uint8 mode, bytes data)
 *      modes:
 *      0 = ENTER_OPTIONS  data = abi.encode(uint256 matchId, uint8[] roomIds, uint256[] stakeAmounts)
 *      1 = CHANGE_ROOM    data = abi.encode(uint256 matchId, uint8[] roomIds)
 *      2 = ADD_STAKE      data = abi.encode(uint256 matchId, uint256[] addAmounts)
 *      3 = CLAIM_EXISTING data = abi.encode(uint256 matchId)
 */
contract BattleRoyaleAdapter is IClawActionAdapter, Ownable {
    bytes32 public constant PARTICIPANT_SALT =
        keccak256("clawworld.battle-royale.autonomy.participant");

    uint8 public constant MODE_ENTER_OPTIONS = 0;
    uint8 public constant MODE_CHANGE_ROOM = 1;
    uint8 public constant MODE_ADD_STAKE = 2;
    uint8 public constant MODE_CLAIM_EXISTING = 3;

    address public hub;
    IBattleRoyaleAutonomyTarget public battleRoyale;
    IBattleRoyaleAutonomyNfa public nfa;

    mapping(uint256 => mapping(uint256 => address)) public matchParticipantOf;

    constructor(address _hub, address _battleRoyale, address _nfa) {
        require(_hub != address(0), "Invalid hub");
        require(_battleRoyale != address(0), "Invalid battle royale");
        require(_nfa != address(0), "Invalid NFA");
        hub = _hub;
        battleRoyale = IBattleRoyaleAutonomyTarget(_battleRoyale);
        nfa = IBattleRoyaleAutonomyNfa(_nfa);
    }

    function setHub(address _hub) external onlyOwner {
        require(_hub != address(0), "Invalid hub");
        hub = _hub;
    }

    function setBattleRoyale(address _battleRoyale) external onlyOwner {
        require(_battleRoyale != address(0), "Invalid battle royale");
        battleRoyale = IBattleRoyaleAutonomyTarget(_battleRoyale);
    }

    function setNfa(address _nfa) external onlyOwner {
        require(_nfa != address(0), "Invalid NFA");
        nfa = IBattleRoyaleAutonomyNfa(_nfa);
    }

    function executeAutonomousAction(
        uint256 requestId,
        uint256 nfaId,
        uint8,
        uint8 choice,
        bytes32 spendAssetId,
        uint256,
        bytes calldata payload,
        string calldata reasoningCid
    ) external override returns (ActionExecutionResult memory result) {
        require(msg.sender == hub, "Only hub");

        (uint8 mode, bytes memory data) = abi.decode(payload, (uint8, bytes));

        if (mode == MODE_ENTER_OPTIONS) {
            return _executeEnter(requestId, nfaId, choice, spendAssetId, data, reasoningCid);
        }
        if (mode == MODE_CHANGE_ROOM) {
            return _executeChangeRoom(requestId, nfaId, choice, spendAssetId, data, reasoningCid);
        }
        if (mode == MODE_ADD_STAKE) {
            return _executeAddStake(requestId, nfaId, choice, spendAssetId, data, reasoningCid);
        }
        if (mode == MODE_CLAIM_EXISTING) {
            return _executeClaim(requestId, nfaId, choice, spendAssetId, data, reasoningCid);
        }
        revert("Unsupported mode");
    }

    function participantForNfa(uint256 nfaId) public pure returns (address) {
        return
            address(
                uint160(
                    uint256(keccak256(abi.encode(PARTICIPANT_SALT, nfaId)))
                )
            );
    }

    function _executeEnter(
        uint256 requestId,
        uint256 nfaId,
        uint8 choice,
        bytes32 spendAssetId,
        bytes memory data,
        string calldata reasoningCid
    ) internal returns (ActionExecutionResult memory result) {
        (uint256 matchId, uint8[] memory roomIds, uint256[] memory stakeAmounts) =
            abi.decode(data, (uint256, uint8[], uint256[]));
        require(roomIds.length == stakeAmounts.length, "Mismatched options");
        require(choice < roomIds.length, "Invalid room choice");

        address participant = participantForNfa(nfaId);
        uint8 roomId = roomIds[choice];
        uint256 stakeAmount = stakeAmounts[choice];
        battleRoyale.autonomousEnterRoomFor(matchId, participant, nfaId, roomId, stakeAmount);
        matchParticipantOf[matchId][nfaId] = participant;

        result = ActionExecutionResult({
            executionRef: keccak256(
                abi.encode(requestId, keccak256("battle-royale:enter"), matchId, nfaId, roomId, stakeAmount, reasoningCid, block.number)
            ),
            spendAssetId: spendAssetId,
            actualSpend: stakeAmount,
            clwCredit: 0,
            xpCredit: 0
        });
    }

    function _executeChangeRoom(
        uint256 requestId,
        uint256 nfaId,
        uint8 choice,
        bytes32 spendAssetId,
        bytes memory data,
        string calldata reasoningCid
    ) internal returns (ActionExecutionResult memory result) {
        (uint256 matchId, uint8[] memory roomIds) = abi.decode(data, (uint256, uint8[]));
        require(choice < roomIds.length, "Invalid room choice");
        address participant = _participantFor(matchId, nfaId);
        uint8 roomId = roomIds[choice];

        battleRoyale.autonomousChangeRoomFor(matchId, participant, nfaId, roomId);
        result = ActionExecutionResult({
            executionRef: keccak256(
                abi.encode(requestId, keccak256("battle-royale:change-room"), matchId, nfaId, roomId, reasoningCid, block.number)
            ),
            spendAssetId: spendAssetId,
            actualSpend: 0,
            clwCredit: 0,
            xpCredit: 0
        });
    }

    function _executeAddStake(
        uint256 requestId,
        uint256 nfaId,
        uint8 choice,
        bytes32 spendAssetId,
        bytes memory data,
        string calldata reasoningCid
    ) internal returns (ActionExecutionResult memory result) {
        (uint256 matchId, uint256[] memory addAmounts) = abi.decode(data, (uint256, uint256[]));
        require(choice < addAmounts.length, "Invalid add-stake choice");
        address participant = _participantFor(matchId, nfaId);
        uint256 amount = addAmounts[choice];

        battleRoyale.autonomousAddStakeFor(matchId, participant, nfaId, amount);
        result = ActionExecutionResult({
            executionRef: keccak256(
                abi.encode(requestId, keccak256("battle-royale:add-stake"), matchId, nfaId, amount, reasoningCid, block.number)
            ),
            spendAssetId: spendAssetId,
            actualSpend: amount,
            clwCredit: 0,
            xpCredit: 0
        });
    }

    function _executeClaim(
        uint256 requestId,
        uint256 nfaId,
        uint8 choice,
        bytes32 spendAssetId,
        bytes memory data,
        string calldata reasoningCid
    ) internal returns (ActionExecutionResult memory result) {
        require(choice <= 1, "Invalid claim choice");
        uint256 matchId = abi.decode(data, (uint256));
        if (choice == 1) {
            return ActionExecutionResult({
                executionRef: keccak256(
                    abi.encode(requestId, keccak256("battle-royale:claim-wait"), matchId, nfaId, block.number)
                ),
                spendAssetId: spendAssetId,
                actualSpend: 0,
                clwCredit: 0,
                xpCredit: 0
            });
        }

        address participant = _participantFor(matchId, nfaId);
        uint256 amount = battleRoyale.autonomousClaimFor(matchId, participant, nfaId);

        result = ActionExecutionResult({
            executionRef: keccak256(
                abi.encode(requestId, keccak256("battle-royale:claim"), matchId, nfaId, amount, reasoningCid, block.number)
            ),
            spendAssetId: spendAssetId,
            actualSpend: 0,
            clwCredit: amount,
            xpCredit: 0
        });
    }

    function _participantFor(uint256 matchId, uint256 nfaId) internal view returns (address participant) {
        participant = matchParticipantOf[matchId][nfaId];
        if (participant == address(0)) {
            participant = participantForNfa(nfaId);
        }
    }
}
