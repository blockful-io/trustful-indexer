// Auto-generated , DO NOT EDIT
import {Entity, FunctionPropertyNames, FieldsExpression, GetOptions } from "@subql/types-core";
import assert from 'assert';



export type CommunityMemberProps = Omit<CommunityMember, NonNullable<FunctionPropertyNames<CommunityMember>> | '_name'>;

/*
 * Compat types allows for support of alternative `id` types without refactoring the node
 */
type CompatCommunityMemberProps = Omit<CommunityMemberProps, 'id'> & { id: string; };
type CompatEntity = Omit<Entity, 'id'> & { id: string; };

export class CommunityMember implements CompatEntity {

    constructor(
        
        id: string,
        userAddress: string,
        isManager: boolean,
        isCreator: boolean,
        isMember: boolean,
        communityAddress: string,
        lastIndexedAt: bigint,
        points: number,
        userId: string,
        communityId: string,
    ) {
        this.id = id;
        this.userAddress = userAddress;
        this.isManager = isManager;
        this.isCreator = isCreator;
        this.isMember = isMember;
        this.communityAddress = communityAddress;
        this.lastIndexedAt = lastIndexedAt;
        this.points = points;
        this.userId = userId;
        this.communityId = communityId;
        
    }

    public id: string;
    public userAddress: string;
    public isManager: boolean;
    public isCreator: boolean;
    public isMember: boolean;
    public communityAddress: string;
    public lastIndexedAt: bigint;
    public points: number;
    public userId: string;
    public communityId: string;
    

    get _name(): string {
        return 'CommunityMember';
    }

    async save(): Promise<void> {
        const id = this.id;
        assert(id !== null, "Cannot save CommunityMember entity without an ID");
        await store.set('CommunityMember', id.toString(), this as unknown as CompatCommunityMemberProps);
    }

    static async remove(id: string): Promise<void> {
        assert(id !== null, "Cannot remove CommunityMember entity without an ID");
        await store.remove('CommunityMember', id.toString());
    }

    static async get(id: string): Promise<CommunityMember | undefined> {
        assert((id !== null && id !== undefined), "Cannot get CommunityMember entity without an ID");
        const record = await store.get('CommunityMember', id.toString());
        if (record) {
            return this.create(record as unknown as CommunityMemberProps);
        } else {
            return;
        }
    }

    static async getByUserAddress(userAddress: string, options: GetOptions<CompatCommunityMemberProps>): Promise<CommunityMember[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatCommunityMemberProps>('CommunityMember', 'userAddress', userAddress, options);
        return records.map(record => this.create(record as unknown as CommunityMemberProps));
    }
    

    static async getByCommunityAddress(communityAddress: string, options: GetOptions<CompatCommunityMemberProps>): Promise<CommunityMember[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatCommunityMemberProps>('CommunityMember', 'communityAddress', communityAddress, options);
        return records.map(record => this.create(record as unknown as CommunityMemberProps));
    }
    

    static async getByUserId(userId: string, options: GetOptions<CompatCommunityMemberProps>): Promise<CommunityMember[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatCommunityMemberProps>('CommunityMember', 'userId', userId, options);
        return records.map(record => this.create(record as unknown as CommunityMemberProps));
    }
    

    static async getByCommunityId(communityId: string, options: GetOptions<CompatCommunityMemberProps>): Promise<CommunityMember[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatCommunityMemberProps>('CommunityMember', 'communityId', communityId, options);
        return records.map(record => this.create(record as unknown as CommunityMemberProps));
    }
    


    /**
     * Gets entities matching the specified filters and options.
     *
     * ⚠️ This function will first search cache data followed by DB data. Please consider this when using order and offset options.⚠️
     * */
    static async getByFields(filter: FieldsExpression<CommunityMemberProps>[], options: GetOptions<CommunityMemberProps>): Promise<CommunityMember[]> {
        const records = await store.getByFields<CompatCommunityMemberProps>('CommunityMember', filter  as unknown as FieldsExpression<CompatCommunityMemberProps>[], options as unknown as GetOptions<CompatCommunityMemberProps>);
        return records.map(record => this.create(record as unknown as CommunityMemberProps));
    }

    static create(record: CommunityMemberProps): CommunityMember {
        assert(record.id !== undefined && record.id !== null, "id must be provided");
        const entity = new this(
            record.id,
            record.userAddress,
            record.isManager,
            record.isCreator,
            record.isMember,
            record.communityAddress,
            record.lastIndexedAt,
            record.points,
            record.userId,
            record.communityId,
        );
        Object.assign(entity,record);
        return entity;
    }
}
