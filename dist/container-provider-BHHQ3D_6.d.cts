import { P as Provider, B as Slug, k as ContainerState, x as RecordType, R as Record } from './workspace-bxOhg4wh.cjs';

interface ContainerEntry {
    readonly key: string;
    readonly data: Uint8Array;
}
declare abstract class ContainerProvider extends Provider {
    #private;
    protected constructor(rootDescriptor: string);
    
    protected get _rootPrefix(): string;
    
    protected _join(base: string, segment: string): string;
    
    protected _prepareUnlock(): Promise<void>;
    
    unlockContainer(password: string): Promise<boolean>;
    
    initialize(): Promise<void>;
    
    protected _afterLayoutEnsured(): Promise<void>;
    
    
    accountRecordExists(slug: Slug): Promise<boolean>;
    unreadableRecordSlugs(): ReadonlyArray<Slug>;
    
    occupiedAccountStems(): ReadonlyArray<string>;
    protected _hasRawAccountData(): Promise<boolean>;
    lockContainer(): Promise<void>;
    isContainerUnlocked(): boolean;
    
    inspectContainer(): Promise<ContainerState>;
    loadRecord<T>(type: RecordType, slug?: Slug): Promise<Record<T>>;
    loadRecords<T>(type: RecordType): Promise<ReadonlyArray<Record<T>>>;
    writeRecord<T>(type: RecordType, slug: Slug, value: T): Promise<void>;
    dropRecord(type: RecordType, slug: Slug): Promise<void>;
    close(): Promise<void>;
    
    exportContainer(): Promise<ReadonlyArray<ContainerEntry>>;
    
    importContainer(entries: ReadonlyArray<ContainerEntry>, opts?: {
        overwrite?: boolean;
    }): Promise<void>;
    protected get _configKey(): string;
    protected get _accountsDir(): string;
    protected _keyFor(type: RecordType, slug?: Slug): string;
    protected _defaultSlug(type: RecordType, slug?: Slug): Slug;
    protected _requireUnlocked(): void;
    protected _hydrate<T>(type: RecordType, slug: Slug, key: string): Promise<Record<T>>;
    protected _encryptValue<T>(value: T, password: string, type: RecordType, slug: string): Uint8Array;
    
    protected _encryptBlob(plaintext: Uint8Array, password: string, type: RecordType, slug: string): Uint8Array;
    
    protected _decryptBlob(blob: Uint8Array, password: string, type: RecordType, slug: string): Uint8Array;
}

export { type ContainerEntry as C, ContainerProvider as a };
