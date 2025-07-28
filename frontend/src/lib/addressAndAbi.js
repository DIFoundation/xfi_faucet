export const FAUCET_CONTRACT_ADDRESS = "0x..."; // Your faucet contract address
export const FAUCET_ABI = [
    "function requestTokens() external",
    "function getNextRequestTime(address user) external view returns (uint256)",
    "function tokensPerRequest() external view returns (uint256)",
    "function totalRequests() external view returns (uint256)",
    "function getClaimableAmount() external view returns (uint256)",
    "event TokensRequested(address indexed user, uint256 amount)"
  ];

export const TOKEN_CONTRACT_ADDRESS = "0x...";  // Your XFI token contract address
export const TOKEN_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)"
  ];

export const EXPECTED_NETWORK_ID = 4157; // Change to your network (1 = Ethereum, 137 = Polygon, etc.)
export const NETWORK_NAME = "XFI Testnet"; // Update to your network name
export const BLOCK_EXPLORER = "https://test.xfiscan.com";

