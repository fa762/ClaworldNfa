/**
 * Update all CLW token references to the new token contract.
 * Uses the configured PRIVATE_KEY from .env via Hardhat network config.
 *
 * Usage:
 *   npx hardhat run scripts/update-clw-token.ts --network bscMainnet
 */
import { ethers, upgrades } from 'hardhat';

const NEW_CLW = '0x3b486c191c74c9945fa944a3ddde24acdd63ffff';

const CONTRACTS = {
  clawRouter: '0x60C0D5276c007Fd151f2A615c315cb364EF81BD5',
  worldState: '0xC375E0a2f4e06cF79b4571AB4d2f6118482b9FCA',
  depositRouter: '0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269',
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('New CLW:', NEW_CLW);
  console.log('---');

  console.log('Upgrading DepositRouter...');
  const DepositRouter = await ethers.getContractFactory('DepositRouter');
  const upgradedDepositRouter = await upgrades.upgradeProxy(
    CONTRACTS.depositRouter,
    DepositRouter
  );
  await upgradedDepositRouter.deployed();
  console.log('  upgraded:', upgradedDepositRouter.address);

  console.log('Updating DepositRouter...');
  const depositRouter = new ethers.Contract(
    CONTRACTS.depositRouter,
    [
      'function setClwToken(address _clwToken) external',
      'function clwToken() external view returns (address)',
    ],
    deployer
  );
  const currentDepositRouterClw = await depositRouter.clwToken();
  console.log('  current clwToken:', currentDepositRouterClw);
  if (currentDepositRouterClw.toLowerCase() !== NEW_CLW.toLowerCase()) {
    const tx0 = await depositRouter.setClwToken(NEW_CLW);
    console.log('  tx:', tx0.hash);
    await tx0.wait();
  } else {
    console.log('  already updated, skipping tx');
  }
  console.log('  verified clwToken:', await depositRouter.clwToken());

  console.log('Updating ClawRouter...');
  const clawRouter = new ethers.Contract(
    CONTRACTS.clawRouter,
    [
      'function setClwToken(address _clwToken) external',
      'function clwToken() external view returns (address)',
    ],
    deployer
  );
  const currentClawRouterClw = await clawRouter.clwToken();
  console.log('  current clwToken:', currentClawRouterClw);
  if (currentClawRouterClw.toLowerCase() !== NEW_CLW.toLowerCase()) {
    const tx1 = await clawRouter.setClwToken(NEW_CLW);
    console.log('  tx:', tx1.hash);
    await tx1.wait();
  } else {
    console.log('  already updated, skipping tx');
  }
  console.log('  verified clwToken:', await clawRouter.clwToken());

  console.log('Updating WorldState...');
  const worldState = new ethers.Contract(
    CONTRACTS.worldState,
    [
      'function setCLWToken(address _token) external',
      'function clwToken() external view returns (address)',
    ],
    deployer
  );
  const currentWorldStateClw = await worldState.clwToken();
  console.log('  current clwToken:', currentWorldStateClw);
  if (currentWorldStateClw.toLowerCase() !== NEW_CLW.toLowerCase()) {
    const tx2 = await worldState.setCLWToken(NEW_CLW);
    console.log('  tx:', tx2.hash);
    await tx2.wait();
  } else {
    console.log('  already updated, skipping tx');
  }
  console.log('  verified clwToken:', await worldState.clwToken());

  console.log('---');
  console.log('Done! All three contracts now point to the new CLW token.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
