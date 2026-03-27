import { ethers } from "hardhat";

async function main() {
  const addrs = [
    '0x0Be6F36A64A617CCbc117bd8e07ed407A3c87526',
    '0x8AB5BFeC42d69D57d1ECde687D5E0BdfdbCF2Ae3',
    '0xE2e7600BBD3E930bf59EdeCF3D7Dd0928A09f17d',
    '0x9062Ee46e3dE6BB5Ab5b8B6b78Aa650C85323002',
  ];
  for (const addr of addrs) {
    try {
      const c = await ethers.getContractAt('PKSkill', addr);
      await c.COMMIT_TIMEOUT();
      console.log(addr, '= PKSkill');
      continue;
    } catch {}
    try {
      const c = await ethers.getContractAt('TaskSkill', addr);
      await c.worldState();
      console.log(addr, '= TaskSkill');
      continue;
    } catch {}
    try {
      const c = await ethers.getContractAt('MarketSkill', addr);
      await c.TRADING_FEE_BPS();
      console.log(addr, '= MarketSkill');
      continue;
    } catch {}
    console.log(addr, '= Unknown (likely ClawOracle)');
  }
}
main().catch(console.error);
