import { Community, CommunityMember, User, Badge, UserBadge } from "../types";
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
import { Address, StrKey } from "@stellar/stellar-sdk";
import { xdr } from "@stellar/stellar-sdk";
import { createHash } from 'crypto';

const MOCK_COMMUNITY_ID = "community-1";

export async function handlerScorerFactoryCreateCommunity(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  try {
    const addresses = typeof event.value.value === 'function' 
      ? event.value.value() 
      : event.value.value;
    if (!Array.isArray(addresses)) {
      logger.error('addresses is not an array');
      logger.error(`addresses type: ${typeof addresses}`);
      logger.error(`addresses value: ${JSON.stringify(addresses, null, 2)}`);
      return;
    }
    if (addresses.length < 4) {
      logger.error('addresses array does not have enough elements');
      logger.error(`addresses length: ${addresses.length}`);
      logger.error(`addresses: ${JSON.stringify(addresses, null, 2)}`);
      return;
    }
    
    // First item is the deployer, second is the scorer contract
    const deployerScVal = addresses[0];
    const scorerAddressScVal = addresses[1];
    const deployerAddress = decodeAddress(deployerScVal as xdr.ScVal);
    const scorerAddress = decodeAddress(scorerAddressScVal as xdr.ScVal);
    const name = decodeString(addresses[2] as xdr.ScVal);
    const description = decodeString(addresses[3] as xdr.ScVal);
    
    // Create user if doesn't exist
    await checkAndGetUser(deployerAddress);
    
    // Create community record
    const communityAddress = scorerAddress.toLowerCase(); // Using scorer contract address as community ID
    let community = await Community.get(communityAddress);
    
    if (!community) {
      community = Community.create({
        id: communityAddress,
        communityAddress: communityAddress,
        factoryAddress: event.contractId?.contractId().toString().toLowerCase() ?? '',
        name: name,
        description: description,
        creatorAddress: deployerAddress.toLowerCase(),
        isHidden: false,
        blocktimestamp: BigInt(Date.parse(event.ledgerClosedAt || '') || 0),
        totalBadges: 0,
        lastIndexedAt: BigInt(Date.now())
      });
      
      await community.save();
      
      // Create community member for the creator
      await createCommunityMember(
        communityAddress,
        deployerAddress.toLowerCase(),
        true, // isManager
        true, // isCreator
        Date.parse(event.ledgerClosedAt || '') || 0
      );
    }

  } catch (e) {
    logger.error(`Failed to process community creation event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
    throw e;
  }
}

export async function handlerScorerFactoryRemoveCommunity(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  try {
    const addresses = typeof event.value.value === 'function' 
      ? event.value.value() 
      : event.value.value;
    
    if (!Array.isArray(addresses) || addresses.length < 2) {
      logger.error(`Invalid addresses format: ${JSON.stringify(addresses)}`);
      return;
    }
    
    const scorerAddressScVal = addresses[1];
    const scorerAddress = decodeAddress(scorerAddressScVal as xdr.ScVal);
    const communityAddress = scorerAddress.toLowerCase();
    
    // Update community as hidden
    let community = await Community.get(communityAddress);
    if (community) {
      community.isHidden = true;
      community.lastIndexedAt = BigInt(Date.now());
      await community.save();
    }
  } catch (e) {
    logger.error(`Failed to process community removal event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
    throw e;
  }
}

export async function handleScorerUserAdd(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  logger.info(
    `New user add event found at block ${event.ledger.sequence.toString()}`
  );
  
  try {
    const scorerAddress = event.contractId?.contractId().toString() ?? '';
    const communityAddress = scorerAddress.toLowerCase();
    logger.info(`Scorer address: ${scorerAddress}`);
    
    // Get community
    let community = await Community.get(communityAddress);
    if (!community) {
      logger.error(`Community not found for scorer address: ${scorerAddress}`);
      return;
    }
    
    // Get the raw value from the event
    const rawValue = typeof event.value.value === 'function' 
      ? event.value.value() 
      : event.value.value;
    
    // Process as direct ScAddress object
    logger.info(`Processing in direct ScAddress format`);
    
    let userAddress: string;
    try {
      userAddress = decodeScAddress(rawValue);
      logger.info(`Successfully decoded user address: ${userAddress}`);
    } catch (decodeError) {
      logger.error(`Failed to decode ScAddress: ${decodeError}`);
      return;
    }
    
    // Create user if doesn't exist
    await checkAndGetUser(userAddress);
    
    // Create community member
    await createCommunityMember(
      communityAddress,
      userAddress.toLowerCase(),
      false, // not a manager
      false, // not a creator
      Date.parse(event.ledgerClosedAt || '') || 0
    );

  } catch (e) {
    logger.error(`Failed to process user add event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
  }
}

// Add new function to decode the ScAddress format
function decodeScAddress(scAddressObj: any): string {
  try {
    // Check if the object follows the expected structure
    if (!scAddressObj || 
        scAddressObj._arm !== 'accountId' || 
        !scAddressObj._value || 
        scAddressObj._value._arm !== 'ed25519' || 
        !scAddressObj._value._value) {
      throw new Error('Invalid ScAddress object structure');
    }
    
    const valueObj = scAddressObj._value._value;
    
    // Handle Buffer format
    if (valueObj.type === 'Buffer' && Array.isArray(valueObj.data)) {
      return StrKey.encodeEd25519PublicKey(Buffer.from(valueObj.data));
    }
    
    // Handle numeric indexed object format
    if (typeof valueObj === 'object' && valueObj !== null) {
      const keys = Object.keys(valueObj);
      if (keys.length > 0 && keys.every(k => !isNaN(parseInt(k)))) {
        const byteArray = Array.from({ length: keys.length }, (_, i) => valueObj[i])
          .filter(val => val !== undefined);
        
        if (byteArray.length > 0) {
          return StrKey.encodeEd25519PublicKey(Buffer.from(byteArray));
        }
      }
    }
    
    throw new Error(`Unexpected ScAddress format: ${JSON.stringify(scAddressObj, null, 2)}`);
  } catch (e) {
    logger.error(`Failed to decode ScAddress: ${e}`);
    throw e;
  }
}

export async function handleScorerUserRemove(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  logger.info(
    `User remove event found at block ${event.ledger.sequence.toString()}`
  );
  try {
    const scorerAddress = event.contractId?.contractId().toString() ?? '';
    const communityAddress = scorerAddress.toLowerCase();
    
    // Get community
    let community = await Community.get(communityAddress);
    if (!community) {
      logger.error(`Community not found for scorer address: ${scorerAddress}`);
      return;
    }

    const addresses = typeof event.value.value === 'function' 
      ? event.value.value() 
      : event.value.value;

    if (!Array.isArray(addresses)) {
      logger.error(`Invalid addresses format: ${JSON.stringify(addresses)}`);
      return;
    }
    
    const userScVal = addresses[0]; // The user remove event only has the user
    const userAddress = decodeAddress(userScVal as xdr.ScVal);
    
    // Remove community member
    const memberId = `${communityAddress}-${userAddress.toLowerCase()}`;
    let member = await CommunityMember.get(memberId);
    
    if (member) {
      await CommunityMember.remove(memberId);
    } else {
      logger.warn(`User ${userAddress} is not a member of community ${communityAddress}`);
    }

  } catch (e) {
    logger.error(`Failed to process user remove event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
    throw e;
  }
}

// New handler for manager management
export async function handleScorerManagerAdd(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  try {
    const scorerAddress = event.contractId?.contractId().toString() ?? '';
    const communityAddress = scorerAddress.toLowerCase();
    
    // Get community
    let community = await Community.get(communityAddress);
    if (!community) {
      logger.error(`Community not found for scorer address: ${scorerAddress}`);
      return;
    }
    
    const addresses = typeof event.value.value === 'function' 
      ? event.value.value() 
      : event.value.value;

    if (!Array.isArray(addresses) || addresses.length < 2) {
      logger.error(`Invalid addresses format: ${JSON.stringify(addresses)}`);
      return;
    }
    
    const senderScVal = addresses[0];
    const managerScVal = addresses[1];
    const senderAddress = decodeAddress(senderScVal as xdr.ScVal);
    const managerAddress = decodeAddress(managerScVal as xdr.ScVal);
    
    // Create users if they don't exist
    await checkAndGetUser(senderAddress);
    await checkAndGetUser(managerAddress);
    
    // Update CommunityMember entity if exists
    const memberId = `${communityAddress}-${managerAddress.toLowerCase()}`;
    let member = await CommunityMember.get(memberId);
    
    if (member) {
      member.isManager = true;
      await member.save();
    } else {
      // Create new member with manager role
      await createCommunityMember(
        communityAddress,
        managerAddress.toLowerCase(),
        true, // isManager
        false, // not creator
        Date.parse(event.ledgerClosedAt || '') || 0
      );
    }
    
  } catch (e) {
    logger.error(`Failed to process manager add event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
    throw e;
  }
}

export async function handleScorerManagerRemove(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  try {
    const scorerAddress = event.contractId?.contractId().toString() ?? '';
    const communityAddress = scorerAddress.toLowerCase();
    
    // Get community
    let community = await Community.get(communityAddress);
    if (!community) {
      logger.error(`Community not found for scorer address: ${scorerAddress}`);
      return;
    }
    
    const addresses = typeof event.value.value === 'function' 
      ? event.value.value() 
      : event.value.value;

    if (!Array.isArray(addresses) || addresses.length < 2) {
      logger.error(`Invalid addresses format: ${JSON.stringify(addresses)}`);
      return;
    }
    
    const senderScVal = addresses[0];
    const managerScVal = addresses[1];
    const senderAddress = decodeAddress(senderScVal as xdr.ScVal);
    const managerAddress = decodeAddress(managerScVal as xdr.ScVal);
    
    // Update CommunityMember entity if exists
    const memberId = `${communityAddress}-${managerAddress.toLowerCase()}`;
    let member = await CommunityMember.get(memberId);
    
    if (member) {
      member.isManager = false;
      await member.save();
    }
    
  } catch (e) {
    logger.error(`Failed to process manager remove event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
    throw e;
  }
}

export async function handleScorerInit(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  try {
    const scorerAddress = event.contractId?.contractId().toString() ?? '';
    const communityAddress = scorerAddress.toLowerCase();
    
    const addresses = typeof event.value.value === 'function' 
      ? event.value.value() 
      : event.value.value;

    if (!Array.isArray(addresses) || addresses.length < 5) {
      logger.error(`Invalid addresses format: ${JSON.stringify(addresses)}`);
      return;
    }
    
    const creatorScVal = addresses[0];
    const managersScVal = addresses[1];
    const badgesScVal = addresses[2];
    const nameScVal = addresses[3];
    const descriptionScVal = addresses[4];
    
    const creatorAddress = decodeAddress(creatorScVal as xdr.ScVal);
    const name = decodeString(nameScVal as xdr.ScVal);
    const description = decodeString(descriptionScVal as xdr.ScVal);
    
    // Create user for creator
    await checkAndGetUser(creatorAddress);
    
    // Create community
    let community = await Community.get(communityAddress);
    if (!community) {
      community = Community.create({
        id: communityAddress,
        communityAddress: communityAddress,
        factoryAddress: '', // Factory address not available in init event
        name: name,
        description: description,
        creatorAddress: creatorAddress.toLowerCase(),
        isHidden: false,
        blocktimestamp: BigInt(Date.parse(event.ledgerClosedAt || '') || 0),
        totalBadges: 0,
        lastIndexedAt: BigInt(Date.now())
      });
      await community.save();
      
      // Create community member for creator
      await createCommunityMember(
        communityAddress,
        creatorAddress.toLowerCase(),
        true, // isManager
        true, // isCreator
        Date.parse(event.ledgerClosedAt || '') || 0
      );
    }
    
  } catch (e) {
    logger.error(`Failed to process init event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
    throw e;
  }
}

export async function handleScorerBadgeAdd(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  try {
    const scorerAddress = event.contractId?.contractId().toString() ?? '';
    const communityAddress = scorerAddress.toLowerCase();
    
    // Get community
    let community = await Community.get(communityAddress);
    if (!community) {
      logger.error(`Community not found for scorer address: ${scorerAddress}`);
      return;
    }
    
    const data = typeof event.value.value === 'function' 
      ? event.value.value() 
      : event.value.value;

    if (!Array.isArray(data) || data.length < 3) {
      logger.error(`Invalid data format: ${JSON.stringify(data)}`);
      return;
    }
    
    const badgeIdScVal = data[0];
    const scoreScVal = data[1];
    const senderScVal = data[2];
    
    // Badge ID contains name and issuer
    const badgeData = decodeObjectFromScVal(badgeIdScVal as xdr.ScVal);
    if (!badgeData || !badgeData.name || !badgeData.issuer) {
      logger.error(`Invalid badge data: ${JSON.stringify(badgeData)}`);
      return;
    }
    
    const badgeName = badgeData.name;
    const issuerAddress = badgeData.issuer.toLowerCase();
    const score = decodeU32FromScVal(scoreScVal as xdr.ScVal);
    const senderAddress = decodeAddress(senderScVal as xdr.ScVal);
    
    // Create badge with composite ID: issuer-communityAddress-name
    const badgeId = `${issuerAddress}-${communityAddress}-${badgeName}`;
    let badge = await Badge.get(badgeId);
    
    if (!badge) {
      badge = Badge.create({
        id: badgeId,
        issuer: issuerAddress,
        communityAddress: communityAddress,
        name: badgeName,
        score: score,
        type: 'standard', // Default type
        createdAt: BigInt(Date.parse(event.ledgerClosedAt || '') || 0),
        removedAt: undefined,
        communityId: communityAddress
      });
      
      await badge.save();
      
      // Update community total badges
      community.totalBadges += 1;
      community.lastIndexedAt = BigInt(Date.now());
      await community.save();
    }
    
  } catch (e) {
    logger.error(`Failed to process badge add event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
    throw e;
  }
}

export async function handleScorerBadgeRemove(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  try {
    const scorerAddress = event.contractId?.contractId().toString() ?? '';
    const communityAddress = scorerAddress.toLowerCase();
    
    // Get community
    let community = await Community.get(communityAddress);
    if (!community) {
      logger.error(`Community not found for scorer address: ${scorerAddress}`);
      return;
    }
    
    const data = typeof event.value.value === 'function' 
      ? event.value.value() 
      : event.value.value;

    if (!Array.isArray(data) || data.length < 3) {
      logger.error(`Invalid data format: ${JSON.stringify(data)}`);
      return;
    }
    
    const badgeIdScVal = data[0];
    const scoreScVal = data[1];
    const senderScVal = data[2];
    
    // Badge ID contains name and issuer
    const badgeData = decodeObjectFromScVal(badgeIdScVal as xdr.ScVal);
    if (!badgeData || !badgeData.name || !badgeData.issuer) {
      logger.error(`Invalid badge data: ${JSON.stringify(badgeData)}`);
      return;
    }
    
    const badgeName = badgeData.name;
    const issuerAddress = badgeData.issuer.toLowerCase();
    
    // Mark badge as removed using same composite ID format
    const badgeId = `${issuerAddress}-${communityAddress}-${badgeName}`;
    let badge = await Badge.get(badgeId);
    
    if (badge) {
      badge.removedAt = BigInt(Date.parse(event.ledgerClosedAt || '') || 0);
      await badge.save();
      
      // Update community total badges
      if (community.totalBadges > 0) {
        community.totalBadges -= 1;
      }
      community.lastIndexedAt = BigInt(Date.now());
      await community.save();
    }
    
  } catch (e) {
    logger.error(`Failed to process badge remove event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
    throw e;
  }
}

// Helper functions
async function checkAndGetUser(address: string): Promise<User> {
  const userAddress = address.toLowerCase();
  let user = await User.get(userAddress);
  
  if (!user) {
    user = User.create({
      id: userAddress,
      userAddress: userAddress
    });
    await user.save();
  }
  
  return user;
}

async function createCommunityMember(
  communityId: string,
  userAddress: string,
  isManager: boolean,
  isCreator: boolean,
  timestamp: number
): Promise<CommunityMember> {
  const memberId = `${communityId}-${userAddress}`;
  let member = await CommunityMember.get(memberId);
  
  if (!member) {
    member = CommunityMember.create({
      id: memberId,
      userAddress: userAddress,
      isManager: isManager,
      isCreator: isCreator,
      communityAddress: communityId,
      lastIndexedAt: BigInt(timestamp),
      points: 0,
      userId: userAddress,
      communityId: communityId
    });
    await member.save();
  }
  
  return member;
}

// Utility functions for decoding ScVal values
function decodeAddress(scVal: xdr.ScVal): string {
  try {
    return Address.account(scVal.address().accountId().ed25519()).toString();
  } catch (e) {
    try {
      // Tenta extrair como endereço de contrato
      return Address.contract(scVal.address().contractId()).toString();
    } catch (contractError) {
      // Se falhar nas abordagens padrão, tenta extrair manualmente do objeto
      try {
        const rawScVal = scVal as any;
        if (rawScVal._value && rawScVal._value._value && 
            rawScVal._value._value._value && 
            rawScVal._value._value._value.type === 'Buffer' && 
            Array.isArray(rawScVal._value._value._value.data)) {
          
          const bufferData = rawScVal._value._value._value.data;
          const keyBuffer = Buffer.from(bufferData);
          
          try {
            // Tenta usar StrKey para codificar a chave pública
            return StrKey.encodeEd25519PublicKey(keyBuffer);
          } catch (strKeyError) {
            // Último recurso: usar hash do buffer como identificador
            const hash = createHash('sha256').update(keyBuffer).digest('hex');
            return `G${hash.substring(0, 55)}`;
          }
        }
      } catch (fallbackError) {
        // Ignorar erros do fallback
      }
      
      // Se todas as tentativas falharem, registre o erro e lance uma exceção clara
      logger.error(`Failed to decode address, raw value: ${JSON.stringify(scVal)}`);
      throw new Error(`Cannot decode address from ScVal: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

function decodeString(scVal: xdr.ScVal): string {
  try {
    if (scVal.switch().name === 'scvString') {
      return scVal.str().toString();
    } else {
      logger.error(`Expected string ScVal but got ${scVal.switch().name}`);
      return '';
    }
  } catch (e) {
    logger.error(`Failed to decode string from ScVal: ${e}`);
    return '';
  }
}

function decodeU32FromScVal(scVal: xdr.ScVal): number {
  try {
    if (scVal.switch().name === 'scvU32') {
      return scVal.u32();
    } else {
      logger.error(`Expected u32 ScVal but got ${scVal.switch().name}`);
      return 0;
    }
  } catch (e) {
    logger.error(`Failed to decode u32 from ScVal: ${e}`);
    return 0;
  }
}

function decodeObjectFromScVal(scVal: xdr.ScVal): any {
  try {
    if (scVal.switch().name === 'scvMap') {
      const mapValue = scVal.map();
      if (!mapValue) {
        logger.error('Map value is null');
        return null;
      }
      
      const result: any = {};
      
      for (let i = 0; i < mapValue.length; i++) {
        const key = mapValue[i].key();
        const value = mapValue[i].val();
        
        // Decode key
        let keyName = '';
        if (key.switch().name === 'scvSymbol') {
          keyName = key.sym().toString();
        } else if (key.switch().name === 'scvString') {
          keyName = key.str().toString();
        }
        
        // Decode value based on type
        if (value.switch().name === 'scvString') {
          result[keyName] = value.str().toString();
        } else if (value.switch().name === 'scvAddress') {
          result[keyName] = decodeAddress(value);
        } else if (value.switch().name === 'scvU32') {
          result[keyName] = value.u32();
        }
      }
      
      return result;
    }
    
    return null;
  } catch (e) {
    logger.error(`Failed to decode object from ScVal: ${e}`);
    return null;
  }
}
