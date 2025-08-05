// Auto-generated , DO NOT EDIT
import {Entity, FunctionPropertyNames, FieldsExpression, GetOptions } from "@subql/types-core";
import assert from 'assert';



export type BadgeProps = Omit<Badge, NonNullable<FunctionPropertyNames<Badge>> | '_name'>;

/*
 * Compat types allows for support of alternative `id` types without refactoring the node
 */
type CompatBadgeProps = Omit<BadgeProps, 'id'> & { id: string; };
type CompatEntity = Omit<Entity, 'id'> & { id: string; };

export class Badge implements CompatEntity {

    constructor(
        
        id: string,
        issuer: string,
        communityAddress: string,
        name: string,
        score: number,
        type: string,
        communityId: string,
    ) {
        this.id = id;
        this.issuer = issuer;
        this.communityAddress = communityAddress;
        this.name = name;
        this.score = score;
        this.type = type;
        this.communityId = communityId;
        
    }

    public id: string;
    public issuer: string;
    public communityAddress: string;
    public name: string;
    public score: number;
    public type: string;
    public createdAt?: bigint;
    public removedAt?: bigint;
    public communityId: string;
    

    get _name(): string {
        return 'Badge';
    }

    async save(): Promise<void> {
        const id = this.id;
        assert(id !== null, "Cannot save Badge entity without an ID");
        await store.set('Badge', id.toString(), this as unknown as CompatBadgeProps);
    }

    static async remove(id: string): Promise<void> {
        assert(id !== null, "Cannot remove Badge entity without an ID");
        await store.remove('Badge', id.toString());
    }

    static async get(id: string): Promise<Badge | undefined> {
        assert((id !== null && id !== undefined), "Cannot get Badge entity without an ID");
        const record = await store.get('Badge', id.toString());
        if (record) {
            return this.create(record as unknown as BadgeProps);
        } else {
            return;
        }
    }

    static async getByIssuer(issuer: string, options: GetOptions<CompatBadgeProps>): Promise<Badge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatBadgeProps>('Badge', 'issuer', issuer, options);
        return records.map(record => this.create(record as unknown as BadgeProps));
    }
    

    static async getByCommunityAddress(communityAddress: string, options: GetOptions<CompatBadgeProps>): Promise<Badge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatBadgeProps>('Badge', 'communityAddress', communityAddress, options);
        return records.map(record => this.create(record as unknown as BadgeProps));
    }
    

    static async getByName(name: string, options: GetOptions<CompatBadgeProps>): Promise<Badge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatBadgeProps>('Badge', 'name', name, options);
        return records.map(record => this.create(record as unknown as BadgeProps));
    }
    

    static async getByType(type: string, options: GetOptions<CompatBadgeProps>): Promise<Badge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatBadgeProps>('Badge', 'type', type, options);
        return records.map(record => this.create(record as unknown as BadgeProps));
    }
    

    static async getByCommunityId(communityId: string, options: GetOptions<CompatBadgeProps>): Promise<Badge[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatBadgeProps>('Badge', 'communityId', communityId, options);
        return records.map(record => this.create(record as unknown as BadgeProps));
    }
    


    /**
     * Gets entities matching the specified filters and options.
     *
     * ⚠️ This function will first search cache data followed by DB data. Please consider this when using order and offset options.⚠️
     * */
    static async getByFields(filter: FieldsExpression<BadgeProps>[], options: GetOptions<BadgeProps>): Promise<Badge[]> {
        const records = await store.getByFields<CompatBadgeProps>('Badge', filter  as unknown as FieldsExpression<CompatBadgeProps>[], options as unknown as GetOptions<CompatBadgeProps>);
        return records.map(record => this.create(record as unknown as BadgeProps));
    }

    static create(record: BadgeProps): Badge {
        assert(record.id !== undefined && record.id !== null, "id must be provided");
        const entity = new this(
            record.id,
            record.issuer,
            record.communityAddress,
            record.name,
            record.score,
            record.type,
            record.communityId,
        );
        Object.assign(entity,record);
        return entity;
    }
}
