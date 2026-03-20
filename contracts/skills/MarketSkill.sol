// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title MarketSkill
 * @dev Decentralized NFA marketplace supporting fixed-price sales,
 *      24h auctions, and NFA-for-NFA swaps.
 */
contract MarketSkill is
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    IERC721 public nfa;
    address public treasury;

    uint256 public constant FEE_BPS = 250;       // 2.5%
    uint256 public constant SWAP_FEE_BPS = 100;  // 1% per side
    uint256 public constant AUCTION_DURATION = 24 hours;
    uint256 public constant MIN_BID_INCREMENT_BPS = 500; // 5% minimum bid increment

    enum ListingType { FixedPrice, Auction, Swap }
    enum ListingStatus { Active, Sold, Cancelled }

    struct Listing {
        uint256 nfaId;
        address seller;
        ListingType listingType;
        uint256 price;           // BNB price (fixed) or starting price (auction)
        uint256 highestBid;
        address highestBidder;
        uint64 endTime;          // Auction end time
        uint256 swapTargetId;    // Target NFA for swap
        ListingStatus status;
    }

    uint256 private _listingIdCounter;
    mapping(uint256 => Listing) public listings;

    // Track active listing per NFA to prevent double-listing
    mapping(uint256 => uint256) public activeListingOf;

    // Pull-over-push: pending refunds for failed BNB transfers
    mapping(address => uint256) public pendingWithdrawals;

    event Listed(uint256 indexed listingId, uint256 indexed nfaId, ListingType listingType, uint256 price);
    event Purchased(uint256 indexed listingId, address indexed buyer, uint256 price, uint256 fee);
    event BidPlaced(uint256 indexed listingId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed listingId, address indexed winner, uint256 price, uint256 fee);
    event SwapAccepted(uint256 indexed listingId, uint256 indexed offeredNfaId, uint256 indexed targetNfaId);
    event ListingCancelled(uint256 indexed listingId);
    event RefundPending(address indexed recipient, uint256 amount);
    event RefundClaimed(address indexed recipient, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _nfa, address _treasury) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        nfa = IERC721(_nfa);
        treasury = _treasury;
    }

    // ============================================
    // LISTING
    // ============================================

    function listFixedPrice(uint256 nfaId, uint256 price) external returns (uint256) {
        require(nfa.ownerOf(nfaId) == msg.sender, "Not NFA owner");
        require(price > 0, "Zero price");
        require(activeListingOf[nfaId] == 0, "Already listed");

        // Transfer NFA to marketplace (escrow)
        nfa.transferFrom(msg.sender, address(this), nfaId);

        uint256 listingId = ++_listingIdCounter;
        listings[listingId] = Listing({
            nfaId: nfaId,
            seller: msg.sender,
            listingType: ListingType.FixedPrice,
            price: price,
            highestBid: 0,
            highestBidder: address(0),
            endTime: 0,
            swapTargetId: 0,
            status: ListingStatus.Active
        });
        activeListingOf[nfaId] = listingId;

        emit Listed(listingId, nfaId, ListingType.FixedPrice, price);
        return listingId;
    }

    function listAuction(uint256 nfaId, uint256 startPrice) external returns (uint256) {
        require(nfa.ownerOf(nfaId) == msg.sender, "Not NFA owner");
        require(startPrice > 0, "Zero price");
        require(activeListingOf[nfaId] == 0, "Already listed");

        nfa.transferFrom(msg.sender, address(this), nfaId);

        uint256 listingId = ++_listingIdCounter;
        listings[listingId] = Listing({
            nfaId: nfaId,
            seller: msg.sender,
            listingType: ListingType.Auction,
            price: startPrice,
            highestBid: 0,
            highestBidder: address(0),
            endTime: uint64(block.timestamp + AUCTION_DURATION),
            swapTargetId: 0,
            status: ListingStatus.Active
        });
        activeListingOf[nfaId] = listingId;

        emit Listed(listingId, nfaId, ListingType.Auction, startPrice);
        return listingId;
    }

    function listSwap(uint256 nfaId, uint256 targetNfaId) external returns (uint256) {
        require(nfa.ownerOf(nfaId) == msg.sender, "Not NFA owner");
        require(nfaId != targetNfaId, "Cannot swap with self");
        require(activeListingOf[nfaId] == 0, "Already listed");

        nfa.transferFrom(msg.sender, address(this), nfaId);

        uint256 listingId = ++_listingIdCounter;
        listings[listingId] = Listing({
            nfaId: nfaId,
            seller: msg.sender,
            listingType: ListingType.Swap,
            price: 0,
            highestBid: 0,
            highestBidder: address(0),
            endTime: 0,
            swapTargetId: targetNfaId,
            status: ListingStatus.Active
        });
        activeListingOf[nfaId] = listingId;

        emit Listed(listingId, nfaId, ListingType.Swap, 0);
        return listingId;
    }

    // ============================================
    // PURCHASE / BID / SWAP
    // ============================================

    function buyFixedPrice(uint256 listingId) external payable nonReentrant {
        Listing storage l = listings[listingId];
        require(l.status == ListingStatus.Active, "Not active");
        require(l.listingType == ListingType.FixedPrice, "Not fixed price");
        require(msg.value >= l.price, "Insufficient BNB");

        // --- Effects first (CEI pattern) ---
        l.status = ListingStatus.Sold;
        activeListingOf[l.nfaId] = 0;

        uint256 fee = l.price * FEE_BPS / 10000;
        uint256 sellerAmount = l.price - fee;
        uint256 excess = msg.value - l.price;
        uint256 nfaId = l.nfaId;
        address seller = l.seller;

        // --- Interactions ---
        // Transfer NFA to buyer
        nfa.transferFrom(address(this), msg.sender, nfaId);

        // Pay seller (pull-over-push fallback)
        (bool ok1, ) = payable(seller).call{value: sellerAmount}("");
        if (!ok1) {
            pendingWithdrawals[seller] += sellerAmount;
            emit RefundPending(seller, sellerAmount);
        }

        // Pay treasury
        (bool ok2, ) = payable(treasury).call{value: fee}("");
        if (!ok2) {
            pendingWithdrawals[treasury] += fee;
            emit RefundPending(treasury, fee);
        }

        // Refund excess to buyer
        if (excess > 0) {
            (bool ok3, ) = payable(msg.sender).call{value: excess}("");
            if (!ok3) {
                pendingWithdrawals[msg.sender] += excess;
                emit RefundPending(msg.sender, excess);
            }
        }

        emit Purchased(listingId, msg.sender, l.price, fee);
    }

    function bid(uint256 listingId) external payable nonReentrant {
        Listing storage l = listings[listingId];
        require(l.status == ListingStatus.Active, "Not active");
        require(l.listingType == ListingType.Auction, "Not auction");
        require(block.timestamp < l.endTime, "Auction ended");

        uint256 minBid;
        if (l.highestBid == 0) {
            minBid = l.price;
        } else {
            minBid = l.highestBid + (l.highestBid * MIN_BID_INCREMENT_BPS / 10000);
        }
        require(msg.value >= minBid, "Bid too low");

        // Refund previous bidder (pull-over-push fallback)
        address prevBidder = l.highestBidder;
        uint256 prevBid = l.highestBid;

        l.highestBid = msg.value;
        l.highestBidder = msg.sender;

        if (prevBidder != address(0)) {
            (bool ok, ) = payable(prevBidder).call{value: prevBid}("");
            if (!ok) {
                pendingWithdrawals[prevBidder] += prevBid;
                emit RefundPending(prevBidder, prevBid);
            }
        }

        emit BidPlaced(listingId, msg.sender, msg.value);
    }

    function settleAuction(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.status == ListingStatus.Active, "Not active");
        require(l.listingType == ListingType.Auction, "Not auction");
        require(block.timestamp >= l.endTime, "Auction not ended");

        l.status = ListingStatus.Sold;
        activeListingOf[l.nfaId] = 0;

        if (l.highestBidder == address(0)) {
            // No bids — return NFA to seller
            nfa.transferFrom(address(this), l.seller, l.nfaId);
            emit ListingCancelled(listingId);
            return;
        }

        uint256 fee = l.highestBid * FEE_BPS / 10000;
        uint256 sellerAmount = l.highestBid - fee;
        address winner = l.highestBidder;
        address seller = l.seller;
        uint256 nfaId = l.nfaId;

        nfa.transferFrom(address(this), winner, nfaId);

        (bool ok1, ) = payable(seller).call{value: sellerAmount}("");
        if (!ok1) {
            pendingWithdrawals[seller] += sellerAmount;
            emit RefundPending(seller, sellerAmount);
        }

        (bool ok2, ) = payable(treasury).call{value: fee}("");
        if (!ok2) {
            pendingWithdrawals[treasury] += fee;
            emit RefundPending(treasury, fee);
        }

        emit AuctionSettled(listingId, winner, l.highestBid, fee);
    }

    function acceptSwap(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.status == ListingStatus.Active, "Not active");
        require(l.listingType == ListingType.Swap, "Not swap");
        require(nfa.ownerOf(l.swapTargetId) == msg.sender, "Not target owner");

        l.status = ListingStatus.Sold;
        activeListingOf[l.nfaId] = 0;

        // Transfer target NFA from acceptor to seller
        nfa.transferFrom(msg.sender, l.seller, l.swapTargetId);
        // Transfer listed NFA from escrow to acceptor
        nfa.transferFrom(address(this), msg.sender, l.nfaId);

        emit SwapAccepted(listingId, l.nfaId, l.swapTargetId);
    }

    // ============================================
    // CANCEL
    // ============================================

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.status == ListingStatus.Active, "Not active");
        require(l.seller == msg.sender, "Not seller");

        // For auctions, can only cancel if no bids
        if (l.listingType == ListingType.Auction) {
            require(l.highestBidder == address(0), "Has bids");
        }

        l.status = ListingStatus.Cancelled;
        activeListingOf[l.nfaId] = 0;

        // Return NFA to seller
        nfa.transferFrom(address(this), l.seller, l.nfaId);

        emit ListingCancelled(listingId);
    }

    // ============================================
    // VIEW
    // ============================================

    // ============================================
    // PULL-OVER-PUSH REFUND
    // ============================================

    /**
     * @dev Claim any pending BNB refunds (from failed transfers).
     */
    function claimRefund() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending refund");
        pendingWithdrawals[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Refund transfer failed");
        emit RefundClaimed(msg.sender, amount);
    }

    // ============================================
    // VIEW
    // ============================================

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev Reserved storage gap for future upgrades.
     */
    uint256[40] private __gap;
}
