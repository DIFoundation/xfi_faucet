// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title XFIFaucet
 * @dev A faucet contract for distributing XFI tokens with rate limiting and anti-spam features
 */
contract XFIFaucet is Ownable, ReentrancyGuard, Pausable {
    IERC20 public immutable xfiToken;
    
    // Faucet configuration
    uint256 public tokensPerRequest;
    uint256 public cooldownTime;
    uint256 public maxTokensPerDay;
    uint256 public minTokenBalance;
    
    // Rate limiting
    mapping(address => uint256) public nextRequestTime;
    mapping(address => uint256) public dailyRequested;
    mapping(address => uint256) public lastRequestDay;
    
    // Statistics
    uint256 public totalRequests;
    uint256 public totalTokensDistributed;
    
    // Events
    event TokensRequested(address indexed user, uint256 amount);
    event FaucetConfigUpdated(uint256 tokensPerRequest, uint256 cooldownTime, uint256 maxTokensPerDay);
    event TokensWithdrawn(address indexed owner, uint256 amount);
    event TokensDeposited(address indexed depositor, uint256 amount);
    
    // Custom errors
    error InsufficientFaucetBalance();
    error CooldownActive(uint256 timeRemaining);
    error DailyLimitExceeded(uint256 currentLimit);
    error InvalidAmount();
    error InvalidAddress();
    error TransferFailed();
    
    /**
     * @dev Constructor to initialize the faucet
     * @param _xfiToken Address of the XFI token contract
     * @param _tokensPerRequest Amount of tokens per request (in wei)
     * @param _cooldownTime Cooldown time between requests (in seconds)
     * @param _maxTokensPerDay Maximum tokens per address per day (in wei)
     */
    constructor(
        address _xfiToken,
        uint256 _tokensPerRequest,
        uint256 _cooldownTime,
        uint256 _maxTokensPerDay
    ) {
        if (_xfiToken == address(0)) revert InvalidAddress();
        
        xfiToken = IERC20(_xfiToken);
        tokensPerRequest = _tokensPerRequest;
        cooldownTime = _cooldownTime;
        maxTokensPerDay = _maxTokensPerDay;
        minTokenBalance = _tokensPerRequest; // Minimum balance to keep faucet operational
    }
    
    /**
     * @dev Request tokens from the faucet
     * Requirements:
     * - Cooldown period must have passed
     * - Daily limit not exceeded
     * - Faucet must have sufficient balance
     */
    function requestTokens() external nonReentrant whenNotPaused {
        address user = msg.sender;
        uint256 currentTime = block.timestamp;
        uint256 currentDay = currentTime / 1 days;
        
        // Check cooldown
        if (currentTime < nextRequestTime[user]) {
            revert CooldownActive(nextRequestTime[user] - currentTime);
        }
        
        // Reset daily counter if new day
        if (lastRequestDay[user] < currentDay) {
            dailyRequested[user] = 0;
            lastRequestDay[user] = currentDay;
        }
        
        // Check daily limit
        if (dailyRequested[user] + tokensPerRequest > maxTokensPerDay) {
            revert DailyLimitExceeded(maxTokensPerDay - dailyRequested[user]);
        }
        
        // Check faucet balance
        uint256 faucetBalance = xfiToken.balanceOf(address(this));
        if (faucetBalance < tokensPerRequest) {
            revert InsufficientFaucetBalance();
        }
        
        // Update user state
        nextRequestTime[user] = currentTime + cooldownTime;
        dailyRequested[user] += tokensPerRequest;
        
        // Update statistics
        totalRequests++;
        totalTokensDistributed += tokensPerRequest;
        
        // Transfer tokens
        bool success = xfiToken.transfer(user, tokensPerRequest);
        if (!success) revert TransferFailed();
        
        emit TokensRequested(user, tokensPerRequest);
    }
    
    /**
     * @dev Get the next request time for a user
     * @param user Address of the user
     * @return Next timestamp when user can request tokens
     */
    function getNextRequestTime(address user) external view returns (uint256) {
        return nextRequestTime[user];
    }
    
    /**
     * @dev Get remaining cooldown time for a user
     * @param user Address of the user
     * @return Remaining seconds until next request
     */
    function getRemainingCooldown(address user) external view returns (uint256) {
        uint256 nextRequest = nextRequestTime[user];
        if (nextRequest <= block.timestamp) {
            return 0;
        }
        return nextRequest - block.timestamp;
    }
    
    /**
     * @dev Get daily usage for a user
     * @param user Address of the user
     * @return requested Amount requested today
     * @return remaining Amount remaining for today
     */
    function getDailyUsage(address user) external view returns (uint256 requested, uint256 remaining) {
        uint256 currentDay = block.timestamp / 1 days;
        
        if (lastRequestDay[user] < currentDay) {
            // New day, reset counters
            requested = 0;
        } else {
            requested = dailyRequested[user];
        }
        
        remaining = maxTokensPerDay > requested ? maxTokensPerDay - requested : 0;
    }
    
    /**
     * @dev Check if user can request tokens
     * @param user Address of the user
     * @return canRequest Whether user can request
     * @return reason Reason if cannot request
     */
    function canUserRequest(address user) external view returns (bool canRequest, string memory reason) {
        // Check cooldown
        if (block.timestamp < nextRequestTime[user]) {
            return (false, "Cooldown active");
        }
        
        // Check daily limit
        uint256 currentDay = block.timestamp / 1 days;
        uint256 dailyUsed = lastRequestDay[user] < currentDay ? 0 : dailyRequested[user];
        
        if (dailyUsed + tokensPerRequest > maxTokensPerDay) {
            return (false, "Daily limit exceeded");
        }
        
        // Check faucet balance
        if (xfiToken.balanceOf(address(this)) < tokensPerRequest) {
            return (false, "Insufficient faucet balance");
        }
        
        // Check if paused
        if (paused()) {
            return (false, "Faucet is paused");
        }
        
        return (true, "");
    }
    
    /**
     * @dev Get faucet statistics
     * @return balance Current faucet token balance
     * @return requests Total number of requests processed
     * @return distributed Total tokens distributed
     * @return perRequest Tokens given per request
     */
    function getFaucetStats() external view returns (
        uint256 balance,
        uint256 requests,
        uint256 distributed,
        uint256 perRequest
    ) {
        return (
            xfiToken.balanceOf(address(this)),
            totalRequests,
            totalTokensDistributed,
            tokensPerRequest
        );
    }
    
    // Owner functions
    
    /**
     * @dev Update faucet configuration (Owner only)
     * @param _tokensPerRequest New tokens per request
     * @param _cooldownTime New cooldown time
     * @param _maxTokensPerDay New daily limit
     */
    function updateFaucetConfig(
        uint256 _tokensPerRequest,
        uint256 _cooldownTime,
        uint256 _maxTokensPerDay
    ) external onlyOwner {
        if (_tokensPerRequest == 0) revert InvalidAmount();
        
        tokensPerRequest = _tokensPerRequest;
        cooldownTime = _cooldownTime;
        maxTokensPerDay = _maxTokensPerDay;
        minTokenBalance = _tokensPerRequest;
        
        emit FaucetConfigUpdated(_tokensPerRequest, _cooldownTime, _maxTokensPerDay);
    }
    
    /**
     * @dev Withdraw tokens from faucet (Owner only)
     * @param amount Amount to withdraw (0 = withdraw all)
     */
    function withdrawTokens(uint256 amount) external onlyOwner {
        uint256 faucetBalance = xfiToken.balanceOf(address(this));
        
        if (amount == 0) {
            amount = faucetBalance;
        }
        
        if (amount > faucetBalance) revert InsufficientFaucetBalance();
        
        bool success = xfiToken.transfer(owner(), amount);
        if (!success) revert TransferFailed();
        
        emit TokensWithdrawn(owner(), amount);
    }
    
    /**
     * @dev Deposit tokens to faucet
     * @param amount Amount to deposit
     * Note: Caller must approve this contract to spend tokens first
     */
    function depositTokens(uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        
        bool success = xfiToken.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
        
        emit TokensDeposited(msg.sender, amount);
    }
    
    /**
     * @dev Emergency withdrawal of all tokens (Owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = xfiToken.balanceOf(address(this));
        if (balance > 0) {
            bool success = xfiToken.transfer(owner(), balance);
            if (!success) revert TransferFailed();
            emit TokensWithdrawn(owner(), balance);
        }
    }
    
    /**
     * @dev Pause the faucet (Owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the faucet (Owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Reset user cooldown (Owner only) - for emergency use
     * @param user Address of the user
     */
    function resetUserCooldown(address user) external onlyOwner {
        nextRequestTime[user] = 0;
    }
    
    /**
     * @dev Get contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}