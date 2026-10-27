// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import '../vendor/solidity/openzeppelin/access/Ownable.sol';
import '../vendor/solidity/openzeppelin/security/ReentrancyGuard.sol';
import '../vendor/solidity/openzeppelin/token/ERC20/utils/SafeERC20.sol';
import '../vendor/solidity/aave-v3/flashloan/base/FlashLoanSimpleReceiverBase.sol';
interface IV2Router {
    function swapExactTokensForTokens(uint256,uint256,address[] calldata,address,uint256) external returns (uint256[] memory);
}
/// @notice Lab strategy: borrow A, swap A/B on router1, then B/A on router2.
contract FlashSwapReceiver is FlashLoanSimpleReceiverBase, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public immutable router1;
    address public immutable router2;
    bool private active;
    bytes32 private pending;
    uint256 private startingBalance;
    event FlashCompleted(address indexed asset, uint256 amount, uint256 premium, uint256 profit);
    constructor(address provider, address firstRouter, address secondRouter)
        FlashLoanSimpleReceiverBase(IPoolAddressesProvider(provider)) {
        router1 = firstRouter;
        router2 = secondRouter;
    }
    function start(address asset, uint256 amount, address intermediate, uint256 minFirst,
        uint256 minSecond, uint256 minProfit, uint256 deadline) external onlyOwner nonReentrant {
        require(amount > 0 && asset != intermediate, 'INVALID_ASSETS');
        require(deadline >= block.timestamp, 'EXPIRED');
        bytes memory params = abi.encode(intermediate, minFirst, minSecond, minProfit, deadline);
        startingBalance = IERC20(asset).balanceOf(address(this));
        pending = keccak256(abi.encode(asset, amount, params));
        active = true;
        POOL.flashLoanSimple(address(this), asset, amount, params, 0);
        active = false;
        pending = bytes32(0);
    }
    function executeOperation(address asset, uint256 amount, uint256 premium,
        address initiator, bytes calldata params) external override returns (bool) {
        require(msg.sender == address(POOL), 'ONLY_POOL');
        require(initiator == address(this) && active, 'INVALID_INITIATOR');
        require(pending == keccak256(abi.encode(asset, amount, params)), 'INVALID_REQUEST');
        // Consume request before external calls; start() keeps its reentrancy lock.
        active = false;
        (address intermediate, uint256 minFirst, uint256 minSecond, uint256 minProfit, uint256 deadline)
            = abi.decode(params, (address,uint256,uint256,uint256,uint256));
        address[] memory path = new address[](2);
        path[0] = asset; path[1] = intermediate;
        uint256 beforeIntermediate = IERC20(intermediate).balanceOf(address(this));
        IERC20(asset).forceApprove(router1, amount);
        IV2Router(router1).swapExactTokensForTokens(amount, minFirst, path, address(this), deadline);
        IERC20(asset).forceApprove(router1, 0);
        uint256 received = IERC20(intermediate).balanceOf(address(this)) - beforeIntermediate;
        path[0] = intermediate; path[1] = asset;
        IERC20(intermediate).forceApprove(router2, received);
        IV2Router(router2).swapExactTokensForTokens(received, minSecond, path, address(this), deadline);
        IERC20(intermediate).forceApprove(router2, 0);
        uint256 balance = IERC20(asset).balanceOf(address(this));
        uint256 debt = amount + premium;
        require(balance >= startingBalance + debt + minProfit, 'NO_PROFIT');
        IERC20(asset).forceApprove(address(POOL), debt);
        emit FlashCompleted(asset, amount, premium, balance - startingBalance - debt);
        return true;
    }
    function withdraw(address token, uint256 amount) external onlyOwner nonReentrant {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
