// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IClawAutonomyDelegationRegistryView {
    struct DelegationLease {
        bool enabled;
        uint8 roleMask;
        uint64 issuedAt;
        uint64 expiresAt;
    }

    function getDelegationLease(
        uint256 nfaId,
        uint8 actionKind,
        address operator
    ) external view returns (DelegationLease memory lease);

    function hasActiveLease(
        uint256 nfaId,
        uint8 actionKind,
        address operator,
        uint8 roleMask
    ) external view returns (bool);
}
