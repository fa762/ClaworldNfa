'use strict';

function createToolRegistry(runtime, sessionStore, memoryAdapter) {
  return {
    env: {
      description: 'Runtime, network, and wallet check only.',
      execute: async function() {
        return (await runtime.env()).parsed;
      }
    },
    owned: {
      description: 'Ownership summary only.',
      execute: async function() {
        return (await runtime.owned()).parsed;
      }
    },
    boot: {
      description: 'Full session initialization with NFA and CML context.',
      execute: async function(input) {
        const result = await runtime.boot();
        if (input && input.sessionId) {
          sessionStore.upsert(input.sessionId, { lastBoot: result.parsed });
        }
        return result.parsed;
      }
    },
    status: {
      description: 'Read a lobster status snapshot.',
      execute: async function(input) {
        return (await runtime.status(input.tokenId)).parsed;
      }
    },
    wallet: {
      description: 'Read wallet info from the canonical claw runtime.',
      execute: async function() {
        return (await runtime.wallet()).parsed;
      }
    },
    world: {
      description: 'Read world state from the canonical claw runtime.',
      execute: async function() {
        return (await runtime.world()).parsed;
      }
    },
    supply: {
      description: 'Read total minted supply.',
      execute: async function() {
        return (await runtime.supply()).parsed;
      }
    },
    leaderboard: {
      description: 'Read leaderboard by metric.',
      execute: async function(input) {
        return (await runtime.leaderboard(input && input.metric)).parsed;
      }
    },
    rank: {
      description: 'Read ranking details for an NFA.',
      execute: async function(input) {
        return (await runtime.rank(input.tokenId)).parsed;
      }
    },
    market_search: {
      description: 'Read active market listings.',
      execute: async function() {
        return (await runtime.marketSearch()).parsed;
      }
    },
    pk_search: {
      description: 'Read active PK matches.',
      execute: async function() {
        return (await runtime.pkSearch()).parsed;
      }
    },
    pk_scout: {
      description: 'Read PK opponent scout data for a match.',
      execute: async function(input) {
        return (await runtime.pkScout(input.matchId)).parsed;
      }
    },
    pk_status: {
      description: 'Read PK match status.',
      execute: async function(input) {
        return (await runtime.pkStatus(input.matchId)).parsed;
      }
    },
    withdraw_status: {
      description: 'Read withdraw request status.',
      execute: async function(input) {
        return (await runtime.withdrawStatus(input.tokenId)).parsed;
      }
    },
    cml_load: {
      description: 'Load CML memory for an NFA.',
      execute: async function(input) {
        return (await runtime.cmlLoad(input.tokenId, !!input.full)).parsed;
      }
    },
    cml_save: {
      description: 'Save canonical CML memory for an NFA.',
      execute: async function(input) {
        return (await runtime.cmlSave(input.tokenId, input.cml, input.auth)).parsed;
      }
    },
    session_flush: {
      description: 'Flush session hippocampus fragments back into canonical CML.',
      execute: async function(input) {
        return memoryAdapter.flushSessionMemory(input.sessionId, input.tokenId, input.auth);
      }
    },
    task_submit: {
      description: 'Submit a completed task through the canonical claw runtime.',
      execute: async function(input) {
        return (await runtime.task(input.pin, input.tokenId, input.taskType, input.xp, input.clw, input.score)).parsed;
      }
    },
    deposit: {
      description: 'Deposit CLW into an NFA.',
      execute: async function(input) {
        return (await runtime.deposit(input.pin, input.tokenId, input.amount)).parsed;
      }
    },
    fund_bnb: {
      description: 'Fund an NFA with gas BNB.',
      execute: async function(input) {
        return (await runtime.fundBnb(input.pin, input.tokenId, input.amount)).parsed;
      }
    },
    upkeep: {
      description: 'Run upkeep for an NFA.',
      execute: async function(input) {
        return (await runtime.upkeep(input.pin, input.tokenId)).parsed;
      }
    },
    transfer: {
      description: 'Transfer an NFA to another address.',
      execute: async function(input) {
        return (await runtime.transfer(input.pin, input.tokenId, input.toAddress)).parsed;
      }
    },
    market_list: {
      description: 'Create a fixed-price market listing.',
      execute: async function(input) {
        return (await runtime.marketList(input.pin, input.tokenId, input.priceBnb)).parsed;
      }
    },
    market_auction: {
      description: 'Create an auction listing.',
      execute: async function(input) {
        return (await runtime.marketAuction(input.pin, input.tokenId, input.startPrice)).parsed;
      }
    },
    market_buy: {
      description: 'Buy a fixed-price listing.',
      execute: async function(input) {
        return (await runtime.marketBuy(input.pin, input.listingId, input.priceBnb)).parsed;
      }
    },
    market_bid: {
      description: 'Place a bid on an auction listing.',
      execute: async function(input) {
        return (await runtime.marketBid(input.pin, input.listingId, input.bidBnb)).parsed;
      }
    },
    market_cancel: {
      description: 'Cancel a market listing.',
      execute: async function(input) {
        return (await runtime.marketCancel(input.pin, input.listingId)).parsed;
      }
    },
    withdraw_request: {
      description: 'Request a CLW withdrawal.',
      execute: async function(input) {
        return (await runtime.withdrawRequest(input.pin, input.tokenId, input.amount)).parsed;
      }
    },
    withdraw_claim: {
      description: 'Claim a finished CLW withdrawal.',
      execute: async function(input) {
        return (await runtime.withdrawClaim(input.pin, input.tokenId)).parsed;
      }
    },
    withdraw_cancel: {
      description: 'Cancel a pending CLW withdrawal.',
      execute: async function(input) {
        return (await runtime.withdrawCancel(input.pin, input.tokenId)).parsed;
      }
    },
    pk_create: {
      description: 'Create a PK match.',
      execute: async function(input) {
        return (await runtime.pkCreate(input.pin, input.tokenId, input.stake, input.strategy)).parsed;
      }
    },
    pk_join: {
      description: 'Join a PK match.',
      execute: async function(input) {
        return (await runtime.pkJoin(input.pin, input.matchId, input.tokenId, input.strategy)).parsed;
      }
    },
    pk_commit: {
      description: 'Commit a PK strategy.',
      execute: async function(input) {
        return (await runtime.pkCommit(input.pin, input.matchId, input.strategy)).parsed;
      }
    },
    pk_reveal: {
      description: 'Reveal a PK strategy.',
      execute: async function(input) {
        return (await runtime.pkReveal(input.pin, input.matchId)).parsed;
      }
    },
    pk_settle: {
      description: 'Settle a PK match.',
      execute: async function(input) {
        return (await runtime.pkSettle(input.pin, input.matchId)).parsed;
      }
    },
    pk_cancel: {
      description: 'Cancel a PK match if allowed.',
      execute: async function(input) {
        return (await runtime.pkCancel(input.pin, input.matchId)).parsed;
      }
    },
    pk_auto_settle: {
      description: 'Auto reveal and settle a PK match.',
      execute: async function(input) {
        return (await runtime.pkAutoSettle(input.pin, input.matchId, input.pin2)).parsed;
      }
    },
    raw: {
      description: 'Run any claw command through the adapter.',
      execute: async function(input) {
        const result = await runtime.raw(input.command, input.args || [], {
          expectJson: input.expectJson,
          stdin: input.stdin,
          timeoutMs: input.timeoutMs
        });
        return result.parsed;
      }
    }
  };
}

module.exports = {
  createToolRegistry
};
