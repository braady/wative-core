import { a4 as Slug, T as Provider, X as RecordType, V as Record$1, N as Network, a6 as SvmAddressLookupTable, U as RawTx, E as EvmAddress, a2 as SimulationResult, r as DestinationGuardOptions, s as DestinationReport, Z as SendRoute, a5 as SvmAddress, ah as VmToken, g as AssetCollection, B as EvmTxBuildParams, a9 as SvmTxBuildParams, aa as Transaction, ag as TransferRequest, af as TransferPayload, l as ChainVM } from './workspace-Cir5QPoM.cjs';
export { A as Account, a as AccountCollection, b as AccountOrgType, c as Address, d as Asset, e as AssetAddInit, f as AssetBalance, h as AssetId, i as AssetInitObject, j as AssetRef, k as AssetUpdate, C as ChainId, m as Commitment, n as ConsoleSink, o as ContainerState, D as DecodedTx, p as DeriveWalletsOptions, q as DestinationCode, t as DestinationScreenResult, u as DestinationScreener, v as DestinationSeverity, w as DestinationWarning, x as EvmRawTx, y as EvmSigner, z as EvmTransaction, F as EvmTxType, L as LogLevel, G as LogRecord, H as LogSink, I as Logger, J as LoggerConfig, K as NetworkAssetCollection, M as NetworkCollection, O as NetworkInit, P as NetworkLike, Q as NetworkRoutes, R as NormalizedTx, S as OpenOptions, W as RecordInit, Y as SendOptions, _ as Settling, $ as SignInParams, a0 as SignInResult, a1 as SignRawOptions, a3 as SinkConfig, a7 as SvmSigner, a8 as SvmTransaction, ab as TransactionReceipt, ac as TransactionStateChange, ad as TransactionStatus, ae as TransactionTracker, ai as Wallet, aj as WalletCollection, ak as WativeError, al as WativeErrorCode, am as WativeErrorOpts, an as Workspace, ao as WorkspaceConfig, ap as deserializeEvmTx, aq as deserializeSvmTx, ar as deserializeTx, as as isRawTx, at as newMnemonic, au as normalizeTxInput } from './workspace-Cir5QPoM.cjs';
import { a as ContainerProvider } from './container-provider-Dynh0nWx.cjs';
export { C as ContainerEntry } from './container-provider-Dynh0nWx.cjs';
export { A as AbiItem, C as Contract } from './evm-DLUzFEmP.cjs';
export { P as Program, S as SvmInstruction, s as svmResolveAddressLookupTables } from './svm-CVf6A7Un.cjs';

interface Argon2BackendParams {
    t: number;
    m: number;
    p: number;
    dkLen: number;
}

interface Argon2Backend {
    
    readonly id: string;
    
    argon2id(password: Uint8Array, salt: Uint8Array, params: Argon2BackendParams): Uint8Array;
}

interface RecoveryEnvelope {
    readonly accountSlug: Slug;
    readonly sealedMnemonic: Uint8Array;
    readonly createdAt: number;
}

declare function sealMnemonic(accountSlug: Slug, mnemonic: string, workspacePassword: string, opts?: {
    kdf?: Argon2Backend;
}): RecoveryEnvelope;

declare function openMnemonic(envelope: RecoveryEnvelope, workspacePassword: string, opts?: {
    expectedSlug?: Slug;
    kdf?: Argon2Backend;
}): string;

type StorageDurability = "persistent" | "best-effort";
interface IdbProviderOptions {
    
    readonly acknowledgeEvictionRisk?: boolean;
    
    readonly indexedDB?: IDBFactory;
    
    readonly storageManager?: Pick<StorageManager, "persist" | "persisted" | "estimate"> | null;
}
interface IdbDestroyOptions extends Pick<IdbProviderOptions, "indexedDB"> {
    
    readonly blockedTimeoutMs?: number;
}
interface StorageQuota {
    readonly usage?: number;
    readonly quota?: number;
}
declare class IdbProvider extends ContainerProvider {
    #private;
    readonly databaseName: string;
    
    readonly durability: StorageDurability;
    
    readonly quota: StorageQuota;
    protected constructor(databaseName: string, db: IDBDatabase, durability: StorageDurability, quota: StorageQuota, acknowledged: boolean);
    
    static create(databaseName: string, opts?: IdbProviderOptions): Promise<IdbProvider>;
    
    initialize(): Promise<void>;
    
    protected get _containerLockKey(): string;
    
    protected _exist(key: string): Promise<boolean>;
    
    protected _listItems(key: string): Promise<string[]>;
    protected _read(key: string): Promise<Uint8Array>;
    
    protected _write(key: string, data: Uint8Array): Promise<void>;
    protected _remove(key: string): Promise<void>;
    
    protected _ensureDir(_key: string): Promise<void>;
    close(): Promise<void>;
    
    static destroy(databaseName: string, opts?: IdbDestroyOptions): Promise<void>;
}

declare class IdbProviderV3 extends IdbProvider {
    
    static create(databaseName: string, opts?: IdbProviderOptions): Promise<IdbProviderV3>;
}

declare class FileProvider extends Provider {
    constructor(rootPath: string);
    protected _exist(_path: string): boolean;
    protected _listItems(_path: string): string[];
    protected _read(_path: string): Uint8Array;
    protected _write(_path: string, _data: Uint8Array): void;
    protected _remove(_path: string): void;
    protected _ensureDir(_path: string): void;
    unlockContainer(_password: string): Promise<boolean>;
    lockContainer(): Promise<void>;
    isContainerUnlocked(): boolean;
    loadRecord<T>(_type: RecordType, _slug?: Slug): Promise<Record$1<T>>;
    loadRecords<T>(_type: RecordType): Promise<ReadonlyArray<Record$1<T>>>;
    writeRecord<T>(_type: RecordType, _slug: Slug, _value: T): Promise<void>;
    dropRecord(_type: RecordType, _slug: Slug): Promise<void>;
    close(): Promise<void>;
    
    static probe(_rootPath: string): boolean;
}

declare class DbProvider extends Provider {
    constructor(connectionString: string);
    protected _exist(_path: string): boolean | Promise<boolean>;
    protected _listItems(_path: string): string[] | Promise<string[]>;
    protected _read(_path: string): Uint8Array | Promise<Uint8Array>;
    protected _write(_path: string, _data: Uint8Array): void | Promise<void>;
    protected _remove(_path: string): void | Promise<void>;
    protected _ensureDir(_path: string): void | Promise<void>;
    unlockContainer(_password: string): Promise<boolean>;
    lockContainer(): Promise<void>;
    isContainerUnlocked(): boolean;
    loadRecord<T>(_type: RecordType, _slug?: Slug): Promise<Record$1<T>>;
    loadRecords<T>(_type: RecordType): Promise<ReadonlyArray<Record$1<T>>>;
    writeRecord<T>(_type: RecordType, _slug: Slug, _value: T): Promise<void>;
    dropRecord(_type: RecordType, _slug: Slug): Promise<void>;
    close(): Promise<void>;
}

declare abstract class Cipher {
    readonly id: string;
    protected constructor(id: string);
    
    abstract encrypt(input: Uint8Array, secret: Uint8Array): Uint8Array;
    
    abstract decrypt(input: Uint8Array, secret: Uint8Array): Uint8Array;
}

interface AesGcmCipherOptions {
    ivLength?: number;
    tagLength?: number;
}
declare class AesGcmCipher extends Cipher {
    #private;
    constructor(opts?: AesGcmCipherOptions);
    encrypt(plaintext: Uint8Array, key: Uint8Array): Uint8Array;
    decrypt(blob: Uint8Array, key: Uint8Array): Uint8Array;
}

interface Argon2KdfOptions {
    
    time?: number;
    
    memory?: number;
    
    parallelism?: number;
    
    hashLength?: number;
}

declare class Argon2Kdf extends Cipher {
    #private;
    constructor(opts?: Argon2KdfOptions);
    
    encrypt(password: Uint8Array, salt: Uint8Array): Uint8Array;
    
    decrypt(_input: Uint8Array, _secret: Uint8Array): never;
}

interface Argon2BackendInfo {
    
    readonly backend: string;
    
    readonly wasm: boolean;
    
    readonly reason?: string;
    
    readonly overrides: readonly string[];
}

declare function argon2BackendInfo(): Argon2BackendInfo;

type PasswordWeaknessCode = "TOO_SHORT" | "NO_UPPERCASE" | "NO_LOWERCASE" | "NO_DIGIT" | "NO_SYMBOL" | "REPEATED_CHARS" | "SEQUENTIAL_CHARS" | "USERNAME_SUBSTRING" | "FORBIDDEN_WORD" | "REUSED_FROM_HISTORY" | "LEADING_TRAILING_WHITESPACE" | "MIXED_UNICODE_NORMALIZATION" | "INVISIBLE_CHARACTERS";
interface PasswordWeakness {
    readonly code: PasswordWeaknessCode;
    readonly severity: "critical" | "warning" | "info";
    readonly message: string;
    readonly fix?: string;
}

declare const PasswordScore: {
    readonly VeryWeak: 0;
    readonly Weak: 1;
    readonly Fair: 2;
    readonly Strong: 3;
    readonly VeryStrong: 4;
};
type PasswordScore = typeof PasswordScore[keyof typeof PasswordScore];
interface PasswordCheckResult {
    readonly score: PasswordScore;
    readonly entropyBits: number;
    readonly weaknesses: ReadonlyArray<PasswordWeakness>;
    readonly passable: boolean;
    readonly summary: string;
}
interface PasswordPolicyOptions {
    minScore?: PasswordScore;
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireDigit?: boolean;
    requireSymbol?: boolean;
    forbiddenWords?: string[];
}
interface PasswordCheckContext {
    username?: string;
    history?: string[];
}
declare class PasswordPolicy {
    #private;
    constructor(opts?: PasswordPolicyOptions);
    check(password: string, context?: PasswordCheckContext): PasswordCheckResult;
    
    enforce(password: string, context?: PasswordCheckContext): void;
}

declare function closeAllRpcClients(): Promise<void>;

interface ChainClientOpts {
    rpcUrl?: string;
}

interface ChainClientSimulateOpts extends ChainClientOpts {
    from?: EvmAddress;
}

interface ChainClientBroadcastOpts extends ChainClientOpts {
    route?: SendRoute;
}
declare class ChainClient {
    #private;
    readonly network: Network;
    constructor(network: Network);
    get vm(): string;
    
    readBalance(owner: string, token?: string | null, opts?: ChainClientOpts): Promise<bigint>;
    
    getBlockNumber(opts?: ChainClientOpts): Promise<number>;
    
    getGasPrice(opts?: ChainClientOpts): Promise<bigint>;
    
    getTransactionCount(address: string, block?: "latest" | "pending", opts?: ChainClientOpts): Promise<number>;
    
    getCode(address: string, opts?: ChainClientOpts): Promise<string>;
    
    getTransactionReceipt(hash: string, opts?: ChainClientOpts): Promise<unknown | null>;
    
    getRecentBlockhash(opts?: ChainClientOpts): Promise<{
        blockhash: string;
        lastValidBlockHeight: number;
    }>;
    
    getAccountInfo(address: string, opts?: ChainClientOpts): Promise<{
        owner: string;
        executable: boolean;
        lamports: number;
        parsed: {
            program: string;
            type: string;
            info: Record<string, unknown>;
        } | null;
    } | null>;
    
    getSignatureStatus(signature: string, opts?: ChainClientOpts): Promise<unknown | null>;
    
    resolveAddressLookupTables(addresses: readonly string[], opts?: ChainClientOpts): Promise<SvmAddressLookupTable[]>;
    
    simulate(input: RawTx | string, opts?: ChainClientSimulateOpts): Promise<SimulationResult>;
    
    checkDestination(to: string, opts?: {
        tokenAddress?: string;
    } & DestinationGuardOptions): Promise<DestinationReport>;
    
    broadcast(raw: string | Uint8Array, opts?: ChainClientBroadcastOpts): Promise<string>;
}

interface RecoveredSecpSig {
    recovery: number;
    toCompactHex(): string;
}
type CurveName = "secp256k1" | "ed25519";

type MessageEncoding = "personal_sign" | "raw" | "ed25519";

interface DigestSigner {
    _signBytes(input: string | Uint8Array): RecoveredSecpSig | Uint8Array;
}

interface ChainCtx extends DigestSigner {
    readonly publicKey: EvmAddress | SvmAddress;
    readonly vm: VmToken;
    readonly network: Network;
    readonly assets: AssetCollection;
}
declare abstract class ChainDialect {
    
    abstract readonly vm: VmToken;
    
    abstract readonly curve: CurveName;
    abstract signMessage(ctx: ChainCtx, message: string): string;
    abstract signMessageEncoded(ctx: ChainCtx, message: string, encoding: MessageEncoding): {
        signature: string;
        messageHash: string;
    };
    abstract signTypedData(ctx: ChainCtx, typedData: unknown, chainId: number | bigint): {
        signature: string;
        domainSeparator: string;
        structHash: string;
    };
    abstract buildTransaction(ctx: ChainCtx, params: EvmTxBuildParams | SvmTxBuildParams): Transaction;
    abstract buildTransferPayload(ctx: ChainCtx, req: TransferRequest): TransferPayload;
    
    abstract derive(seed: Uint8Array, index: number): {
        publicKey: string;
        privateKey: string;
    };
    
    abstract addressFromPrivateKey(privateKey: string): string;
    
    abstract privateKeyMatches(privateKey: string, publicKey: string): boolean;
}

declare function registerDialect(vm: string, factory: () => ChainDialect): void;

interface NetworkConfig {
    readonly slug: string;
    readonly name: string;
    readonly chainId: number;
    readonly rpcUrl: string;
    readonly vm: ChainVM;
    readonly nativeCurrency: {
        readonly name: string;
        readonly symbol: string;
        readonly decimals: number;
    };
    
    readonly multicallAddress?: string;
}
declare const BUILTIN_NETWORKS: Record<string, NetworkConfig>;
interface AssetInit {
    readonly id: number;
    readonly symbol: string;
    readonly name: string;
    readonly decimals: number;
    readonly contractAddress: string | null;
    readonly displayDecimals?: number;
    readonly displayStatus?: boolean;
}
declare const BUILTIN_ASSETS: Record<string, ReadonlyArray<AssetInit>>;

export { AesGcmCipher, type AesGcmCipherOptions, type Argon2Backend, type Argon2BackendInfo, type Argon2BackendParams, Argon2Kdf, type Argon2KdfOptions, AssetCollection, type AssetInit, BUILTIN_ASSETS, BUILTIN_NETWORKS, ChainClient, type ChainClientBroadcastOpts, type ChainClientOpts, type ChainClientSimulateOpts, type ChainCtx, ChainDialect, ChainVM, Cipher, ContainerProvider, type CurveName, DbProvider, DestinationGuardOptions, DestinationReport, type DigestSigner, EvmAddress, EvmTxBuildParams, FileProvider, type IdbDestroyOptions, IdbProvider, type IdbProviderOptions, IdbProviderV3, type MessageEncoding, Network, type NetworkConfig, type PasswordCheckContext, type PasswordCheckResult, PasswordPolicy, type PasswordPolicyOptions, PasswordScore, type PasswordWeakness, type PasswordWeaknessCode, Provider, RawTx, Record$1 as Record, RecordType, type RecoveredSecpSig, type RecoveryEnvelope, SendRoute, SimulationResult, Slug, type StorageDurability, type StorageQuota, SvmAddress, SvmAddressLookupTable, SvmTxBuildParams, Transaction, TransferPayload, TransferRequest, VmToken, argon2BackendInfo, closeAllRpcClients, openMnemonic, registerDialect, sealMnemonic };
