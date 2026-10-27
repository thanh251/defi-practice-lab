// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import '../vendor/solidity/openzeppelin/token/ERC20/ERC20.sol';
import '../vendor/solidity/openzeppelin/access/Ownable.sol';
contract LabToken is ERC20, Ownable {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}
    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }
}
