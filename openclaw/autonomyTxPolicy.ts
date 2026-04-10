import { BigNumber, Contract, ethers, type providers } from "ethers";

export interface AutonomyTxPolicy {
  gasPriceWei?: BigNumber;
  maxGasPriceWei?: BigNumber;
  gasLimitBufferBps: number;
  gasLimitExtra: number;
}

export function loadAutonomyTxPolicyFromEnv(): AutonomyTxPolicy {
  const gasPriceGwei = process.env.AUTONOMY_GAS_PRICE_GWEI?.trim();
  const maxGasPriceGwei = process.env.AUTONOMY_MAX_GAS_PRICE_GWEI?.trim();

  return {
    gasPriceWei: gasPriceGwei ? ethers.utils.parseUnits(gasPriceGwei, "gwei") : undefined,
    maxGasPriceWei: maxGasPriceGwei ? ethers.utils.parseUnits(maxGasPriceGwei, "gwei") : undefined,
    gasLimitBufferBps: parsePositiveInt("AUTONOMY_GAS_LIMIT_BUFFER_BPS", 10750),
    gasLimitExtra: parsePositiveInt("AUTONOMY_GAS_LIMIT_EXTRA", 8000),
  };
}

export function summarizeAutonomyTxPolicy(policy: AutonomyTxPolicy) {
  return {
    gasPriceGwei: policy.gasPriceWei ? ethers.utils.formatUnits(policy.gasPriceWei, "gwei") : null,
    maxGasPriceGwei: policy.maxGasPriceWei
      ? ethers.utils.formatUnits(policy.maxGasPriceWei, "gwei")
      : null,
    gasLimitBufferBps: policy.gasLimitBufferBps,
    gasLimitExtra: policy.gasLimitExtra,
  };
}

export async function buildAutonomyTxOverrides(
  contract: Contract,
  method: string,
  args: unknown[],
  policy: AutonomyTxPolicy,
  fallbackGasLimit?: number
): Promise<providers.TransactionRequest> {
  const overrides: providers.TransactionRequest = {};
  const gasLimit = await resolveGasLimit(contract, method, args, policy, fallbackGasLimit);
  const gasPrice = await resolveGasPrice(contract.provider, policy);

  if (gasLimit) {
    overrides.gasLimit = gasLimit;
  }
  if (gasPrice) {
    overrides.gasPrice = gasPrice;
  }

  return overrides;
}

async function resolveGasLimit(
  contract: Contract,
  method: string,
  args: unknown[],
  policy: AutonomyTxPolicy,
  fallbackGasLimit?: number
): Promise<BigNumber | undefined> {
  try {
    if (contract.estimateGas?.[method]) {
      const estimated = await contract.estimateGas[method](...args);
      return applyGasLimitPolicy(estimated, policy);
    }
  } catch {
    // Fall back to configured static gas limit when estimateGas is unavailable or unstable.
  }

  if (typeof fallbackGasLimit === "number" && fallbackGasLimit > 0) {
    return BigNumber.from(fallbackGasLimit);
  }

  return undefined;
}

async function resolveGasPrice(
  provider: providers.Provider,
  policy: AutonomyTxPolicy
): Promise<BigNumber | undefined> {
  let gasPrice = policy.gasPriceWei;

  if (!gasPrice && policy.maxGasPriceWei) {
    try {
      gasPrice = await provider.getGasPrice();
    } catch {
      gasPrice = undefined;
    }
  }

  if (gasPrice && policy.maxGasPriceWei && gasPrice.gt(policy.maxGasPriceWei)) {
    return policy.maxGasPriceWei;
  }

  return gasPrice;
}

function applyGasLimitPolicy(estimate: BigNumber, policy: AutonomyTxPolicy): BigNumber {
  return estimate.mul(policy.gasLimitBufferBps).div(10_000).add(policy.gasLimitExtra);
}

function parsePositiveInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid integer for ${key}: ${value}`);
  }

  return parsed;
}
