// Auto-generated , DO NOT EDIT
import {Entity, FunctionPropertyNames, FieldsExpression, GetOptions } from "@subql/types-core";
import assert from 'assert';



export type UserBadgeProps = Omit<UserBadge, NonNullable<FunctionPropertyNames<UserBadge>> | '_name'>;

/*
 * Compat types allows for support of alternative `id` types without refactoring the node
 */
type CompatUserBadgeProps = Omit<UserBadgeProps, 'id'> & { id: string; };
type CompatEntity = Omit<Entity, 'id'> & { id: string; };

export class UserBadge implements CompatEntity {

    constructor(
        
        id: string,
        userAddress: string,
        issuer: string,
        communityAddress: string,
        name: string,
        userId: string,
        badgeId: string,
        communityId: string,
        communityMemberId: string,
    ) {
        this.id = id;
        this.userAddress = userAddress;
        this.issuer = issuer;
        this.communityAddress = communityAddress;
        this.name = name;
        this.userId = userId;
        this.badgeId = badgeId;
        this.communityId = communityId;
        this.communityMemberId = communityMemberId;
        
    }

    public id: string;
    public userAddress: string;
    public issuer: string;
    public communityAddress: string;
    public name: string;
    public createdAt?: bigint;
    public userId: string;
    public badgeId: string;
    public communityId: string;
    public communityMemberId: string;
    

    get _name(): string {
        return 'UserBadge';
    }

    async save(): Promise<void> {
        const id = this.id;
        assert(id !== null, "Cannot save UserBadge entity without an ID");
        await store.set('UserBadge', id.toString(), this as unknown as CompatUserBadgeProps);
    }

    static async remove(id: string): Promise<void> {
        assert(id !== null, "Cannot remove UserBadge entity without an ID");
        await store.remove('UserBadge', id.toString());
    }

    static async get(id: string): Promise<UserBadge | undefined> {
        assert((id !== null && id !== undefined), "Cannot get UserBadge entity without an ID");
        const record = await store.get('UserBadge', id.toString());
        if (record) {
            return this.create(record as unknown as UserBadgeProps);
        } else {
            return;
        }
    }

    static async getByUserAddress(userAddress: string, options: GetOptions<CompatUserBadgeProps>): Promise<UserBadge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatUserBadgeProps>('UserBadge', 'userAddress', userAddress, options);
        return records.map(record => this.create(record as unknown as UserBadgeProps));
    }
    

    static async getByIssuer(issuer: string, options: GetOptions<CompatUserBadgeProps>): Promise<UserBadge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatUserBadgeProps>('UserBadge', 'issuer', issuer, options);
        return records.map(record => this.create(record as unknown as UserBadgeProps));
    }
    

    static async getByCommunityAddress(communityAddress: string, options: GetOptions<CompatUserBadgeProps>): Promise<UserBadge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatUserBadgeProps>('UserBadge', 'communityAddress', communityAddress, options);
        return records.map(record => this.create(record as unknown as UserBadgeProps));
    }
    

    static async getByName(name: string, options: GetOptions<CompatUserBadgeProps>): Promise<UserBadge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatUserBadgeProps>('UserBadge', 'name', name, options);
        return records.map(record => this.create(record as unknown as UserBadgeProps));
    }
    

    static async getByUserId(userId: string, options: GetOptions<CompatUserBadgeProps>): Promise<UserBadge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatUserBadgeProps>('UserBadge', 'userId', userId, options);
        return records.map(record => this.create(record as unknown as UserBadgeProps));
    }
    

    static async getByBadgeId(badgeId: string, options: GetOptions<CompatUserBadgeProps>): Promise<UserBadge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatUserBadgeProps>('UserBadge', 'badgeId', badgeId, options);
        return records.map(record => this.create(record as unknown as UserBadgeProps));
    }
    

    static async getByCommunityId(communityId: string, options: GetOptions<CompatUserBadgeProps>): Promise<UserBadge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatUserBadgeProps>('UserBadge', 'communityId', communityId, options);
        return records.map(record => this.create(record as unknown as UserBadgeProps));
    }
    

    static async getByCommunityMemberId(communityMemberId: string, options: GetOptions<CompatUserBadgeProps>): Promise<UserBadge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatUserBadgeProps>('UserBadge', 'communityMemberId', communityMemberId, options);
        return records.map(record => this.create(record as unknown as UserBadgeProps));
    }
    


    /**
     * Gets entities matching the specified filters and options.
     *
     * ⚠️ This function will first search cache data followed by DB data. Please consider this when using order and offset options.⚠️
     * */
    static async getByFields(filter: FieldsExpression<UserBadgeProps>[], options: GetOptions<UserBadgeProps>): Promise<UserBadge[]> {
        const records = await store.getByFields<CompatUserBadgeProps>('UserBadge', filter  as unknown as FieldsExpression<CompatUserBadgeProps>[], options as unknown as GetOptions<CompatUserBadgeProps>);
        return records.map(record => this.create(record as unknown as UserBadgeProps));
    }

    static create(record: UserBadgeProps): UserBadge {
        assert(record.id !== undefined && record.id !== null, "id must be provided");
        const entity = new this(
            record.id,
            record.userAddress,
            record.issuer,
            record.communityAddress,
            record.name,
            record.userId,
            record.badgeId,
            record.communityId,
            record.communityMemberId,
        );
        Object.assign(entity,record);
        return entity;
    }
}
