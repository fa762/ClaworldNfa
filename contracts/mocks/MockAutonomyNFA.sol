// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockAutonomyNFA {
    mapping(uint256 => address) private _owners;

    function mint(address to, uint256 tokenId) external {
        require(to != address(0), "Invalid recipient");
        require(_owners[tokenId] == address(0), "Already minted");
        _owners[tokenId] = to;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }
}
