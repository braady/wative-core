import { P as Provider, z as RecordType, F as Slug, R as Record$1, E as EvmAddress, G as SvmAddress, a3 as SuiAddress, W as VmToken, N as Network, f as AssetCollection, p as EvmTxBuildParams, J as SvmTxBuildParams, T as Transaction, V as TransferRequest, j as ChainVM } from './workspace-ZNpsa6W7.cjs';
export { A as Account, a as AccountCollection, b as AccountOrgType, c as Address, d as Asset, e as AssetBalance, g as AssetId, h as AssetInitObject, i as AssetRef, C as ChainId, k as ConsoleSink, l as ContainerState, m as EvmRawTx, n as EvmSigner, o as EvmTransaction, q as EvmTxType, L as LogLevel, r as LogRecord, s as LogSink, t as Logger, u as LoggerConfig, v as NetworkCollection, w as NetworkInit, x as NetworkLike, O as OpenOptions, y as RecordInit, S as Settling, B as SimulationResult, D as SinkConfig, H as SvmSigner, I as SvmTransaction, K as TransactionReceipt, M as TransactionStateChange, Q as TransactionStatus, U as TransactionTracker, X as Wallet, Y as WalletCollection, Z as WativeError, _ as WativeErrorCode, $ as WativeErrorOpts, a0 as Workspace, a1 as WorkspaceConfig, a2 as newMnemonic } from './workspace-ZNpsa6W7.cjs';
import { a as ContainerProvider } from './container-provider-BCG7wTYx.cjs';
export { C as ContainerEntry } from './container-provider-BCG7wTYx.cjs';
export { A as AbiItem, C as Contract } from './evm-BeI4m7M5.cjs';
export { P as Program, S as SvmInstruction } from './svm-Bi74PhrA.cjs';

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
    private constructor();
    
    static create(databaseName: string, opts?: IdbProviderOptions): Promise<IdbProvider>;
    
    initialize(): Promise<void>;
    
    protected _exist(key: string): Promise<boolean>;
    
    protected _listItems(key: string): Promise<string[]>;
    protected _read(key: string): Promise<Uint8Array>;
    
    protected _write(key: string, data: Uint8Array): Promise<void>;
    protected _remove(key: string): Promise<void>;
    
    protected _ensureDir(_key: string): Promise<void>;
    close(): Promise<void>;
    
    static destroy(databaseName: string, opts?: IdbDestroyOptions): Promise<void>;
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
    readonly publicKey: EvmAddress | SvmAddress | SuiAddress;
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
    abstract transfer(ctx: ChainCtx, req: TransferRequest): Transaction;
    
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

export { AesGcmCipher, type AesGcmCipherOptions, type Argon2BackendInfo, Argon2Kdf, type Argon2KdfOptions, AssetCollection, type AssetInit, BUILTIN_ASSETS, BUILTIN_NETWORKS, type ChainCtx, ChainDialect, ChainVM, Cipher, ContainerProvider, type CurveName, DbProvider, type DigestSigner, EvmAddress, EvmTxBuildParams, FileProvider, type IdbDestroyOptions, IdbProvider, type IdbProviderOptions, type MessageEncoding, Network, type NetworkConfig, type PasswordCheckContext, type PasswordCheckResult, PasswordPolicy, type PasswordPolicyOptions, PasswordScore, type PasswordWeakness, type PasswordWeaknessCode, Provider, Record$1 as Record, RecordType, type RecoveredSecpSig, Slug, type StorageDurability, type StorageQuota, SvmAddress, SvmTxBuildParams, Transaction, TransferRequest, VmToken, argon2BackendInfo, closeAllRpcClients, registerDialect };
