import { ethers, upgrades } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const routerAddress = '0x60C0D5276c007Fd151f2A615c315cb364EF81BD5';
  const realCLW = '0x3b486c191c74c9945fa944a3ddde24acdd63ffff';

  // Upgrade
  console.log('Upgrading ClawRouter...');
  const ClawRouter = await ethers.getContractFactory('ClawRouter');
  await upgrades.upgradeProxy(routerAddress, ClawRouter);
  console.log('Upgraded!');

  // Set real CLW token
  const router = await ethers.getContractAt('ClawRouter', routerAddress);
  const tx = await router.setClwToken(realCLW);
  await tx.wait();
  console.log('CLW token set to:', realCLW, 'TX:', tx.hash);

  // Verify
  const clwAddr = await router.clwToken();
  console.log('Verified clwToken:', clwAddr);
}

main().catch(console.error);
