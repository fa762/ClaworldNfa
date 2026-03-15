// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockCLW
 * @dev Test ERC-20 token for local development. Anyone can mint.
 */
contract MockCLW is ERC20 {
    constructor() ERC20("Claw Token", "CLW") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
