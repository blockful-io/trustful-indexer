import { Account, Credit, Debit, Payment, Transfer, UserAddition } from "../types";
import {
  StellarOperation,
  StellarEffect,
  SorobanEvent,
} from "@subql/types-stellar";
import {
  AccountCredited,
  AccountDebited,
} from "@stellar/stellar-sdk/lib/horizon/types/effects";
import { Horizon } from "@stellar/stellar-sdk";
import { Address } from "@stellar/stellar-sdk";
import { xdr } from "@stellar/stellar-sdk";

export async function handleOperation(
  op: StellarOperation<Horizon.HorizonApi.PaymentOperationResponse>,
): Promise<void> {
  logger.info(`Indexing operation ${op.id}, type: ${op.type}`);

  if (!op.ledger) throw new Error('Operation ledger is null');
  const fromAccount = await checkAndGetAccount(op.from, op.ledger.sequence);
  const toAccount = await checkAndGetAccount(op.to, op.ledger.sequence);

  const payment = Payment.create({
    id: op.id,
    fromId: fromAccount.id,
    toId: toAccount.id,
    txHash: op.transaction_hash,
    amount: op.amount,
  });

  fromAccount.lastSeenLedger = op.ledger.sequence;
  toAccount.lastSeenLedger = op.ledger.sequence;
  await Promise.all([fromAccount.save(), toAccount.save(), payment.save()]);
}

export async function handleCredit(
  effect: StellarEffect<AccountCredited>,
): Promise<void> {
  logger.info(`Indexing effect ${effect.id}, type: ${effect.type}`);

  if (!effect.ledger) throw new Error('Effect ledger is null');
  const account = await checkAndGetAccount(
    effect.account,
    effect.ledger.sequence,
  );

  const credit = Credit.create({
    id: effect.id,
    accountId: account.id,
    amount: effect.amount,
  });

  account.lastSeenLedger = effect.ledger.sequence;
  await Promise.all([account.save(), credit.save()]);
}

export async function handleScorerUserAdd(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  logger.info(
    `New user add event found at block ${event.ledger.sequence.toString()}`
  );
  try {
    logger.info('Debug info:');
    logger.info(`event.value type: ${typeof event.value}`);
    
    // Tenta acessar value() como função
    const addresses = typeof event.value.value === 'function' 
      ? event.value.value() 
      : event.value.value;
    
    logger.info(`addresses after function call type: ${typeof addresses}`);
    logger.info(`addresses after function call: ${JSON.stringify(addresses, null, 2)}`);
    if (!Array.isArray(addresses)) {
      logger.error('addresses is not an array');
      logger.error(`addresses type: ${typeof addresses}`);
      logger.error(`addresses value: ${JSON.stringify(addresses, null, 2)}`);
      return;
    }
    if (addresses.length < 2) {
      logger.error('addresses array does not have 2 elements');
      logger.error(`addresses length: ${addresses.length}`);
      logger.error(`addresses: ${JSON.stringify(addresses, null, 2)}`);
      return;
    }
    // Primeiro item é o sender, segundo é o user
    const senderScVal = addresses[0];
    const userScVal = addresses[1];
    logger.info(`Sender ScVal: ${JSON.stringify(senderScVal, null, 2)}`);
    logger.info(`User ScVal: ${JSON.stringify(userScVal, null, 2)}`);
    const senderAddress = decodeAddress(senderScVal as xdr.ScVal);
    const userAddress = decodeAddress(userScVal as xdr.ScVal);
    logger.info(`Decoded sender address: ${senderAddress}`);
    logger.info(`Decoded user address: ${userAddress}`);
    // Criar ou obter as contas
    const senderAccount = await checkAndGetAccount(
      senderAddress,
      event.ledger.sequence
    );
    const userAccount = await checkAndGetAccount(
      userAddress,
      event.ledger.sequence
    );
    // Criar a nova entidade UserAddition
    const userAddition = UserAddition.create({
      id: event.id,
      ledger: event.ledger.sequence,
      timestamp: new Date(event.ledgerClosedAt),
      senderId: senderAccount.id,
      userId: userAccount.id,
      contract: event.contractId?.contractId().toString() ?? ''
    });
    // Atualizar lastSeenLedger para ambas as contas
    senderAccount.lastSeenLedger = event.ledger.sequence;
    userAccount.lastSeenLedger = event.ledger.sequence;
    // Salvar todas as entidades
    await Promise.all([
      senderAccount.save(),
      userAccount.save(),
      userAddition.save()
    ]);
  } catch (e) {
    logger.error(`Failed to process user add event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
    throw e;
  }
}

export async function handleDebit(
  effect: StellarEffect<AccountDebited>,
): Promise<void> {
  logger.info(`Indexing effect ${effect.id}, type: ${effect.type}`);

  if (!effect.ledger) throw new Error('Effect ledger is null');
  const account = await checkAndGetAccount(
    effect.account,
    effect.ledger.sequence,
  );

  const debit = Debit.create({
    id: effect.id,
    accountId: account.id,
    amount: effect.amount,
  });

  account.lastSeenLedger = effect.ledger.sequence;
  await Promise.all([account.save(), debit.save()]);
}

export async function handleEvent(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  logger.info(
    `New transfer event found at block ${event.ledger.sequence.toString()}`,
  );

  // Get data from the event
  // The transfer event has the following payload \[env, from, to\]
  // logger.info(JSON.stringify(event));
  const {
    topic: [env, from, to],
  } = event;

  try {
    decodeAddress(from);
    decodeAddress(to);
  } catch (e) {
    logger.info(`decode address failed`);
  }

  const fromAccount = await checkAndGetAccount(
    decodeAddress(from),
    event.ledger.sequence,
  );
  const toAccount = await checkAndGetAccount(
    decodeAddress(to),
    event.ledger.sequence,
  );

  // Create the new transfer entity
  const transfer = Transfer.create({
    id: event.id,
    ledger: event.ledger.sequence,
    date: new Date(event.ledgerClosedAt),
    contract: event.contractId?.contractId().toString()!,
    fromId: fromAccount.id,
    toId: toAccount.id,
    value: BigInt(event.value.toString()),
  });

  fromAccount.lastSeenLedger = event.ledger.sequence;
  toAccount.lastSeenLedger = event.ledger.sequence;
  await Promise.all([fromAccount.save(), toAccount.save(), transfer.save()]);
}

async function checkAndGetAccount(
  id: string,
  ledgerSequence: number,
): Promise<Account> {
  let account = await Account.get(id.toLowerCase());
  if (!account) {
    // We couldn't find the account
    account = Account.create({
      id: id.toLowerCase(),
      firstSeenLedger: ledgerSequence,
    });
  }
  return account;
}

// scValToNative not works, temp solution
function decodeAddress(scVal: xdr.ScVal): string {
  try {
    return Address.account(scVal.address().accountId().ed25519()).toString();
  } catch (e) {
    return Address.contract(scVal.address().contractId()).toString();
  }
}
