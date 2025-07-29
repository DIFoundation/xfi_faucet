import { ethers } from "hardhat";

async function main() {
  const recipient = "0xF321b818669d56C8f11b3617429cD987c745B0D2";
  const amountPerRequest = ethers.parseEther("10"); // 10 * 10**18
  const cooldown = 86400; // 1 day
  const maxPerUser = ethers.parseEther("10"); // 10 * 10**18

  const Faucet = await ethers.getContractFactory("XFIFaucet");
  const faucet = await Faucet.deploy(recipient, amountPerRequest, cooldown, maxPerUser);

  await faucet.waitForDeployment();

  console.log("Faucet deployed to:", await faucet.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
