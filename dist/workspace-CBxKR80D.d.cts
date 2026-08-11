interface AssetInitObject {
    id: AssetId;
    symbol: string;
    name: string;
    decimals: number;
    network: Network;
    contractAddress?: string | null;
    displayDecimals?: number;
    displayStatus?: boolean;
}
declare class Asset {
    readonly id: AssetId;
    readonly contractAddress: string | null;
    readonly native: boolean;
    symbol: string;
    name: string;
    decimals: number;
    displayDecimals: number;
    displayStatus: boolean;
    readonly network: Network;
    constructor(init: AssetInitObject);
    constructor(id: AssetId, symbol: string, name: string, decimals: number, network: Network, contractAddress?: string | null);
}
interface AssetBalance {
    readonly assetId: AssetId;
    readonly raw: bigint;
    readonly decimals: number;
    readonly displayStatus: boolean;
    readonly fetchedAt: number;
}
interface AssetCollection extends ReadonlyArray<Asset> {
    byId(id: AssetId): Asset | null;
}

interface NetworkInit {
    slug: Slug;
    name: string;
    chainId: ChainId;
    rpcUrl: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    multicallAddress?: string;
    color?: string;
    vm: ChainVM;
}
declare class Network {
    readonly slug: Slug;
    readonly name: string;
    readonly chainId: ChainId;
    readonly rpcUrl: string;
    readonly nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    readonly multicallAddress?: string;
    readonly color?: string;
    readonly vm: ChainVM;
    
    get symbol(): string;
    
    readonly assets: readonly Asset[];
    
    save(): Promise<void>;
    
    readonly _workspace?: Workspace;
    constructor(init: NetworkInit);
    constructor(name: string, chainId: number, rpcUrl: string, nativeCurrency?: {
        name: string;
        symbol: string;
        decimals: number;
    }, color?: string);
    static readonly Ethereum: Network;
    static readonly Base: Network;
    static readonly BnbChain: Network;
    static readonly Arbitrum: Network;
    static readonly ArbitrumSepolia: Network;
    static readonly Optimism: Network;
    static readonly Sepolia: Network;
    static readonly Solana: Network;
    static readonly SolanaTestnet: Network;
    static readonly SolanaDevnet: Network;
    static builtin(slug: Slug): Network | null;
    static all(): readonly Network[];
    static isBuiltinSlug(slug: Slug): boolean;
}

interface NetworkCollection extends ReadonlyArray<Network> {
    add(network: Network): Promise<Network>;
    drop(network: Network): Promise<void>;
    
    update(network: Network): Promise<Network>;
    bySlug(slug: Slug): Network | null;
    byChainId(id: ChainId): Network | null;
}

type Brand<T, B extends string> = T & {
    readonly __brand: B;
};
type Slug = Brand<string, "Slug">;
type EvmAddress = Brand<string, "EvmAddress">;
type SvmAddress = Brand<string, "SvmAddress">;
type SuiAddress = Brand<string, "SuiAddress">;
type ChainId = Brand<number, "ChainId">;
type AssetId = Brand<number, "AssetId">;
type ChainVM = "evm" | "svm" | "sui";

type NetworkLike = Network | ChainId | string;

interface Settling<T> {
    readonly settled: boolean;
    readonly value: T | null;
    confirm(): Promise<T>;
    abort(): void;
}

type RecordType = "CONFIG" | "ACCOUNTS" | "NETWORK" | "ASSET" | "LOG";
/** Pre-unlock structural state of a provider's container — see `Provider.inspectContainer`. */
type ContainerState = "empty" | "workspace" | "foreign";
interface RecordInit<T> {
    readonly provider: Provider;
    readonly recordType: RecordType;
    readonly encrypted?: Uint8Array;
    readonly value?: T;
    readonly password?: string;
    readonly decrypt?: (ciphertext: Uint8Array, password: string) => Uint8Array;
    readonly persist?: (value: T, password: string) => Promise<void>;
    /** Throws if the session that issued this record has ended. */
    readonly requireLiveSession?: () => void;
}
declare class Record$1<T> {
    #private;
    readonly slug: Slug;
    readonly path: string;
    constructor(slug: Slug, path: string, init?: RecordInit<T>);
    get locked(): boolean;
    get value(): T;
    /** Pure CPU — decrypts the in-memory blob. */
    unlock(password: string): this;
    /** Persists changes via the owning Provider. */
    save(): Promise<void>;
}
declare abstract class Provider {
    #private;
    readonly rootDescriptor: string;
    protected constructor(rootDescriptor: string);
    protected abstract _exist(path: string): boolean | Promise<boolean>;
    protected abstract _listItems(path: string): string[] | Promise<string[]>;
    protected abstract _read(path: string): Uint8Array | Promise<Uint8Array>;
    protected abstract _write(path: string, data: Uint8Array): void | Promise<void>;
    protected abstract _remove(path: string): void | Promise<void>;
    protected abstract _ensureDir(path: string): void | Promise<void>;
    abstract unlockContainer(password: string): Promise<boolean>;
    abstract lockContainer(): Promise<void>;
    abstract isContainerUnlocked(): boolean;
    /** Structural inspection of the container BEFORE unlock. */
    inspectContainer(): Promise<ContainerState>;
    abstract loadRecord<T>(type: RecordType, slug?: Slug): Promise<Record$1<T>>;
    abstract loadRecords<T>(type: RecordType): Promise<ReadonlyArray<Record$1<T>>>;
    abstract writeRecord<T>(type: RecordType, slug: Slug, value: T): Promise<void>;
    abstract dropRecord(type: RecordType, slug: Slug): Promise<void>;
    /** Initialize an empty container by writing the four root records (CONFIG, NETWORK, ASSET, LOG) from the bundled templat... */
    initialize(): Promise<void>;
    /** Any storage at all under the accounts area, however named. */
    protected _hasRawAccountData(): Promise<boolean>;
    abstract close(): Promise<void>;
}

type WativeErrorCode = "WORKSPACE_LOCKED" | "ACCOUNT_LOCKED" | "RECORD_LOCKED" | "BAD_PASSWORD" | "WEAK_PASSWORD" | "RECORD_NOT_FOUND" | "PROVIDER_IO" | "PERMISSION_DENIED" | "DISK_FULL" | "PARAMETER_ERROR" | "DECRYPT_FAILED" | "ENCRYPT_FAILED" | "ALGORITHM_IRREVERSIBLE" | "INVALID_MNEMONIC" | "INVALID_PRIVATE_KEY" | "UNSUPPORTED_NETWORK" | "TX_BUILD_FAILED" | "TX_SIGN_FAILED" | "TX_SUBMIT_FAILED" | "TX_TIMEOUT" | "TX_DROPPED" | "TX_ABORTED" | "RPC_UNREACHABLE"

 | "RPC_REJECTED" | "STORAGE_NOT_DURABLE" | "UNSUPPORTED_OP";
interface WativeErrorOpts {
    readonly cause?: unknown;
    readonly details?: Record<string, unknown>;
}
declare class WativeError extends Error {
    readonly code: WativeErrorCode;
    readonly cause?: unknown;
    readonly details?: Record<string, unknown>;
    constructor(code: WativeErrorCode, message: string, opts?: WativeErrorOpts);
}

type TransactionStatus = "draft" | "signed" | "submitted" | "pending" | "mined" | "confirmed" | "finalized" | "failed" | "dropped" | "aborted" | "timeout";

declare const EvmTxType: {
    readonly Legacy: 0;
    readonly AccessList: 1;
    readonly Eip1559: 2;
};
type EvmTxType = typeof EvmTxType[keyof typeof EvmTxType];
interface EvmTxBuildParams {
    to: string;
    value?: bigint;
    data?: string;
    nonce?: number;
    gasLimit?: bigint;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    type?: EvmTxType;
    chainId?: ChainId;
    rpcUrl?: string;
    accessList?: ReadonlyArray<{
        address: string;
        storageKeys: ReadonlyArray<string>;
    }>;
}
interface SvmTxBuildParams {
    recipient: string;
    amount: bigint;
    tokenMint?: string;
    tokenProgram?: string;
    computeUnitLimit?: number;
    computeUnitPrice?: bigint;
    recentBlockhash?: string;
    feePayer?: string;
    rpcUrl?: string;
    instructions?: ReadonlyArray<unknown>;
    addressLookupTables?: ReadonlyArray<string>;
    memo?: string;
}
interface Transaction {
    readonly vm: ChainVM;
    readonly status: TransactionStatus;
    sign(): Promise<this> | this;
    send(): TransactionTracker;
    simulate(): Promise<SimulationResult>;
}
interface SimulationResult {
    readonly success: boolean;
    readonly error?: string;
    readonly logs?: ReadonlyArray<string>;
    readonly returnData?: string;
    readonly gasUsed?: bigint;
    readonly computeUnitsConsumed?: number;
    readonly raw: unknown;
}
interface TransactionStateChange {
    readonly previous: TransactionStatus;
    readonly next: TransactionStatus;
    readonly at: number;
    readonly reason?: string;
    readonly hash?: string;
    readonly blockNumber?: number;
    readonly confirmations?: number;
}
interface TransactionReceipt {
    readonly hash: string;
    readonly vm: ChainVM;
    readonly blockNumber: number | null;
    readonly blockHash: string | null;
    readonly index: number | null;
    readonly success: boolean;
    readonly gasUsed?: bigint;
    readonly effectiveGasPrice?: bigint;
    readonly fee?: bigint;
    readonly logs?: ReadonlyArray<unknown>;
    readonly revertReason?: string;
    readonly raw: unknown;
}
interface TransactionTracker extends Settling<TransactionReceipt> {
    readonly hash: string | null;
    readonly status: TransactionStatus;
    readonly history: ReadonlyArray<TransactionStateChange>;
    readonly receipt: TransactionReceipt | null;
    whenSubmitted(): Promise<string>;
    whenMined(): Promise<TransactionReceipt>;
    whenConfirmed(blocks?: number): Promise<TransactionReceipt>;
    whenFinalized(): Promise<TransactionReceipt>;
    on(event: "change", listener: (c: TransactionStateChange) => void): () => void;
    on(event: "confirmed", listener: (r: TransactionReceipt) => void): () => void;
    on(event: "failed", listener: (e: WativeError) => void): () => void;
}
declare class EvmTransaction implements Transaction {
    #private;
    readonly vm: "evm";
    from: EvmAddress;
    to: string;
    value: bigint;
    data: string;
    chainId: ChainId;
    type: EvmTxType;
    nonce?: number;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    gasLimit?: bigint;
    rpcUrl?: string;
    accessList?: ReadonlyArray<{
        address: string;
        storageKeys: ReadonlyArray<string>;
    }>;
    
    _address?: Address;
    constructor(init: {
        from: EvmAddress;
        to: string;
        value: bigint;
        chainId: ChainId;
        data?: string;
        type?: EvmTxType;
        nonce?: number;
        gasPrice?: bigint;
        maxFeePerGas?: bigint;
        maxPriorityFeePerGas?: bigint;
        gasLimit?: bigint;
        rpcUrl?: string;
        accessList?: ReadonlyArray<{
            address: string;
            storageKeys: ReadonlyArray<string>;
        }>;
        address?: Address;
    });
    constructor(from: EvmAddress, to: string, value: bigint, data: string | undefined, opts: {
        chainId: ChainId;
        type?: EvmTxType;
        nonce?: number;
        gasPrice?: bigint;
        maxFeePerGas?: bigint;
        maxPriorityFeePerGas?: bigint;
        gasLimit?: bigint;
        rpcUrl?: string;
        accessList?: ReadonlyArray<{
            address: string;
            storageKeys: ReadonlyArray<string>;
        }>;
        address?: Address;
    });
    get status(): TransactionStatus;
    sign(): Promise<this>;
    send(): TransactionTracker;
    
    simulate(): Promise<SimulationResult>;
    
    get rawTransaction(): string | null;
    get hash(): string | null;
    
    toRawTx(): EvmRawTx;
}

interface EvmRawTx {
    from: string;
    to: string;
    value: bigint;
    data: string;
    type: EvmTxType;
    chainId: ChainId;
    nonce?: number;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    rpcUrl?: string;
    gasLimit?: bigint;
    accessList?: ReadonlyArray<{
        address: string;
        storageKeys: ReadonlyArray<string>;
    }>;
}
declare class SvmTransaction implements Transaction {
    #private;
    readonly vm: "svm";
    from: SvmAddress;
    recipient: string;
    amount: bigint;
    tokenMint?: string;
    tokenProgram?: string;
    computeUnitLimit?: number;
    computeUnitPrice?: bigint;
    recentBlockhash?: string;
    feePayer?: string;
    rpcUrl?: string;
    instructions?: ReadonlyArray<unknown>;
    addressLookupTables?: ReadonlyArray<string>;
    memo?: string;
    
    _address?: Address;
    constructor(init: {
        from: SvmAddress;
        recipient: string;
        amount: bigint;
        tokenMint?: string;
        tokenProgram?: string;
        computeUnitLimit?: number;
        computeUnitPrice?: bigint;
        recentBlockhash?: string;
        feePayer?: string;
        rpcUrl?: string;
        instructions?: ReadonlyArray<unknown>;
        addressLookupTables?: ReadonlyArray<string>;
        memo?: string;
        address?: Address;
    });
    constructor(from: SvmAddress, recipient: string, amount: bigint, opts?: {
        tokenMint?: string;
        tokenProgram?: string;
        computeUnitLimit?: number;
        computeUnitPrice?: bigint;
        recentBlockhash?: string;
        feePayer?: string;
        rpcUrl?: string;
        instructions?: ReadonlyArray<unknown>;
        addressLookupTables?: ReadonlyArray<string>;
        memo?: string;
        address?: Address;
    });
    get status(): TransactionStatus;
    sign(): Promise<this>;
    send(): TransactionTracker;
    simulate(): Promise<SimulationResult>;
    get hash(): string | null;
    
    toRawTx(): Promise<unknown>;
}

interface AddressInit {
    publicKey: EvmAddress | SvmAddress | SuiAddress;
    vm: ChainVM;
    network: Network;
    ciphertext: string;
    assets?: Asset[];
    wallet: Wallet;
}
declare class Address {
    #private;
    readonly publicKey: EvmAddress | SvmAddress | SuiAddress;
    readonly vm: ChainVM;
    readonly network: Network;
    readonly assets: AssetCollection;
    
    readonly _ciphertext: string;
    constructor(init: AddressInit);
    
    toString(): string;
    
    _setPlaintextPrivateKey(pk: string | null): void;
    
    _dumpPrivateKey(): string;
    
    signMessageEncoded(message: string, encoding: "personal_sign" | "raw" | "ed25519"): {
        signature: string;
        messageHash: string;
    };
    
    signTypedData(typedData: unknown, chainId: number | bigint): {
        signature: string;
        domainSeparator: string;
        structHash: string;
    };
    signMessage(message: string): string;
    buildTransaction(params: EvmTxBuildParams): EvmTransaction;
    buildTransaction(params: SvmTxBuildParams): SvmTransaction;
    
    signTransaction(transaction: Transaction): Transaction;
    
    sendTransaction(transaction: Transaction): TransactionTracker;
    
    simulateTransaction(transaction: Transaction): Promise<SimulationResult>;
    refreshBalances(displayedOnly?: boolean): Settling<readonly AssetBalance[]>;
    refreshBalances(network: NetworkLike, displayedOnly?: boolean): Settling<readonly AssetBalance[]>;
    refreshBalances(assetId: AssetId): Settling<AssetBalance>;
    readonly _wallet: Wallet;
}

interface WalletInit {
    id: number;
    tags?: string[];
    addresses?: Address[];
    lastBalanceUpdateTime?: number;
    account: Account;
}
declare class Wallet {
    #private;
    readonly id: number;
    lastBalanceUpdateTime?: number;
    constructor(init: WalletInit);
    get addresses(): ReadonlyArray<Address>;
    
    _addAddress(address: Address): void;
    _setAddresses(addresses: Address[]): void;
    get evm(): Address | null;
    get svm(): Address | null;
    get sui(): Address | null;
    
    toJson(): ReadonlyArray<{
        vm: ChainVM;
        publicKey: string;
        network: {
            slug: Slug;
            chainId: ChainId;
            name: string;
        };
    }>;
    get tags(): readonly string[];
    hasTag(tag: string): boolean;
    addTag(tag: string): Promise<void>;
    removeTag(tag: string): Promise<void>;
    clearTags(): Promise<void>;
    
    dumpPrivateKey(vm: ChainVM): string;
    drop(): Promise<void>;
    readonly _account: Account;
}

type AccountOrgType = "HD" | "PK";
interface PersistedAccount {
    slug: string;
    displayName: string;
    organizationType: AccountOrgType;
    encryptionAlgorithm: string;
    signature: string;
    hasOwnPassword: boolean;
    defaultNetworkSlug: string;
    ppCiphertext?: string;
    disabledSlots?: ReadonlyArray<{
        from: number;
        to: number;
    }>;
    wallets: PersistedWallet[];
}
interface PersistedWallet {
    id: number;
    tags: string[];
    lastBalanceUpdateTime?: number;
    addresses: PersistedAddress[];
}
interface PersistedAddress {
    publicKey: string;
    vm: ChainVM;
    networkSlug: string;
    ciphertext: string;
}
interface AccountConstructorInit {
    workspace: Workspace;
    data: PersistedAccount;
}
declare class Account {
    #private;
    readonly slug: Slug;
    displayName: string;
    readonly organizationType: AccountOrgType;
    encryptionAlgorithm: string;
    signature: string;
    ppCiphertext?: string;
    disabledSlots?: ReadonlyArray<{
        from: number;
        to: number;
    }>;
    readonly hasOwnPassword: boolean;
    readonly _workspace: Workspace;
    readonly wallets: WalletCollection;
    constructor(init: AccountConstructorInit);
    get locked(): boolean;
    get defaultNetwork(): Slug;
    
    set defaultNetwork(value: NetworkLike);
    setDefaultNetwork(value: NetworkLike): Promise<void>;
    rename(displayName: string): Promise<void>;
    setDisplayName(displayName: string): Promise<void>;
    setDisabledAddressNos(addressNos: ReadonlyArray<number>): Promise<void>;
    setDisabledSlots(slots: ReadonlyArray<{
        from: number;
        to: number;
    }>): Promise<void>;
    
    tryUnlock(password?: string): Promise<this>;
    
    lock(): void;
    
    resetPassword(oldPassword: string, newPassword: string): Promise<this>;
    
    checkPassword(password: string): Promise<boolean>;
    
    dumpMnemonic(): string;
    
    deriveWallets(count: number): Promise<{
        before: number;
        after: number;
    }>;
    
    sliceWallets(fromIndex: number): Promise<{
        before: number;
        after: number;
        dropped: number;
    }>;
    
    importPrivateKey(pk: string, vm?: ChainVM): Promise<Wallet>;
    drop(): Promise<void>;
    
    filterAddress(network: NetworkLike, addr?: string): Address | null;
    filterAddress(network: NetworkLike | undefined, addr: string): Address | null;
    toPersisted(): PersistedAccount;
    
    _persist(): Promise<void>;
    
    _persistInternal(): Promise<void>;
    
    
    _isAttached(): boolean;
    _setAttached(attached: boolean): void;
    
    _dropWallet(wallet: Wallet): Promise<void>;
    
    _enqueueMutation<T>(fn: () => Promise<T>): Promise<T>;
    
    _restoreUnlockPassword(pwd: string | null): void;
    
    
    _wipeWalletKeys(...wallets: Wallet[]): void;
}
interface AccountCollection extends ReadonlyArray<Account> {
    create(displayName: string, password: string, secret: string, defaultNetwork?: NetworkLike, opts?: {
        kind?: AccountOrgType;
        hasOwnPassword?: boolean;
    }): Promise<Account>;
    add(account: Account): Promise<Account>;
    drop(account: Account): Promise<void>;
    bySlug(slug: Slug): Account | null;
}
interface WalletCollection extends ReadonlyArray<Wallet> {
    add(wallet: Wallet): Promise<Wallet>;
    drop(wallet: Wallet): Promise<void>;
    byId(id: number): Wallet | null;
}

declare function newMnemonic(): string;

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
type SinkConfig = {
    kind: "console";
    color?: boolean;
    minLevel?: LogLevel;
} | {
    kind: "file";
    dir: string;
    filePrefix?: string;
    maxFileSize?: number;
    maxFiles?: number;
    minLevel?: LogLevel;
};
interface LoggerConfig {
    minLevel: LogLevel;
    sinks: SinkConfig[];
    captureStackOn?: ReadonlyArray<LogLevel>;
}
interface LogRecord {
    readonly timestamp: number;
    readonly level: LogLevel;
    readonly logger: string;
    readonly message: string;
    readonly context?: Readonly<Record<string, unknown>>;
    readonly error?: {
        name: string;
        message: string;
        stack?: string;
    };
}
interface LogSink {
    write(record: LogRecord): void;
    flush?(): Promise<void>;
    close?(): Promise<void>;
}
declare class ConsoleSink implements LogSink {
    #private;
    constructor(opts?: {
        color?: boolean;
        minLevel?: LogLevel;
    });
    write(record: LogRecord): void;
}
interface LoggerOwner {
    onLoggerConfigChange(next: LoggerConfig): Promise<void>;
}
interface LoggerSharedState {
    config: LoggerConfig;
    sinks: LogSink[];
    owner: LoggerOwner;
}
declare class Logger {
    #private;
    readonly namespace: string;
    constructor(namespace: string, config: LoggerConfig, owner: LoggerOwner);
    constructor(namespace: string, shared: LoggerSharedState);
    get level(): LogLevel;
    get sinks(): readonly LogSink[];
    get config(): LoggerConfig;
    setLevel(level: LogLevel): Promise<void>;
    setSinks(configs: SinkConfig[]): Promise<void>;
    trace(msg: string, ctx?: Readonly<Record<string, unknown>>): void;
    debug(msg: string, ctx?: Readonly<Record<string, unknown>>): void;
    info(msg: string, ctx?: Readonly<Record<string, unknown>>): void;
    warn(msg: string, ctx?: Readonly<Record<string, unknown>>): void;
    error(msg: string, err?: unknown, ctx?: Readonly<Record<string, unknown>>): void;
    fatal(msg: string, err?: unknown, ctx?: Readonly<Record<string, unknown>>): void;
    child(subNamespace: string): Logger;
}

interface WorkspaceConfig {
    businessTimezone?: string;
    readonly [key: string]: unknown;
}

interface OpenOptions {
    
    provider?: Provider;
    
    path?: string;
    
    password?: string;
}
declare class Workspace {
    #private;
    accounts: AccountCollection;
    networks: NetworkCollection;
    
    _registerLiveAccount(account: Account): void;
    
    _releaseAccount(account: Account): void;
    
    _enqueueNetworkMutation<T>(fn: () => Promise<T>): Promise<T>;
    private constructor();
    get locked(): boolean;
    
    get damagedAccountSlugs(): ReadonlyArray<string>;
    get rootDescriptor(): string;
    
    static open(providerOrRoot?: Provider | string | OpenOptions, password?: string, create?: boolean): Promise<Workspace>;
    unlock(password: string): Promise<this>;
    
    lock(): Promise<void>;
    
    _getPassword(): string;
    get config(): WorkspaceConfig;
    getConfig(): Promise<WorkspaceConfig>;
    setBusinessTimezone(timezone: string): Promise<void>;
    
    get logger(): Logger;
    filter(query: string, objective: "Wallet"): Wallet | null;
    filter(query: string, objective: "Address"): Address | null;
    filter(query: string, objective: "Account"): Account | null;
    filter(query: string, objective: "Asset"): Asset | null;
    
    assets(network: NetworkLike): Promise<readonly Asset[]>;
    
    addAsset(asset: Asset): Promise<Asset>;
    
    dropAsset(id: AssetId): Promise<void>;
    
    _findUserAssetOnNetwork(slug: Slug): {
        id: number;
        symbol: string;
    } | null;
}

export { Account as A, type Slug as B, type ChainId as C, type SvmAddress as D, type EvmAddress as E, SvmTransaction as F, type SvmTxBuildParams as G, type TransactionReceipt as H, type TransactionStateChange as I, type TransactionStatus as J, type TransactionTracker as K, type LogLevel as L, type WalletCollection as M, Network as N, type OpenOptions as O, Provider as P, WativeError as Q, Record$1 as R, type Settling as S, type Transaction as T, type WativeErrorCode as U, type WativeErrorOpts as V, Wallet as W, Workspace as X, type WorkspaceConfig as Y, newMnemonic as Z, type AccountCollection as a, type AccountOrgType as b, Address as c, Asset as d, type AssetBalance as e, type AssetCollection as f, type AssetId as g, type AssetInitObject as h, type ChainVM as i, ConsoleSink as j, type ContainerState as k, type EvmRawTx as l, EvmTransaction as m, type EvmTxBuildParams as n, EvmTxType as o, type LogRecord as p, type LogSink as q, Logger as r, type LoggerConfig as s, type NetworkCollection as t, type NetworkInit as u, type NetworkLike as v, type RecordInit as w, type RecordType as x, type SimulationResult as y, type SinkConfig as z };
