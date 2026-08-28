import { describe, it, expect, beforeAll } from 'bun:test';
import { Keypair, Contract, rpc, TransactionBuilder, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';
import testnetContracts from '../../../shared/src/contracts.testnet.json';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const OPERATIONS_BACKEND_CREDENTIAL = process.env.OPERATIONS_BACKEND_CREDENTIAL;

// Keys for on-chain execution
const OPERATOR_SECRET = process.env.PILOT_E2E_OPERATOR_SECRET;
const ALLY_SECRET = process.env.PILOT_E2E_ALLY_SECRET;

const WHITELIST_CONTRACT_ID = testnetContracts.contracts.PILOT_WHITELIST;
const PAYOUT_SPLIT_CONTRACT_ID = testnetContracts.contracts.PILOT_PAYOUT_SPLIT;
const USDC_CONTRACT_ID = testnetContracts.contracts.USDC_TOKEN;
const PILOT_INCOME_TOKEN_ID = testnetContracts.contracts.PILOT_INCOME_TOKEN;

const rpcUrl = testnetContracts.rpcUrl;
const server = new rpc.Server(rpcUrl);
const networkPassphrase = testnetContracts.networkPassphrase;

describe('Pilot Lifecycle End-to-End Testnet Suite', () => {
  let investorKeypair: Keypair;
  let whitelistRequestId: string;
  let operatorKeypair: Keypair;
  let allyKeypair: Keypair;

  beforeAll(() => {
    if (!OPERATOR_SECRET || !ALLY_SECRET) {
      throw new Error('Missing PILOT_E2E_OPERATOR_SECRET or PILOT_E2E_ALLY_SECRET environment variables');
    }
    if (!OPERATIONS_BACKEND_CREDENTIAL) {
      throw new Error('Missing OPERATIONS_BACKEND_CREDENTIAL environment variable');
    }

    operatorKeypair = Keypair.fromSecret(OPERATOR_SECRET);
    allyKeypair = Keypair.fromSecret(ALLY_SECRET);
    investorKeypair = Keypair.random(); // Fresh investor for whitelist
  });

  it('Step 1: Submits a whitelist request through the real API', async () => {
    const response = await fetch(`${API_BASE_URL}/pilot/whitelist/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: investorKeypair.publicKey(),
        fullName: 'E2E Test User',
        idType: 'passport',
        idReference: `E2E-${Date.now()}`
      })
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.walletAddress).toBe(investorKeypair.publicKey());
    expect(data.data.status).toBe('pending');

    whitelistRequestId = data.data.id;
  });

  it('Step 2: Approves the request via API and confirms via direct RPC', async () => {
    expect(whitelistRequestId).toBeDefined();

    // 1. Approve via internal operations API
    const response = await fetch(`${API_BASE_URL}/internal/operations/pilot/whitelist/${whitelistRequestId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': OPERATIONS_BACKEND_CREDENTIAL as string,
      },
      body: JSON.stringify({ action: 'approve' })
    });

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.txHash).toBeDefined();

    // 2. Wait for the transaction to be confirmed on ledger (max 20s)
    let isApproved = false;
    const contract = new Contract(WHITELIST_CONTRACT_ID);
    
    for (let i = 0; i < 10; i++) {
      try {
        const invokeOp = contract.call('is_approved', nativeToScVal(investorKeypair.publicKey(), { type: 'address' }));
        const txBuilder = new TransactionBuilder(await server.getAccount(operatorKeypair.publicKey()), {
          fee: '100',
          networkPassphrase
        });
        txBuilder.addOperation(invokeOp);
        const tx = txBuilder.build();
        
        const simRes = await server.simulateTransaction(tx);
        
        if (rpc.Api.isSimulationSuccess(simRes) && simRes.result?.retval) {
          isApproved = scValToNative(simRes.result.retval);
          if (isApproved) {
            break;
          }
        }
      } catch (err) {
        console.warn('RPC check error (retrying):', err);
      }
      // wait 2 seconds
      await new Promise(res => setTimeout(res, 2000));
    }

    expect(isApproved).toBe(true);
  }, 30000); // 30s timeout for ledger closure

  it('Step 3: Records evidence and executes two-signer distribution on-chain', async () => {
    // Note: Since this is an integration test, we must use idempotent or unique inputs 
    // to avoid cycle already recorded / distributed errors.
    const cycleId = `E2E-Cycle-${Date.now()}`;
    const evidenceHash = Buffer.alloc(32, 1); // Mock 32-byte hash
    const evidenceLink = `ipfs://evidence/${cycleId}`;
    const totalIncome = 10000n; // 10,000 USDC droplets

    const contract = new Contract(PAYOUT_SPLIT_CONTRACT_ID);
    
    // 1. Record Evidence (Needs both Operator and Ally signatures)
    const recordOp = contract.call(
      'record_evidence',
      nativeToScVal(operatorKeypair.publicKey(), { type: 'address' }),
      nativeToScVal(allyKeypair.publicKey(), { type: 'address' }),
      nativeToScVal(cycleId, { type: 'string' }),
      nativeToScVal(evidenceHash, { type: 'bytes' }),
      nativeToScVal(evidenceLink, { type: 'string' }),
      nativeToScVal(totalIncome, { type: 'i128' })
    );

    const sourceAccount = await server.getAccount(operatorKeypair.publicKey());
    const txBuilder = new TransactionBuilder(sourceAccount, {
      fee: '10000',
      networkPassphrase
    });
    txBuilder.addOperation(recordOp);
    const tx = txBuilder.build();

    // Prepare transaction to gather auth entries for both signers
    const preparedTx = await server.prepareTransaction(tx);
    preparedTx.sign(operatorKeypair, allyKeypair);
    
    const sendRes = await server.sendTransaction(preparedTx);
    expect(sendRes.status).toBe('PENDING');
    
    const txStatus = await waitTxConfirm(sendRes.hash);
    expect(txStatus.status).toBe(rpc.Api.GetTransactionStatus.SUCCESS);

    // 2. Execute Distribution
    const execOp = contract.call(
      'execute_distribution',
      nativeToScVal(cycleId, { type: 'string' })
    );

    const execAccount = await server.getAccount(operatorKeypair.publicKey());
    const execTxBuilder = new TransactionBuilder(execAccount, {
      fee: '100000',
      networkPassphrase
    });
    execTxBuilder.addOperation(execOp);
    const execTx = execTxBuilder.build();

    const preparedExecTx = await server.prepareTransaction(execTx);
    preparedExecTx.sign(operatorKeypair); // Only operator needs to sign execution
    
    const execSendRes = await server.sendTransaction(preparedExecTx);
    expect(execSendRes.status).toBe('PENDING');
    
    const execTxStatus = await waitTxConfirm(execSendRes.hash);
    expect(execTxStatus.status).toBe(rpc.Api.GetTransactionStatus.SUCCESS);
  }, 60000); // 60s timeout

  it('Step 4: Asserts resulting USDC balances match the expected split', async () => {
    // 1. Read platform fee recipient from contract state
    const payoutContractAddress = new Contract(PAYOUT_SPLIT_CONTRACT_ID).address().toScAddress();
    
    const feeRecipientKeySymbol = xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
      contract: payoutContractAddress,
      key: xdr.ScVal.scvSymbol('PlatformFeeRecipient'),
      durability: xdr.ContractDataDurability.persistent(),
    }));
    
    const feeRecipientKeyVec = xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
      contract: payoutContractAddress,
      key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('PlatformFeeRecipient')]),
      durability: xdr.ContractDataDurability.persistent(),
    }));

    const ledgerEntriesRes = await server.getLedgerEntries(feeRecipientKeySymbol, feeRecipientKeyVec);
    expect(ledgerEntriesRes.entries.length).toBeGreaterThan(0);
    const entry = ledgerEntriesRes.entries[0];
    expect(entry).toBeDefined();
    if (!entry) throw new Error('Platform fee recipient entry not found');
    const platformFeeRecipient = scValToNative(entry.val.contractData().val());

    // 2. Read pro-rata recipients (holders) from income token via getter simulation
    const incomeTokenContract = new Contract(PILOT_INCOME_TOKEN_ID);
    const holdersOp = incomeTokenContract.call('holders');
    
    const sourceAccount = await server.getAccount(operatorKeypair.publicKey());
    const txBuilderHolders = new TransactionBuilder(sourceAccount, { fee: '100', networkPassphrase });
    txBuilderHolders.addOperation(holdersOp);
    
    const simResHolders = await server.simulateTransaction(txBuilderHolders.build());
    expect(rpc.Api.isSimulationSuccess(simResHolders)).toBe(true);
    
    let holders: string[] = [];
    if (rpc.Api.isSimulationSuccess(simResHolders) && simResHolders.result?.retval) {
      holders = scValToNative(simResHolders.result.retval) as string[];
    }
    expect(holders.length).toBeGreaterThan(0);

    // 3. Assert balances
    const usdcContract = new Contract(USDC_CONTRACT_ID);
    const totalIncome = 10000n;
    const expectedFee = (totalIncome * 10n) / 100n;
    const expectedRemainder = totalIncome - expectedFee;
    
    // Check fee recipient balance
    const feeBalanceOp = usdcContract.call('balance', nativeToScVal(platformFeeRecipient, { type: 'address' }));
    const txBuilderFee = new TransactionBuilder(sourceAccount, { fee: '100', networkPassphrase });
    txBuilderFee.addOperation(feeBalanceOp);
    
    const simResFee = await server.simulateTransaction(txBuilderFee.build());
    expect(rpc.Api.isSimulationSuccess(simResFee)).toBe(true);
    if (rpc.Api.isSimulationSuccess(simResFee) && simResFee.result?.retval) {
      const balance = BigInt(scValToNative(simResFee.result.retval));
      expect(balance).toBe(expectedFee);
    }

    // Check all pro-rata recipients and sum their balances
    let totalHoldersBalance = 0n;
    for (const holder of holders) {
      const proRataBalanceOp = usdcContract.call('balance', nativeToScVal(holder, { type: 'address' }));
      const txBuilderProRata = new TransactionBuilder(sourceAccount, { fee: '100', networkPassphrase });
      txBuilderProRata.addOperation(proRataBalanceOp);
      
      const simResProRata = await server.simulateTransaction(txBuilderProRata.build());
      expect(rpc.Api.isSimulationSuccess(simResProRata)).toBe(true);
      if (rpc.Api.isSimulationSuccess(simResProRata) && simResProRata.result?.retval) {
        totalHoldersBalance += BigInt(scValToNative(simResProRata.result.retval));
      }
    }
    
    expect(totalHoldersBalance).toBe(expectedRemainder);
  });

  async function waitTxConfirm(hash: string): Promise<rpc.Api.GetTransactionResponse> {
    let res: rpc.Api.GetTransactionResponse;
    for (let i = 0; i < 20; i++) {
      res = await server.getTransaction(hash);
      if (res.status !== 'NOT_FOUND') {
        return res;
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Transaction timeout');
  }
});
