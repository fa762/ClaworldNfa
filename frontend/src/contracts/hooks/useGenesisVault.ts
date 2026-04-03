'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address, zeroAddress, keccak256, encodePacked, toHex } from 'viem';
import { GenesisVaultABI } from '../abis/GenesisVault';
import { addresses } from '../addresses';

export const vaultContract = {
  address: addresses.genesisVault,
  abi: GenesisVaultABI,
} as const;

const isDeployed = !!addresses.genesisVault && addresses.genesisVault !== zeroAddress;

// --- Read hooks ---

export function useMintingActive() {
  return useReadContract({
    ...vaultContract,
    functionName: 'mintingActive',
    query: { enabled: isDeployed },
  });
}

export function useMintedCount() {
  return useReadContract({
    ...vaultContract,
    functionName: 'mintedCount',
    query: { enabled: isDeployed },
  });
}

export function useRarityMinted() {
  return useReadContract({
    ...vaultContract,
    functionName: 'getRarityMinted',
    query: { enabled: isDeployed },
  });
}

export function useCommitment(user: Address | undefined) {
  return useReadContract({
    ...vaultContract,
    functionName: 'commitments',
    args: user ? [user] : undefined,
    query: {
      enabled: isDeployed && !!user,
      refetchInterval: 5000,
    },
  });
}

// --- Write hooks ---

export function useCommitMint() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  function commitMint(commitHash: `0x${string}`, bnbValue: bigint) {
    writeContract({
      ...vaultContract,
      functionName: 'commit',
      args: [commitHash],
      value: bnbValue,
      type: 'legacy',
    });
  }

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  return { commitMint, isPending, isConfirming, isSuccess, hash, error, reset };
}

export function useRevealMint() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  function revealMint(rarity: number, salt: `0x${string}`) {
    writeContract({
      ...vaultContract,
      functionName: 'reveal',
      args: [rarity, salt],
      type: 'legacy',
    });
  }

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  return { revealMint, isPending, isConfirming, isSuccess, hash, error, reset };
}

export function useRefund() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  function refund() {
    writeContract({
      ...vaultContract,
      functionName: 'refundExpired',
      type: 'legacy',
    });
  }

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  return { refund, isPending, isConfirming, isSuccess, hash, error, reset };
}

export function useVaultOwner() {
  return useReadContract({
    ...vaultContract,
    functionName: 'owner',
    query: { enabled: isDeployed },
  });
}

export function useOwnerMint() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  function ownerMint(rarity: number, recipient: Address) {
    writeContract({
      ...vaultContract,
      functionName: 'ownerMint',
      args: [rarity, recipient],
      type: 'legacy',
    });
  }

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  return { ownerMint, isPending, isConfirming, isSuccess, hash, error, reset };
}

// --- Utility functions ---

export const RARITY_PRICES = ['0.02', '0.38', '0.88', '1.88', '3.88'] as const;
export const RARITY_CAPS = [860, 17, 6, 4, 1] as const;
export const RARITY_AIRDROPS = [1000, 3000, 6000, 12000, 30000] as const;

export function generateSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes) as `0x${string}`;
}

export function computeCommitHash(rarity: number, salt: `0x${string}`, user: Address): `0x${string}` {
  return keccak256(encodePacked(['uint8', 'bytes32', 'address'], [rarity, salt, user]));
}

// --- Salt persistence ---
// WARNING: Salt is stored in sessionStorage (cleared on tab close) to reduce XSS risk.
// Users must complete the reveal in the same browser session.

const SALT_KEY_PREFIX = 'clawworld:mint:';

interface SavedSalt {
  salt: `0x${string}`;
  rarity: number;
  timestamp: number;
}

export function saveSalt(address: Address, salt: `0x${string}`, rarity: number) {
  const data: SavedSalt = { salt, rarity, timestamp: Date.now() };
  try {
    sessionStorage.setItem(SALT_KEY_PREFIX + address, JSON.stringify(data));
    // Also save to localStorage as backup (user warned about XSS risk)
    localStorage.setItem(SALT_KEY_PREFIX + address, JSON.stringify(data));
  } catch {
    // Storage quota exceeded — continue without persistence
    console.warn('Failed to save salt to storage');
  }
}

export function loadSalt(address: Address): SavedSalt | null {
  // Prefer sessionStorage (same session), fall back to localStorage (cross-session)
  const raw = sessionStorage.getItem(SALT_KEY_PREFIX + address)
    || localStorage.getItem(SALT_KEY_PREFIX + address);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedSalt;
  } catch {
    return null;
  }
}

export function clearSalt(address: Address) {
  try {
    sessionStorage.removeItem(SALT_KEY_PREFIX + address);
    localStorage.removeItem(SALT_KEY_PREFIX + address);
  } catch {
    // Ignore
  }
}
