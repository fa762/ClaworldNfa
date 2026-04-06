import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

export interface GreenfieldUploadResult {
  bucket: string;
  latestUri: string;
  archiveUri: string;
}

const GREENFIELD_CHAIN_ID = process.env.GREENFIELD_CHAIN_ID || 'greenfield_1017-1';
const GREENFIELD_RPC = process.env.GREENFIELD_RPC || 'https://greenfield-chain.bnbchain.org:443';
const GREENFIELD_BUCKET = process.env.GREENFIELD_BUCKET || 'clawworld-cml';
const GREENFIELD_HOME = process.env.GREENFIELD_HOME || path.join(os.homedir(), '.openclaw', 'claw-world', '.gnfd-cmd');

function runGnfd(args: string[], stdin?: string): string {
  const command = process.platform === 'win32' ? 'wsl' : 'gnfd-cmd';
  const fullArgs = process.platform === 'win32'
    ? ['bash', '-lc', ['~/.local/bin/gnfd-cmd', ...args].join(' ')]
    : args;

  return execFileSync(command, fullArgs, {
    encoding: 'utf8',
    input: stdin,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function writePasswordFile(pin: string): string {
  fs.mkdirSync(GREENFIELD_HOME, { recursive: true });
  const passwordFile = path.join(GREENFIELD_HOME, 'password.txt');
  if (!fs.existsSync(passwordFile)) {
    fs.writeFileSync(passwordFile, pin || `clawworld-${Math.random().toString(36).slice(2)}-${Date.now()}`, 'utf8');
  }
  return passwordFile;
}

export function getGreenfieldLatestUri(nfaId: number, bucket = GREENFIELD_BUCKET): string {
  return `gnfd://${bucket}/nfa-${nfaId}/latest.cml`;
}

export function ensureGreenfieldConfig(): void {
  const configDir = path.join(GREENFIELD_HOME, 'config');
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, 'config.toml');

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      `rpcAddr = "${GREENFIELD_RPC}"
chainId = "${GREENFIELD_CHAIN_ID}"
`,
      'utf8',
    );
  }
}

export function hasGnfdCmd(): boolean {
  try {
    runGnfd(['version']);
    return true;
  } catch {
    return false;
  }
}

export function ensureGreenfieldAccount(privateKey: string, pin = ''): void {
  ensureGreenfieldConfig();

  const keystorePath = path.join(GREENFIELD_HOME, 'keystore', 'key.json');
  if (fs.existsSync(keystorePath)) {
    return;
  }

  fs.mkdirSync(GREENFIELD_HOME, { recursive: true });
  const keyFile = path.join(GREENFIELD_HOME, 'private.key');
  fs.writeFileSync(keyFile, privateKey.replace(/^0x/, ''), 'utf8');
  const passwordFile = writePasswordFile(pin);

  runGnfd(['--home', GREENFIELD_HOME, '--passwordfile', passwordFile, 'account', 'import', keyFile]);

  fs.unlinkSync(keyFile);
}

export function uploadCMLToGreenfield(nfaId: number, privateKey: string, localPath: string, hash: string, bucket = GREENFIELD_BUCKET): GreenfieldUploadResult {
  ensureGreenfieldAccount(privateKey);
  const passwordFile = writePasswordFile('');

  const archiveFile = path.basename(localPath);
  const archiveUri = `gnfd://${bucket}/nfa-${nfaId}/archive/${archiveFile}`;
  const latestUri = `gnfd://${bucket}/nfa-${nfaId}/latest.cml`;

  runGnfd(['--home', GREENFIELD_HOME, '--passwordfile', passwordFile, 'object', 'put', localPath, archiveUri]);

  try {
    runGnfd(['--home', GREENFIELD_HOME, '--passwordfile', passwordFile, 'object', 'rm', latestUri]);
  } catch {
    // latest.cml may not exist yet
  }

  runGnfd(['--home', GREENFIELD_HOME, '--passwordfile', passwordFile, 'object', 'put', localPath, latestUri]);

  const publicSummary = JSON.stringify({ nfa_id: nfaId, latestUri, hash, updatedAt: Date.now() }, null, 2);
  const summaryPath = path.join(GREENFIELD_HOME, `nfa-${nfaId}.public.json`);
  fs.writeFileSync(summaryPath, publicSummary, 'utf8');
  const summaryUri = `gnfd://${bucket}/nfa-${nfaId}/public.json`;
  try {
    runGnfd(['--home', GREENFIELD_HOME, '--passwordfile', passwordFile, 'object', 'rm', summaryUri]);
  } catch {
    // ignore missing summary object
  }
  runGnfd(['--home', GREENFIELD_HOME, '--passwordfile', passwordFile, 'object', 'put', '--visibility=public-read', summaryPath, summaryUri]);

  return { bucket, latestUri, archiveUri };
}
