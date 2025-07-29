import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    xfitestnet: {
      url: "https://rpc.testnet.ms", // Update with your RPC
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
  etherscan: {
    apiKey: {
      xfitestnet: process.env.ETHERSCAN_API_KEY!, // or explorer API name here
    },
  },
};

export default config;
