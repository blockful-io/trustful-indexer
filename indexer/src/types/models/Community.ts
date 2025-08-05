// Auto-generated , DO NOT EDIT
import {Entity, FunctionPropertyNames, FieldsExpression, GetOptions } from "@subql/types-core";
import assert from 'assert';



export type CommunityProps = Omit<Community, NonNullable<FunctionPropertyNames<Community>> | '_name'>;

/*
 * Compat types allows for support of alternative `id` types without refactoring the node
 */
type CompatCommunityProps = Omit<CommunityProps, 'id'> & { id: string; };
type CompatEntity = Omit<Entity, 'id'> & { id: string; };

export class Community implements CompatEntity {

    constructor(
        
        id: string,
        communityAddress: string,
        name: string,
        creatorAddress: string,
        isHidden: boolean,
        blocktimestamp: bigint,
        totalBadges: number,
        lastIndexedAt: bigint,
    ) {
        this.id = id;
        this.communityAddress = communityAddress;
        this.name = name;
        this.creatorAddress = creatorAddress;
        this.isHidden = isHidden;
        this.blocktimestamp = blocktimestamp;
        this.totalBadges = totalBadges;
        this.lastIndexedAt = lastIndexedAt;
        
    }

    public id: string;
    public communityAddress: string;
    public factoryAddress?: string;
    public name: string;
    public description?: string;
    public icon?: string;
    public creatorAddress: string;
    public isHidden: boolean;
    public blocktimestamp: bigint;
    public totalBadges: number;
    public lastIndexedAt: bigint;
    

    get _name(): string {
        return 'Community';
    }

    async save(): Promise<void> {
        const id = this.id;
        assert(id !== null, "Cannot save Community entity without an ID");
        await store.set('Community', id.toString(), this as unknown as CompatCommunityProps);
    }

    static async remove(id: string): Promise<void> {
        assert(id !== null, "Cannot remove Community entity without an ID");
        await store.remove('Community', id.toString());
    }

    static async get(id: string): Promise<Community | undefined> {
        assert((id !== null && id !== undefined), "Cannot get Community entity without an ID");
        const record = await store.get('Community', id.toString());
        if (record) {
            return this.create(record as unknown as CommunityProps);
        } else {
            return;
        }
    }

    static async getByCommunityAddress(communityAddress: string, options: GetOptions<CompatCommunityProps>): Promise<Community[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatCommunityProps>('Community', 'communityAddress', communityAddress, options);
        return records.map(record => this.create(record as unknown as CommunityProps));
    }
    

    static async getByFactoryAddress(factoryAddress: string, options: GetOptions<CompatCommunityProps>): Promise<Community[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatCommunityProps>('Community', 'factoryAddress', factoryAddress, options);
        return records.map(record => this.create(record as unknown as CommunityProps));
    }
    

    static async getByCreatorAddress(creatorAddress: string, options: GetOptions<CompatCommunityProps>): Promise<Community[]> {
        // Inputs must be cast as the store interface has not been updated to support alternative ID types
        const records = await store.getByField<CompatCommunityProps>('Community', 'creatorAddress', creatorAddress, options);
        return records.map(record => this.create(record as unknown as CommunityProps));
    }
    


    /**
     * Gets entities matching the specified filters and options.
     *
     * ⚠️ This function will first search cache data followed by DB data. Please consider this when using order and offset options.⚠️
     * */
    static async getByFields(filter: FieldsExpression<CommunityProps>[], options: GetOptions<CommunityProps>): Promise<Community[]> {
        const records = await store.getByFields<CompatCommunityProps>('Community', filter  as unknown as FieldsExpression<CompatCommunityProps>[], options as unknown as GetOptions<CompatCommunityProps>);
        return records.map(record => this.create(record as unknown as CommunityProps));
    }

    static create(record: CommunityProps): Community {
        assert(record.id !== undefined && record.id !== null, "id must be provided");
        const entity = new this(
            record.id,
            record.communityAddress,
            record.name,
            record.creatorAddress,
            record.isHidden,
            record.blocktimestamp,
            record.totalBadges,
            record.lastIndexedAt,
        );
        Object.assign(entity,record);
        return entity;
    }
}
