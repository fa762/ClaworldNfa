/**
 * Diagnose why ownerMint reverts.
 * Usage: node scripts/diagnose-mint.mjs
 */
import pkg from "ethers";
const { providers, Wallet, Contract } = pkg;

const RPC_URL = "https://bsc-testnet-rpc.publicnode.com";
const PRIVATE_KEY = "0xfe1d20174ddd8f0c5ae97725742dad6086f513c108c9669f8be80c960d7d8c78";

const NFA_ADDRESS = "0x1c69be3401a78CFeDC2B2543E62877874f10B135";
const ROUTER_ADDRESS = "0xA7Ee12C5E9435686978F4b87996B4Eb461c34603";
const VAULT_ADDRESS = "0x6d176022759339da787fD3E2f1314019C3fb7867";

const NFA_ABI = [
  "function paused() view returns (bool)",
  "function minter() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function setPaused(bool) external",
];

const ROUTER_ABI = [
  "function minter() view returns (address)",
  "function authorizedSkills(address) view returns (bool)",
  "function worldState() view returns (address)",
];

const VAULT_ABI = [
  "function mintingActive() view returns (bool)",
  "function mintedCount() view returns (uint256)",
  "function owner() view returns (address)",
  "function nfa() view returns (address)",
  "function router() view returns (address)",
  "function getRarityMinted() view returns (uint256[5])",
  "function ownerMint(uint8 rarity, address recipient) external",
];

async function main() {
  const provider = new providers.JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  console.log("Wallet:", wallet.address);

  const nfa = new Contract(NFA_ADDRESS, NFA_ABI, wallet);
  const router = new Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
  const vault = new Contract(VAULT_ADDRESS, VAULT_ABI, wallet);

  console.log("\n=== GenesisVault State ===");
  const vaultOwner = await vault.owner();
  const mintingActive = await vault.mintingActive();
  const mintedCount = await vault.mintedCount();
  const vaultNfa = await vault.nfa();
  const vaultRouter = await vault.router();
  const rarityMinted = await vault.getRarityMinted();

  console.log(`owner()         = ${vaultOwner}`);
  console.log(`  is wallet?      ${vaultOwner.toLowerCase() === wallet.address.toLowerCase() ? "YES" : "NO <-- wallet is NOT owner!"}`);
  console.log(`mintingActive() = ${mintingActive}`);
  console.log(`mintedCount()   = ${mintedCount.toString()} / 888`);
  console.log(`nfa()           = ${vaultNfa}`);
  console.log(`  matches?        ${vaultNfa.toLowerCase() === NFA_ADDRESS.toLowerCase() ? "YES" : "NO <-- MISMATCH"}`);
  console.log(`router()        = ${vaultRouter}`);
  console.log(`  matches?        ${vaultRouter.toLowerCase() === ROUTER_ADDRESS.toLowerCase() ? "YES" : "NO <-- MISMATCH"}`);
  console.log(`rarityMinted    = [${rarityMinted.map(r => r.toString()).join(", ")}]`);
  console.log(`  caps            = [860, 17, 6, 4, 1]`);

  console.log("\n=== ClawNFA State ===");
  const nfaPaused = await nfa.paused();
  const nfaMinter = await nfa.minter();
  const totalSupply = await nfa.totalSupply();

  console.log(`paused()      = ${nfaPaused}${nfaPaused ? " <-- THIS WILL CAUSE REVERT!" : ""}`);
  console.log(`minter()      = ${nfaMinter}`);
  console.log(`totalSupply() = ${totalSupply.toString()}`);

  console.log("\n=== ClawRouter State ===");
  const routerMinter = await router.minter();
  const isSkill = await router.authorizedSkills(VAULT_ADDRESS);
  const worldState = await router.worldState();

  console.log(`minter()                    = ${routerMinter}`);
  console.log(`authorizedSkills(vault)     = ${isSkill}`);
  console.log(`worldState()                = ${worldState}`);
  console.log(`  is zero?                    ${worldState === "0x0000000000000000000000000000000000000000" ? "YES <-- might cause revert" : "NO"}`);

  // --- Try simulate ---
  console.log("\n=== Simulating ownerMint(0, wallet) ===");
  try {
    await vault.callStatic.ownerMint(0, wallet.address);
    console.log("SUCCESS - simulation passed!");
  } catch (err) {
    console.log("REVERTED:", err.reason || err.message);
  }

  // --- Auto-fix: unpause if needed ---
  if (nfaPaused) {
    console.log("\n-> NFA is paused. Attempting to unpause...");
    try {
      const tx = await nfa.setPaused(false);
      await tx.wait();
      console.log("   Unpaused! tx:", tx.hash);

      console.log("\n=== Retrying simulation ===");
      try {
        await vault.callStatic.ownerMint(0, wallet.address);
        console.log("SUCCESS - simulation passed after unpause!");
      } catch (err) {
        console.log("Still reverts:", err.reason || err.message);
      }
    } catch (err) {
      console.log("   Cannot unpause (not owner?):", err.reason || err.message);
    }
  }
}

main().catch(console.error);
