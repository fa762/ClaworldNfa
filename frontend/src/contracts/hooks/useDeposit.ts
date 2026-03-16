'use client';

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, type Address } from 'viem';
import { ClawNFAABI } from '../abis/ClawNFA';
import { ClawRouterABI } from '../abis/ClawRouter';
import { ERC20ABI } from '../abis/ERC20';
import { addresses } from '../addresses';
import { useGraduated } from './useClawRouter';

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

  function approveCLW(amount: string) {
    writeContract({
      address: addresses.clwToken,
      abi: ERC20ABI,
      functionName: 'approve',
      args: [addresses.clawRouter, parseEther(amount)],
    });
  }

  function depositCLW(tokenId: bigint, amount: string) {
    writeContract({
      address: addresses.clawRouter,
      abi: ClawRouterABI,
      functionName: 'depositCLW',
      args: [tokenId, parseEther(amount)],
    });
  }

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  return { approveCLW, depositCLW, isPending, isConfirming, isSuccess, hash, error };
}

export function useCLWAllowance(owner: Address | undefined) {
  return useReadContract({
    address: addresses.clwToken,
    abi: ERC20ABI,
    functionName: 'allowance',
    args: owner ? [owner, addresses.clawRouter] : undefined,
    query: { enabled: !!owner },
  });
}

export function useBuyAndDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: graduated } = useGraduated();

  function buyAndDeposit(tokenId: bigint, bnbAmount: string) {
    const functionName = graduated ? 'buyAndDeposit' : 'flapBuyAndDeposit';
    writeContract({
      address: addresses.clawRouter,
      abi: ClawRouterABI,
      functionName,
      args: [tokenId],
      value: parseEther(bnbAmount),
    });
  }

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  return { buyAndDeposit, isPending, isConfirming, isSuccess, hash, graduated, error };
}
