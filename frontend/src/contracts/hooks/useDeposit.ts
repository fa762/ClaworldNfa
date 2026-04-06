'use client';

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, maxUint256, type Address, zeroAddress } from 'viem';
import { ClawNFAABI } from '../abis/ClawNFA';
import { ClawRouterABI } from '../abis/ClawRouter';
import { DepositRouterABI } from '../abis/DepositRouter';
import { ERC20ABI } from '../abis/ERC20';
import { addresses } from '../addresses';

export function useFundBNB() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  function fundAgent(tokenId: bigint, bnbAmount: string) {
    writeContract({
      address: addresses.clawNFA,
      abi: ClawNFAABI,
      functionName: 'fundAgent',
      args: [tokenId],
      value: parseEther(bnbAmount),
    });
  }

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  return { fundAgent, isPending, isConfirming, isSuccess, hash, error };
}

export function useDepositCLW() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  function approveCLW() {
    writeContract({
      address: addresses.clwToken,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [addresses.clawRouter, maxUint256],
    });
  }

  function depositCLW(tokenId: bigint, amount: string) {
    writeContract({
      address: addresses.clawRouter,
      abi: ClawRouterABI,
      functionName: 'depositCLW',
      args: [tokenId, parseEther(amount)],
      gas: 180000n,
    });
  }

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  return { approveCLW, depositCLW, isPending, isConfirming, isSuccess, hash, error };
}

export function useCLWBalance(owner: Address | undefined) {
  return useReadContract({
    address: addresses.clwToken,
    abi: ERC20ABI,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: {
      enabled: !!owner,
      refetchInterval: 3000,
    },
  });
}

export function useCLWAllowance(owner: Address | undefined) {
  return useReadContract({
    address: addresses.clwToken,
    abi: ERC20ABI,
    functionName: 'allowance',
    args: owner ? [owner, addresses.clawRouter] : undefined,
    query: {
      enabled: !!owner,
      refetchInterval: 3000,
    },
  });
}

export function useBuyAndDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: graduated } = useReadContract({
    address: addresses.depositRouter,
    abi: DepositRouterABI,
    functionName: 'graduated',
    query: { enabled: !!addresses.depositRouter && addresses.depositRouter !== zeroAddress },
  });
  const { data: flapPortal } = useReadContract({
    address: addresses.depositRouter,
    abi: DepositRouterABI,
    functionName: 'flapPortal',
    query: { enabled: !!addresses.depositRouter && addresses.depositRouter !== zeroAddress },
  });
  const { data: pancakeRouter } = useReadContract({
    address: addresses.depositRouter,
    abi: DepositRouterABI,
    functionName: 'pancakeRouter',
    query: { enabled: !!addresses.depositRouter && addresses.depositRouter !== zeroAddress },
  });

  const routeReady = graduated
    ? !!pancakeRouter && pancakeRouter !== zeroAddress
    : !!flapPortal && flapPortal !== zeroAddress;

  function buyAndDeposit(tokenId: bigint, bnbAmount: string) {
    if (!routeReady) return;
    const functionName = graduated ? 'buyAndDeposit' : 'flapBuyAndDeposit';
    writeContract({
      address: addresses.depositRouter,
      abi: DepositRouterABI,
      functionName,
      args: [tokenId, 0n],
      value: parseEther(bnbAmount),
    });
  }

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  return { buyAndDeposit, isPending, isConfirming, isSuccess, hash, graduated, routeReady, error };
}
