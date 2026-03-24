/**
 * chain.skill — Local Wallet Management for OpenClaw
 *
 * Generates and manages a local wallet for the lobster NFA.
 * Private key is encrypted with a PIN and stored locally.
 * The wallet address is displayed so the player can transfer their NFA to it.
 *
 * Flow:
 *   1. Player installs claw-world skill
 *   2. chain.skill auto-generates a wallet (or loads existing)
 *   3. Player sees the wallet address
 *   4. Player transfers NFA from MetaMask to this address on the frontend
 *   5. Now the lobster lives in OpenClaw
 */

import { ethers } from 'ethers';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const WALLET_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.openclaw', 'claw-world'
);
const WALLET_FILE = path.join(WALLET_DIR, 'wallet.enc');
const WALLET_ADDR_FILE = path.join(WALLET_DIR, 'address.txt');

export interface WalletInfo {
  address: string;
  hasNFA: boolean;
  nfaIds: number[];
  bnbBalance: string;
  clwBalance: string;
}

export class ChainSkill {
  private provider: ethers.providers.Provider;
  private wallet: ethers.Wallet | null = null;
  private nfaContract: ethers.Contract;
  private clwContract: ethers.Contract;

  constructor(
    rpcUrl: string,
    private nfaAddress: string,
    private clwAddress: string
  ) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.nfaContract = new ethers.Contract(nfaAddress, [
      'function balanceOf(address) view returns (uint256)',
      'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
    ], this.provider);
    this.clwContract = new ethers.Contract(clwAddress, [
      'function balanceOf(address) view returns (uint256)',
    ], this.provider);
  }

  /**
   * Initialize wallet — create new or load existing
   * Returns the wallet address for the player to see
   */
  async initWallet(pin?: string): Promise<string> {
    // Check if wallet already exists
    if (fs.existsSync(WALLET_FILE) && pin) {
      this.wallet = this.loadWallet(pin);
      return this.wallet.address;
    }

    if (fs.existsSync(WALLET_ADDR_FILE) && !pin) {
      // Return address without decrypting (for display)
      return fs.readFileSync(WALLET_ADDR_FILE, 'utf8').trim();
    }

    // Generate new wallet
    const newWallet = ethers.Wallet.createRandom().connect(this.provider);

    if (pin) {
      this.saveWallet(newWallet, pin);
      this.wallet = newWallet;
    }

    // Save address in plaintext for easy access
    fs.mkdirSync(WALLET_DIR, { recursive: true });
    fs.writeFileSync(WALLET_ADDR_FILE, newWallet.address);

    return newWallet.address;
  }

  /**
   * Unlock wallet with PIN (needed for signing transactions)
   */
  unlockWallet(pin: string): ethers.Wallet {
    if (this.wallet) return this.wallet;
    this.wallet = this.loadWallet(pin);
    return this.wallet;
  }

  /**
   * Get wallet info including owned NFAs
   */
  async getWalletInfo(): Promise<WalletInfo> {
    const address = this.getAddress();
    if (!address) throw new Error('Wallet not initialized. Run /wallet init first.');

    const [nfaBalance, bnbBalance, clwBalance] = await Promise.all([
      this.nfaContract.balanceOf(address),
      this.provider.getBalance(address),
      this.clwContract.balanceOf(address),
    ]);

    const nfaIds: number[] = [];
    for (let i = 0; i < nfaBalance.toNumber(); i++) {
      const id = await this.nfaContract.tokenOfOwnerByIndex(address, i);
      nfaIds.push(id.toNumber());
    }

    return {
      address,
      hasNFA: nfaIds.length > 0,
      nfaIds,
      bnbBalance: ethers.utils.formatEther(bnbBalance),
      clwBalance: ethers.utils.formatEther(clwBalance),
    };
  }

  /**
   * Get the wallet address (without unlocking)
   */
  getAddress(): string | null {
    if (this.wallet) return this.wallet.address;
    if (fs.existsSync(WALLET_ADDR_FILE)) {
      return fs.readFileSync(WALLET_ADDR_FILE, 'utf8').trim();
    }
    return null;
  }

  /**
   * Get the active signer (must be unlocked first)
   */
  getSigner(): ethers.Wallet {
    if (!this.wallet) throw new Error('Wallet locked. Use /wallet unlock <pin> first.');
    return this.wallet;
  }

  /**
   * Check if wallet is unlocked
   */
  isUnlocked(): boolean {
    return this.wallet !== null;
  }

  // ============================================
  // PRIVATE: Encryption helpers
  // ============================================

  private saveWallet(wallet: ethers.Wallet, pin: string): void {
    fs.mkdirSync(WALLET_DIR, { recursive: true });

    const key = crypto.scryptSync(pin, 'claw-world-salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(wallet.privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const data = JSON.stringify({
      iv: iv.toString('hex'),
      encrypted,
      address: wallet.address,
    });

    fs.writeFileSync(WALLET_FILE, data, 'utf8');
    fs.writeFileSync(WALLET_ADDR_FILE, wallet.address);
  }

  private loadWallet(pin: string): ethers.Wallet {
    if (!fs.existsSync(WALLET_FILE)) {
      throw new Error('No wallet found. Run /wallet init <pin> first.');
    }

    const data = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
    const key = crypto.scryptSync(pin, 'claw-world-salt', 32);
    const iv = Buffer.from(data.iv, 'hex');

    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const wallet = new ethers.Wallet(decrypted, this.provider);
      if (wallet.address.toLowerCase() !== data.address.toLowerCase()) {
        throw new Error('PIN incorrect');
      }
      return wallet;
    } catch {
      throw new Error('PIN incorrect or wallet corrupted.');
    }
  }
}

// ============================================
// FORMATTER: Wallet display
// ============================================

export function formatWalletInfo(info: WalletInfo, format: 'plain' | 'telegram' | 'rich'): string {
  if (format === 'plain') {
    const lines = [
      '=== 🔑 OpenClaw 钱包 ===',
      `地址: ${info.address}`,
      `BNB:  ${info.bnbBalance}`,
      `CLW:  ${info.clwBalance}`,
      '',
    ];
    if (info.hasNFA) {
      lines.push(`拥有龙虾: ${info.nfaIds.map(id => `#${id}`).join(', ')}`);
      lines.push('');
      lines.push('你的龙虾已就位！输入 /status 查看状态，或直接和它对话。');
    } else {
      lines.push('⚠ 还没有龙虾！');
      lines.push('请在官网 (clawnfaterminal.xyz) 的 NFA 详情页');
      lines.push('维护 Tab → "转移到 OpenClaw" → 粘贴上面的地址');
    }
    return lines.join('\n');
  }

  // telegram / rich
  const lines = [
    `🔑 **OpenClaw 钱包**`,
    `\`${info.address}\``,
    `💰 BNB: ${info.bnbBalance} | CLW: ${info.clwBalance}`,
    '',
  ];
  if (info.hasNFA) {
    lines.push(`🦞 拥有龙虾: ${info.nfaIds.map(id => `**#${id}**`).join(', ')}`);
    lines.push('输入 `/status` 查看龙虾状态');
  } else {
    lines.push('⚠️ 还没有龙虾！请在官网转移 NFA 到此地址');
  }
  return lines.join('\n');
}
