"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  Droplets,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  FAUCET_CONTRACT_ADDRESS,
  TOKEN_CONTRACT_ADDRESS,
  EXPECTED_NETWORK_ID,
  NETWORK_NAME,
  BLOCK_EXPLORER,
  FAUCET_ABI,
  TOKEN_ABI,
} from "@/lib/addressAndAbi";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethers?: any;
  }
}

const TokenFaucet = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [recipientAddress, setRecipientAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [timeUntilNext, setTimeUntilNext] = useState(0);
  const [faucetStats, setFaucetStats] = useState({
    totalRequests: 0,
    remainingTokens: 0,
    tokenSymbol: "XFI",
    claimableAmount: 0,
    faucetBalance: 0,
    totalTokensDistributed: 0,
    cooldownTime: 0,
    maxTokensPerDay: 0,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [provider, setProvider] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [signer, setSigner] = useState<any>(null);
  const [networkId, setNetworkId] = useState<number | null>(null);
  const [userCanRequest, setUserCanRequest] = useState<{
    canRequest: boolean;
    reason: string;
  }>({ canRequest: true, reason: "" });

  const faucetContractAddress = FAUCET_CONTRACT_ADDRESS;
  const faucetAbi = FAUCET_ABI;
  const tokenContractAddress = TOKEN_CONTRACT_ADDRESS;
  const tokenAbi = TOKEN_ABI;
  const expectedNetworkId = EXPECTED_NETWORK_ID;
  const networkName = NETWORK_NAME;
  const blockExplorer = BLOCK_EXPLORER;

  // Initialize Web3 connection
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const initProvider = async () => {
        try {
          // Load ethers from CDN if not available
          if (!window.ethers) {
            const script = document.createElement("script");
            script.src =
              "https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.umd.min.js";
            document.head.appendChild(script);

            script.onload = () => {
              initializeProvider();
            };
          } else {
            initializeProvider();
          }
        } catch (error) {
          console.error("Failed to load ethers:", error);
        }
      };

      const initializeProvider = async () => {
        try {
          const web3Provider = new window.ethers.providers.Web3Provider(
            window.ethereum
          );
          setProvider(web3Provider);

          // Check if already connected
          const accounts = await web3Provider.listAccounts();
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            setRecipientAddress(accounts[0]);
            setIsConnected(true);
            setSigner(web3Provider.getSigner());

            const network = await web3Provider.getNetwork();
            setNetworkId(network.chainId);
          }
        } catch (error) {
          console.error("Failed to initialize provider:", error);
        }
      };

      initProvider();
    }
  }, []);

  // Load contract data
  const loadContractData = useCallback(async () => {
    if (!provider || !window.ethers) return;

    try {
      const faucetContract = new window.ethers.Contract(
        faucetContractAddress,
        faucetAbi,
        provider
      );
      const tokenContract = new window.ethers.Contract(
        tokenContractAddress,
        tokenAbi,
        provider
      );

      // Get faucet stats using the correct ABI functions
      const [
        totalRequests,
        tokensPerRequest,
        totalTokensDistributed,
        cooldownTime,
        maxTokensPerDay,
        tokenSymbol,
        faucetBalance,
        decimals,
      ] = await Promise.all([
        faucetContract.totalRequests(),
        faucetContract.tokensPerRequest(),
        faucetContract.totalTokensDistributed(),
        faucetContract.cooldownTime(),
        faucetContract.maxTokensPerDay(),
        tokenContract.symbol(),
        tokenContract.balanceOf(faucetContractAddress),
        tokenContract.decimals(),
      ]);

      const formattedClaimable = window.ethers.utils.formatUnits(
        tokensPerRequest,
        decimals
      );
      const formattedBalance = window.ethers.utils.formatUnits(
        faucetBalance,
        decimals
      );
      const formattedDistributed = window.ethers.utils.formatUnits(
        totalTokensDistributed,
        decimals
      );
      const formattedMaxPerDay = window.ethers.utils.formatUnits(
        maxTokensPerDay,
        decimals
      );

      setFaucetStats({
        totalRequests: totalRequests.toNumber(),
        claimableAmount: parseFloat(formattedClaimable),
        totalTokensDistributed: parseFloat(formattedDistributed),
        cooldownTime: cooldownTime.toNumber(),
        maxTokensPerDay: parseFloat(formattedMaxPerDay),
        tokenSymbol,
        faucetBalance: parseFloat(formattedBalance),
        remainingTokens: parseFloat(formattedBalance),
      });
    } catch (error) {
      console.error("Error loading contract data:", error);
      setError(
        "Failed to load contract data. Please check contract addresses."
      );
    }
  }, [
    provider,
    faucetContractAddress,
    faucetAbi,
    tokenContractAddress,
    tokenAbi,
  ]);

  // Check user request eligibility
  const checkUserCooldown = useCallback(async () => {
    if (!provider || !walletAddress || !window.ethers) return;

    try {
      const faucetContract = new window.ethers.Contract(
        faucetContractAddress,
        faucetAbi,
        provider
      );

      // Check if user can request tokens
      const [canRequest, reason] = await faucetContract.canUserRequest(
        walletAddress
      );
      setUserCanRequest({ canRequest, reason });

      // Get remaining cooldown time
      const remainingCooldown = await faucetContract.getRemainingCooldown(
        walletAddress
      );
      setTimeUntilNext(remainingCooldown.toNumber());
    } catch (error) {
      console.error("Error checking cooldown:", error);
    }
  }, [provider, walletAddress, faucetContractAddress, faucetAbi]);

  // Load contract data effect
  useEffect(() => {
    if (
      provider &&
      isConnected &&
      networkId === expectedNetworkId &&
      window.ethers
    ) {
      loadContractData();
      checkUserCooldown();
    }
  }, [
    provider,
    isConnected,
    walletAddress,
    networkId,
    expectedNetworkId,
    checkUserCooldown,
    loadContractData,
  ]);

  // Timer for cooldown
  useEffect(() => {
    if (timeUntilNext > 0) {
      const timer = setTimeout(() => setTimeUntilNext(timeUntilNext - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeUntilNext]);

  // Connect wallet function
  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === "undefined") {
        setError("Please install MetaMask or another Web3 wallet");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!window.ethers) {
        setError("Web3 library not loaded. Please refresh the page.");
        return;
      }

      const web3Provider = new window.ethers.providers.Web3Provider(
        window.ethereum
      );
      const network = await web3Provider.getNetwork();

      if (network.chainId !== expectedNetworkId) {
        setError(
          `Please switch to ${networkName} network (Chain ID: ${expectedNetworkId})`
        );
        return;
      }

      setProvider(web3Provider);
      setSigner(web3Provider.getSigner());
      setWalletAddress(accounts[0]);
      setRecipientAddress(accounts[0]);
      setIsConnected(true);
      setNetworkId(network.chainId);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to connect wallet");
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setWalletAddress("");
    setRecipientAddress("");
    setIsConnected(false);
    setSigner(null);
    setNetworkId(null);
  };

  // Request tokens from smart contract
  const requestTokens = async () => {
    if (!signer || !window.ethers) {
      setError("Please connect wallet");
      return;
    }

    if (!userCanRequest.canRequest) {
      setError(userCanRequest.reason);
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");
    setTxHash("");

    try {
      const faucetContract = new window.ethers.Contract(
        faucetContractAddress,
        faucetAbi,
        signer
      );

      // Estimate gas first
      const gasEstimate = await faucetContract.estimateGas.requestTokens();
      const gasLimit = gasEstimate.mul(120).div(100); // Add 20% buffer

      // Call the requestTokens function (no parameters needed based on ABI)
      const tx = await faucetContract.requestTokens({
        gasLimit: gasLimit,
      });

      setTxHash(tx.hash);
      setSuccess("Transaction submitted! Waiting for confirmation...");

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setSuccess(
          `Successfully received ${faucetStats.claimableAmount} ${faucetStats.tokenSymbol} tokens!`
        );

        // Refresh contract data and cooldown
        await loadContractData();
        await checkUserCooldown();
      } else {
        setError("Transaction failed");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Transaction error:", error);

      if (error.code === 4001) {
        setError("Transaction cancelled by user");
      } else if (error.message?.includes("insufficient funds")) {
        setError("Insufficient ETH for gas fees");
      } else if (error.message?.includes("CooldownActive")) {
        setError(
          "You are still in cooldown period. Please wait before requesting again."
        );
      } else if (error.message?.includes("DailyLimitExceeded")) {
        setError("Daily limit exceeded. Please try again tomorrow.");
      } else if (error.message?.includes("InsufficientFaucetBalance")) {
        setError(
          "Faucet has insufficient balance. Please contact administrator."
        );
      } else if (error.message?.includes("revert")) {
        setError("Transaction reverted. Please check the error message.");
      } else {
        setError("Transaction failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Get user's daily usage
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getUserDailyUsage = useCallback(async () => {
    if (!provider || !walletAddress || !window.ethers) return null;

    try {
      const faucetContract = new window.ethers.Contract(
        faucetContractAddress,
        faucetAbi,
        provider
      );
      const [requested, remaining] = await faucetContract.getDailyUsage(
        walletAddress
      );

      const decimals = 18; // Assuming 18 decimals, you might want to get this from token contract
      return {
        requested: parseFloat(
          window.ethers.utils.formatUnits(requested, decimals)
        ),
        remaining: parseFloat(
          window.ethers.utils.formatUnits(remaining, decimals)
        ),
      };
    } catch (error) {
      console.error("Error getting daily usage:", error);
      return null;
    }
  }, [provider, walletAddress, faucetContractAddress, faucetAbi]);

  // Format time helper
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Format number for display
  const formatNumber = (num: number) => {
    return parseFloat(num.toString()).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Background Effects */}
      <div className='absolute inset-0 bg-[url(&apos;data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.1"%3E%3Ccircle cx="30" cy="30" r="2"/&gt;%3C/g%3E%3C/g%3E%3C/svg%3E&apos;)] opacity-20'></div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-4">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-full shadow-2xl">
              <Image
                src="/Vector - 1.png"
                alt="Logo"
                width={100}
                height={100}
                className="w-8 h-8"
              />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text">
            {faucetStats.tokenSymbol} Faucet
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Get free {faucetStats.tokenSymbol} tokens for testing and
            development. Request up to {faucetStats.claimableAmount} tokens with
            a {formatTime(faucetStats.cooldownTime)} cooldown.
          </p>
        </div>

        {/* Network Warning */}
        {isConnected && networkId !== expectedNetworkId && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-xl p-4 flex items-center">
              <AlertCircle className="w-5 h-5 text-yellow-400 mr-3 flex-shrink-0" />
              <span className="text-yellow-400">
                Please switch to {networkName} network (Chain ID:{" "}
                {expectedNetworkId}) to use this faucet
              </span>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 text-sm">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-1">
                {formatNumber(faucetStats.totalRequests)}
              </div>
              <div className="text-gray-300">Total Requests</div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-1">
                {formatNumber(faucetStats.faucetBalance)}
              </div>
              <div className="text-gray-300">Faucet Balance</div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-1">
                {formatNumber(faucetStats.claimableAmount)}
              </div>
              <div className="text-gray-300">Tokens per Request</div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-1">
                {formatNumber(faucetStats.totalTokensDistributed)}
              </div>
              <div className="text-gray-300">Total Distributed</div>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
            {/* Wallet Connection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  <Wallet className="w-6 h-6 mr-2" />
                  Wallet Connection
                </h2>
                {isConnected && (
                  <button
                    onClick={loadContractData}
                    className="text-gray-300 hover:text-white transition-colors p-2"
                    title="Refresh data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!isConnected ? (
                <button
                  onClick={connectWallet}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium py-3 px-6 rounded-xl transition duration-300 transform hover:scale-105 shadow-lg"
                >
                  Connect Wallet
                </button>
              ) : (
                <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-green-400 font-medium mb-1">
                        Connected to {networkName}
                      </div>
                      <div className="text-white font-mono text-sm">
                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                      </div>
                    </div>
                    <button
                      onClick={disconnectWallet}
                      className="text-gray-300 hover:text-white transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Request Form */}
            {isConnected && networkId === expectedNetworkId && (
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-white mb-2">
                  Request Tokens
                </h2>
                <div className="space-y-3">
                  {/* User Status */}
                  {!userCanRequest.canRequest && (
                    <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-xl p-3">
                      <p className="text-yellow-400 text-sm">
                        {userCanRequest.reason}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={requestTokens}
                    disabled={isLoading || !userCanRequest.canRequest}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg flex items-center justify-center"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Processing Transaction...
                      </>
                    ) : timeUntilNext > 0 ? (
                      <>
                        <Clock className="w-5 h-5 mr-2" />
                        Wait {formatTime(timeUntilNext)}
                      </>
                    ) : (
                      <>
                        <Droplets className="w-5 h-5 mr-2" />
                        Request {faucetStats.claimableAmount}{" "}
                        {faucetStats.tokenSymbol} Tokens
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Status Messages */}

            {success && (
              <div className="mb-6 bg-green-500/20 border border-green-400/30 rounded-xl p-4">
                <div className="flex items-center ">
                  <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
                  <span className="text-green-400 font-medium text-sm">
                    {success}
                  </span>
                </div>
                {txHash && (
                  <div className="mt-2 p-3 bg-black/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm">
                        Transaction Hash:
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => copyToClipboard(txHash)}
                          className="text-gray-400 hover:text-white transition-colors"
                          title="Copy transaction hash"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <Link
                          href={`${blockExplorer}/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-white transition-colors"
                          title="View on block explorer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                    <div className="text-white font-mono text-sm mt-1 break-all">
                      {txHash}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rate Limiting Info */}
            <div className="text-center text-gray-400 text-xs">
              <p>• Maximum {faucetStats.claimableAmount} tokens per request</p>
              <p>• Maximum {faucetStats.maxTokensPerDay} tokens per day</p>
              <p>• Cooldown period: {formatTime(faucetStats.cooldownTime)}</p>
              <p>• Powered by smart contract on {networkName}</p>
              {(faucetContractAddress as string) !== "0x..." && (
                <p className="font-mono text-xs mt-2">
                  Contract: {faucetContractAddress}
                </p>
              )}
            </div>
            <div className="text-center text-sm">
              <p>
                Import the custom token address into your Metamask to veiw the custom
                token balance
              </p>
              {(TOKEN_CONTRACT_ADDRESS as string) !== "0x..." && (
                <p className="font-semibold text-white">
                  Token contract address: {TOKEN_CONTRACT_ADDRESS}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-gray-400">
          <p>Decentralized Faucet • Powered by XFI</p>
        </div>
      </div>
    </div>
  );
};

export default TokenFaucet;
