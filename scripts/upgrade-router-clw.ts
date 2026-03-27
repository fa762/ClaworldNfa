import { ethers, upgrades } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const routerAddress = '0x60C0D5276c007Fd151f2A615c315cb364EF81BD5';
  const realCLW = '0x82404d91cd6b6cb16b58c650a26122bdc0af7777';

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
