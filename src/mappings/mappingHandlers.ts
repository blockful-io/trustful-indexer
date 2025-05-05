import { Community, CommunityMember, User, Badge } from "../types";
import { SorobanEvent } from "@subql/types-stellar";
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
    
    // Get the factory address
    const factoryAddress = event.contractId?.contractId().toString().toLowerCase();
    
    // Using scorer contract address as community ID
    const communityAddress = scorerAddress.toLowerCase();
    
    // Check if community already exists from init event
    let community = await Community.get(communityAddress);
    
    if (community) {
      // Community already exists, update with factory address
      if (!community.factoryAddress && factoryAddress) {
        logger.info(`Updating existing community ${communityAddress} with factory address ${factoryAddress}`);
        community.factoryAddress = factoryAddress;
        community.lastIndexedAt = BigInt(Date.now());
        await community.save();
      }
    } else {
      // Community doesn't exist yet, create with available information
      community = Community.create({
        id: communityAddress,
        communityAddress: communityAddress,
        factoryAddress: factoryAddress,
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
    const community = await getValidCommunity(communityAddress, 'RemoveCommunity');
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
    const community = await getValidCommunity(communityAddress, 'UserAdd');
    if (!community) {
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
    
    // Check if member already exists but was removed
    const memberId = `${communityAddress}-${userAddress.toLowerCase()}`;
    let existingMember = await CommunityMember.get(memberId);
    
    if (existingMember) {
      // If member exists but was removed, reactivate them
      if (!existingMember.isMember) {
        existingMember.isMember = true;
        existingMember.lastIndexedAt = BigInt(Date.parse(event.ledgerClosedAt || '') || Date.now());
        await existingMember.save();
        logger.info(`User ${userAddress} reactivated in community ${communityAddress}`);
      }
    } else {
      // Create new community member
      await createCommunityMember(
        communityAddress,
        userAddress.toLowerCase(),
        false, // not a manager
        false, // not a creator
        Date.parse(event.ledgerClosedAt || '') || 0
      );
    }

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
    const community = await getValidCommunity(communityAddress, 'UserRemove');
    if (!community) {
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
    
    // Find community member
    const memberId = `${communityAddress}-${userAddress.toLowerCase()}`;
    let member = await CommunityMember.get(memberId);
    
    if (member) {
      // Update member as not active instead of removing
      // Note: This only changes membership status, not manager status
      member.isMember = false;
      member.lastIndexedAt = BigInt(Date.parse(event.ledgerClosedAt || '') || Date.now());
      await member.save();
      logger.info(`User ${userAddress} marked as removed from community ${communityAddress}`);
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
    const community = await getValidCommunity(communityAddress, 'ManagerAdd');
    if (!community) {
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
      member.isMember = true; // Ensure the user is also a member when adding as manager
      member.lastIndexedAt = BigInt(Date.parse(event.ledgerClosedAt || '') || Date.now());
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
    const community = await getValidCommunity(communityAddress, 'ManagerRemove');
    if (!community) {
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
      member.lastIndexedAt = BigInt(Date.parse(event.ledgerClosedAt || '') || Date.now());
      await member.save();
      logger.info(`User ${managerAddress} manager role removed in community ${communityAddress}`);
    }
    
  } catch (e) {
    logger.error(`Failed to process manager remove event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
    throw e;
  }
}

/**
 * Processes community initialization event
 * @param event Soroban event from contract
 */
export async function handleScorerInit(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  try {
    const scorerAddress = event.contractId?.contractId().toString() ?? '';
    const communityAddress = scorerAddress.toLowerCase();
    logger.info(`Processing init event for community ${communityAddress}`);
    
    // Parse event values
    const values = extractEventValues(event);
    if (!values || values.length < 6) {
      logger.error(`Invalid values format for init event`);
      return;
    }
    
    // Extract values from event
    const creatorAddress = extractCreatorAddress(values[0]);
    const communityData = extractCommunityData(values[3], values[4], values[5]);
    
    // Create user record for creator
    await checkAndGetUser(creatorAddress);
    
    // Check if community already exists
    let community = await Community.get(communityAddress);
    
    if (!community) {
      // Create new community without factory address (will be filled by factory event handler)
      community = await createCommunity(
        communityAddress, 
        "", // Empty factory address for now
        creatorAddress, 
        communityData.name, 
        communityData.description, 
        communityData.icon,
        event.ledgerClosedAt
      );
      
      // Process managers vector
      await processManagers(values[1], community, creatorAddress, event.ledgerClosedAt);
      
      // Process badges map
      await processBadges(values[2], community, creatorAddress, event.ledgerClosedAt);
    } else {
      // Community exists, update with additional data if needed
      let needsUpdate = false;
      
      if (!community.name && communityData.name) {
        community.name = communityData.name;
        needsUpdate = true;
      }
      
      if (!community.description && communityData.description) {
        community.description = communityData.description;
        needsUpdate = true;
      }
      
      if (!community.icon && communityData.icon) {
        community.icon = communityData.icon;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        community.lastIndexedAt = BigInt(Date.now());
        await community.save();
        logger.info(`Updated existing community ${communityAddress} with data from init event`);
      }
      
      // Always process managers and badges as they might be updated
      await processManagers(values[1], community, creatorAddress, event.ledgerClosedAt);
      await processBadges(values[2], community, creatorAddress, event.ledgerClosedAt);
    }
  } catch (e) {
    logger.error(`Failed to process init event: ${e}`);
    logger.error(`Full event data: ${JSON.stringify(event, null, 2)}`);
    throw e;
  }
}

/**
 * Extracts values from event
 */
function extractEventValues(event: SorobanEvent): any[] | null {
  const values = typeof event.value.value === 'function' 
    ? event.value.value() 
    : event.value.value;
  
  if (!Array.isArray(values)) {
    return null;
  }
  
  return values;
}

/**
 * Extracts creator address from ScVal
 */
function extractCreatorAddress(creatorScVal: any): string {
  const creatorAddress = decodeAddress(creatorScVal as xdr.ScVal);
  logger.info(`Creator address: ${creatorAddress}`);
  return creatorAddress;
}

/**
 * Extracts community data (name, description, icon) from ScVals
 */
function extractCommunityData(nameScVal: any, descriptionScVal: any, iconScVal: any): { 
  name: string, 
  description: string, 
  icon: string 
} {
  let name = "";
  let description = "";
  let icon = "";
  
  if (nameScVal && (nameScVal as xdr.ScVal).switch && (nameScVal as xdr.ScVal).switch().name === 'scvString') {
    name = decodeString(nameScVal as xdr.ScVal);
  }
  
  if (descriptionScVal && (descriptionScVal as xdr.ScVal).switch && (descriptionScVal as xdr.ScVal).switch().name === 'scvString') {
    description = decodeString(descriptionScVal as xdr.ScVal);
  }
  
  if (iconScVal && (iconScVal as xdr.ScVal).switch && (iconScVal as xdr.ScVal).switch().name === 'scvString') {
    icon = decodeString(iconScVal as xdr.ScVal);
  }
  
  return { name, description, icon };
}

/**
 * Creates a new community record
 */
async function createCommunity(
  communityAddress: string,
  factoryAddress: string,
  creatorAddress: string,
  name: string,
  description: string,
  icon: string,
  ledgerClosedAt?: string
): Promise<Community> {
  const community = Community.create({
    id: communityAddress,
    communityAddress: communityAddress,
    factoryAddress: factoryAddress,
    name: name,
    description: description,
    icon: icon,
    creatorAddress: creatorAddress.toLowerCase(),
    isHidden: false,
    blocktimestamp: BigInt(Date.parse(ledgerClosedAt || '') || 0),
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
    Date.parse(ledgerClosedAt || '') || 0
  );
  
  return community;
}

/**
 * Processes managers vector from init event
 */
async function processManagers(
  managersScVal: any, 
  community: Community, 
  creatorAddress: string,
  ledgerClosedAt?: string
): Promise<void> {
  try {
    const rawManagersObj = managersScVal as any;
    
    if (!rawManagersObj || 
        rawManagersObj._switch?.name !== 'scvVec' || 
        !Array.isArray(rawManagersObj._value)) {
      logger.warn("Managers value is not a valid vector");
      return;
    }
    
    const managerAddresses = rawManagersObj._value;
    logger.info(`Processing ${managerAddresses.length} managers from vector`);
    
    let successCount = 0;
    for (let i = 0; i < managerAddresses.length; i++) {
      try {
        const addrItem = managerAddresses[i];
        if (addrItem._switch?.name !== 'scvAddress') {
          continue;
        }
        
        const managerAddress = decodeScValAddress(addrItem);
        logger.info(`Manager ${i}: ${managerAddress}`);
        
        // Skip creator as they're already added
        if (managerAddress.toLowerCase() === creatorAddress.toLowerCase()) {
          continue;
        }
        
        // Create user and add as community manager
        await checkAndGetUser(managerAddress);
        await createCommunityMember(
          community.id,
          managerAddress.toLowerCase(),
          true, // isManager
          false, // not creator
          Date.parse(ledgerClosedAt || '') || 0
        );
        
        successCount++;
      } catch (addrError) {
        logger.error(`Failed to process manager address ${i}: ${addrError}`);
      }
    }
    
    logger.info(`Successfully added ${successCount} additional managers`);
  } catch (e) {
    logger.error(`Failed to process managers: ${e}`);
  }
}

/**
 * Processes badges map or vector from init event
 */
async function processBadges(
  badgesScVal: any, 
  community: Community, 
  creatorAddress: string,
  ledgerClosedAt?: string
): Promise<void> {
  try {
    const rawBadgesObj = badgesScVal as any;
    
    // Process badges as map structure (BadgeId => score)
    if (rawBadgesObj?._switch?.name === 'scvMap' && Array.isArray(rawBadgesObj._value)) {
      await processBadgesMap(rawBadgesObj._value, community, ledgerClosedAt);
    }
    // Process badges as vector of addresses
    else if (rawBadgesObj?._switch?.name === 'scvVec' && Array.isArray(rawBadgesObj._value)) {
      await processBadgesVector(rawBadgesObj._value, community, creatorAddress, ledgerClosedAt);
    }
    else {
      logger.warn(`Badges data in unexpected format: ${rawBadgesObj?._switch?.name}`);
    }
    
    // Update community with processed badges
    community.lastIndexedAt = BigInt(Date.now());
    await community.save();
  } catch (e) {
    logger.error(`Failed to process badges: ${e}`);
  }
}

/**
 * Processes badges in map format (BadgeId => score)
 */
async function processBadgesMap(
  badgeEntries: any[],
  community: Community,
  ledgerClosedAt?: string
): Promise<void> {
  logger.info(`Processing ${badgeEntries.length} badges from map structure`);
  
  let successCount = 0;
  for (let i = 0; i < badgeEntries.length; i++) {
    try {
      const badge = await extractAndCreateBadge(
        badgeEntries[i], 
        i, 
        community.id,
        ledgerClosedAt
      );
      
      if (badge) {
        community.totalBadges += 1;
        successCount++;
      }
    } catch (entryError) {
      logger.error(`Failed to process badge entry ${i}: ${entryError}`);
    }
  }
  
  logger.info(`Successfully created ${successCount} badges out of ${badgeEntries.length}`);
}

/**
 * Extracts badge data from entry and creates badge record
 */
async function extractAndCreateBadge(
  entry: any,
  index: number,
  communityAddress: string,
  ledgerClosedAt?: string
): Promise<Badge | null> {
  if (!entry || !entry._attributes) {
    return null;
  }
  
  const keyObj = entry._attributes.key;
  const valObj = entry._attributes.val;
  
  if (!keyObj || !valObj || keyObj._switch?.name !== 'scvVec' || 
      !Array.isArray(keyObj._value) || keyObj._value.length < 2) {
    return null;
  }
  
  // Extract badge name and address
  const nameScVal = keyObj._value[0];
  const addressScVal = keyObj._value[1];
  
  if (nameScVal._switch?.name !== 'scvString' || !addressScVal || addressScVal._switch?.name !== 'scvAddress') {
    return null;
  }
  
  let badgeName = nameScVal.str().toString();
  
  // Extract issuer address
  let issuerAddress;
  try {
    issuerAddress = decodeScValAddress(addressScVal);
  } catch (addrErr) {
    return null;
  }
  
  // Extract score
  let score = 1;
  if (valObj._switch?.name === 'scvU32') {
    score = Number(valObj._value || 1);
  }
  
  logger.info(`Badge ${index}: ${badgeName} (issuer: ${issuerAddress}, score: ${score})`);
  
  // Create badge record if it doesn't exist
  const badgeId = `${issuerAddress.toLowerCase()}-${communityAddress}-${badgeName}`;
  let badge = await Badge.get(badgeId);
  
  if (!badge) {
    badge = Badge.create({
      id: badgeId,
      issuer: issuerAddress.toLowerCase(),
      communityAddress: communityAddress,
      name: badgeName,
      score: score,
      type: 'custom',
      createdAt: BigInt(Date.parse(ledgerClosedAt || '') || 0),
      removedAt: undefined,
      communityId: communityAddress
    });
    
    await badge.save();
    return badge;
  }
  
  return null;
}

/**
 * Processes badges as a vector of addresses
 */
async function processBadgesVector(
  addresses: any[],
  community: Community,
  creatorAddress: string,
  ledgerClosedAt?: string
): Promise<void> {
  logger.info(`Processing ${addresses.length} badge addresses from vector format`);
  
  let successCount = 0;
  for (let i = 0; i < addresses.length; i++) {
    try {
      const addrItem = addresses[i];
      if (addrItem._switch?.name !== 'scvAddress') {
        continue;
      }
      
      const address = decodeScValAddress(addrItem);
      const badgeName = `Badge-${i+1}`;
      const score = 1;
      
      // Create badge record
      const badgeId = `${creatorAddress.toLowerCase()}-${community.id}-${badgeName}`;
      let badge = await Badge.get(badgeId);
      
      if (!badge) {
        badge = Badge.create({
          id: badgeId,
          issuer: creatorAddress.toLowerCase(),
          communityAddress: community.id,
          name: badgeName,
          score: score,
          type: 'Custom',
          createdAt: BigInt(Date.parse(ledgerClosedAt || '') || 0),
          removedAt: undefined,
          communityId: community.id
        });
        
        await badge.save();
        community.totalBadges += 1;
        successCount++;
      }
    } catch (addrError) {
      logger.error(`Failed to process badge address ${i}: ${addrError}`);
    }
  }
  
  logger.info(`Successfully created ${successCount} badges from vector format`);
}

// Helper function to decode an address directly from a ScVal object
function decodeScValAddress(scValObj: any): string {
  try {
    // Check basic structure
    if (!scValObj || 
        !scValObj._value || 
        !scValObj._value._value || 
        !scValObj._value._value._value) {
      throw new Error('Invalid ScVal address structure');
    }
    
    const valueObj = scValObj._value._value._value;
    
    // Process Buffer format
    if (valueObj.type === 'Buffer' && Array.isArray(valueObj.data)) {
      return StrKey.encodeEd25519PublicKey(Buffer.from(valueObj.data));
    }
    
    // Process object with numeric indices
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
    
    throw new Error(`Unexpected address format: ${JSON.stringify(scValObj, null, 2)}`);
  } catch (e) {
    logger.error(`Failed to decode ScVal address: ${e}`);
    throw e;
  }
}

export async function handleScorerBadgeAdd(event: SorobanEvent): Promise<void> {
  if (!event.ledger) throw new Error('Event ledger is null');
  try {
    const scorerAddress = event.contractId?.contractId().toString() ?? '';
    const communityAddress = scorerAddress.toLowerCase();
    
    // Get community
    const community = await getValidCommunity(communityAddress, 'BadgeAdd');
    if (!community) {
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
        type: 'custom', // Default type
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
    const community = await getValidCommunity(communityAddress, 'BadgeRemove');
    if (!community) {
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
      isMember: true,
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
      // Try to extract as contract address
      return Address.contract(scVal.address().contractId()).toString();
    } catch (contractError) {
      // If standard approaches fail, try to extract manually from the object
      try {
        const rawScVal = scVal as any;
        if (rawScVal._value && rawScVal._value._value && 
            rawScVal._value._value._value && 
            rawScVal._value._value._value.type === 'Buffer' && 
            Array.isArray(rawScVal._value._value._value.data)) {
          
          const bufferData = rawScVal._value._value._value.data;
          const keyBuffer = Buffer.from(bufferData);
          
          try {
            // Try to use StrKey to encode the public key
            return StrKey.encodeEd25519PublicKey(keyBuffer);
          } catch (strKeyError) {
            // Last resort: use hash of buffer as identifier
            const hash = createHash('sha256').update(keyBuffer).digest('hex');
            return `G${hash.substring(0, 55)}`;
          }
        }
      } catch (fallbackError) {
        // Ignore fallback errors
      }
      
      // If all attempts fail, log the error and throw a clear exception
      logger.error(`Failed to decode address, raw value: ${JSON.stringify(scVal)}`);
      throw new Error(`Cannot decode address from ScVal: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

function decodeString(scVal: xdr.ScVal): string {
  try {
    if (scVal && scVal.switch && scVal.switch().name === 'scvString') {
      return scVal.str().toString();
    } else {
      const type = scVal && scVal.switch ? scVal.switch().name : typeof scVal;
      logger.error(`Expected string ScVal but got ${type}`);
      logger.error(`Value: ${JSON.stringify(scVal)}`);
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
        
        // Debug log
        logger.info(`Decoding map entry ${i}: key=${keyName}, valueType=${value.switch().name}`);
        
        // Decode value based on type
        if (value.switch().name === 'scvString') {
          result[keyName] = value.str().toString();
        } else if (value.switch().name === 'scvAddress') {
          result[keyName] = decodeAddress(value);
        } else if (value.switch().name === 'scvU32') {
          result[keyName] = value.u32();
        } else if (value.switch().name === 'scvMap') {
          // If value is another map, decode recursively
          result[keyName] = decodeObjectFromScVal(value);
        } else {
          // For other types, store type name for debugging
          result[keyName] = `[${value.switch().name}]`;
          logger.info(`Unhandled value type ${value.switch().name} for key ${keyName}`);
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

/**
 * Gets community with validation
 * Returns the community if found, or null with a warning log if not found
 */
async function getValidCommunity(communityAddress: string, handlerName: string): Promise<Community | null> {
  const community = await Community.get(communityAddress);
  if (!community) {
    logger.warn(`[${handlerName}] Community not found for address: ${communityAddress}`);
    return null;
  }
  return community;
}
