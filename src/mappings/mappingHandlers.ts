import { Account, UserAddition, Community, CommunityMember } from "../types";
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

const MOCK_COMMUNITY_ID = "community-1";

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
      timestamp: event.ledgerClosedAt.toString(),
      senderId: senderAccount.id,
      userId: userAccount.id,
      contract: event.contractId?.contractId().toString() ?? ''
    });
    // Atualizar lastSeenLedger para ambas as contas
    senderAccount.lastSeenLedger = event.ledger.sequence;
    userAccount.lastSeenLedger = event.ledger.sequence;

    // Get or create the mock community
    let community = await Community.get(MOCK_COMMUNITY_ID);
    if (!community) {
      community = Community.create({
        id: MOCK_COMMUNITY_ID,
        issuer: "mock-issuer",
        name: "Mock Community",
        description: "A mock community for testing",
        totalMembers: 0
      });
    }

    // Create community member
    const memberId = `${MOCK_COMMUNITY_ID}-${userAddress.toLowerCase()}`;
    let member = await CommunityMember.get(memberId);
    
    if (!member) {
      member = CommunityMember.create({
        id: memberId,
        userId: userAddress.toLowerCase(),
        communityId: community.id,
        score: 1.0, // Mock initial score
        lastScoreUpdate: event.ledgerClosedAt.toString()
      });
      
      // Increment total members
      community.totalMembers += 1;
    }

    // Salvar todas as entidades
    await Promise.all([
      senderAccount.save(),
      userAccount.save(),
      userAddition.save(),
      community.save(),
      member.save()
    ]);
  } catch (e) {
    logger.error(`Failed to process user add event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
    throw e;
  }
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
