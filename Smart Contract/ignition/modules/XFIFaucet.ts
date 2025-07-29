import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const XFIFaucetModule = buildModule("XFIFaucetModule", (m) => {
  const recipient = "0xF321b818669d56C8f11b3617429cD987c745B0D2";
  const amountPerRequest = m.getParameter("amountPerRequest", 10n * 10n ** 18n);
  const cooldown = m.getParameter("cooldown", 86400);
  const maxPerUser = m.getParameter("maxPerUser", 10n * 10n ** 18n);

  const xFIFaucet = m.contract("XFIFaucet", [recipient, amountPerRequest, cooldown, maxPerUser]);

  return { xFIFaucet };
});

export default XFIFaucetModule;
