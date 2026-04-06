import { ethers } from 'hardhat';

const CONTRACTS = {
  depositRouter: '0xFe68460e9C55AB188b1E91fd4dB4D7219Bd3f269',
  flapPortal: '0x3525e9B10cD054E7A32248902EB158c863F3a18B',
  pancakeRouter: '0x114E4c57754c69dAA360a8894698F1D832E56350',
};

const TARGET_GRADUATED = false;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const depositRouter = new ethers.Contract(
    CONTRACTS.depositRouter,
    [
      'function owner() view returns (address)',
      'function flapPortal() view returns (address)',
      'function pancakeRouter() view returns (address)',
      'function graduated() view returns (bool)',
      'function setFlapPortal(address _portal) external',
      'function setPancakeRouter(address _router) external',
      'function setGraduated(bool _graduated) external',
    ],
    deployer
  );

  const [owner, flapPortal, pancakeRouter, graduated] = await Promise.all([
    depositRouter.owner(),
    depositRouter.flapPortal(),
    depositRouter.pancakeRouter(),
    depositRouter.graduated(),
  ]);

  console.log('Current owner:', owner);
  console.log('Current flapPortal:', flapPortal);
  console.log('Current pancakeRouter:', pancakeRouter);
  console.log('Current graduated:', graduated);

  if (flapPortal.toLowerCase() !== CONTRACTS.flapPortal.toLowerCase()) {
    const tx = await depositRouter.setFlapPortal(CONTRACTS.flapPortal);
    console.log('setFlapPortal tx:', tx.hash);
    await tx.wait();
  } else {
    console.log('setFlapPortal: already configured');
  }

  if (pancakeRouter.toLowerCase() !== CONTRACTS.pancakeRouter.toLowerCase()) {
    const tx = await depositRouter.setPancakeRouter(CONTRACTS.pancakeRouter);
    console.log('setPancakeRouter tx:', tx.hash);
    await tx.wait();
  } else {
    console.log('setPancakeRouter: already configured');
  }

  if (graduated !== TARGET_GRADUATED) {
    const tx = await depositRouter.setGraduated(TARGET_GRADUATED);
    console.log('setGraduated tx:', tx.hash);
    await tx.wait();
  } else {
    console.log('setGraduated: already configured');
  }

  const [nextFlapPortal, nextPancakeRouter, nextGraduated] = await Promise.all([
    depositRouter.flapPortal(),
    depositRouter.pancakeRouter(),
    depositRouter.graduated(),
  ]);

  console.log('Verified flapPortal:', nextFlapPortal);
  console.log('Verified pancakeRouter:', nextPancakeRouter);
  console.log('Verified graduated:', nextGraduated);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
