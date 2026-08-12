import { c as Address, G as SvmTxBuildParams, F as SvmTransaction } from './workspace-bxOhg4wh.js';

interface SvmInstruction {
    readonly programId: string;
    readonly accounts: ReadonlyArray<{
        pubkey: string;
        isSigner: boolean;
        isWritable: boolean;
    }>;
    readonly data: Uint8Array;
}
declare const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
declare const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
declare const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
declare const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";
interface SplTokenArgs {
    amount?: bigint | number;
    decimals?: number;
    mintAuthority?: string;
    freezeAuthority?: string | null;
    m?: number;
    authorityType?: number;
    newAuthority?: string | null;
}
interface SplTokenAccountSet {
    source?: string;
    destination?: string;
    authority?: string;
    mint?: string;
    account?: string;
    owner?: string;
    delegate?: string;
    mintAuthority?: string;
    freezeAuthority?: string;
    multisig?: string;
    rent?: string;
    signers?: ReadonlyArray<string>;
}

declare function splTokenEncodeInstruction(name: string, args: SplTokenArgs, accounts: SplTokenAccountSet, opts?: {
    programId?: string;
}): SvmInstruction;

declare class Program {
    readonly name: string;
    readonly idl: unknown;
    constructor(name: string, idl: unknown);
    static load(name: string): Program | null;
    
    encodeInstruction(instructionName: string, args: Readonly<Record<string, unknown>>, accounts: Readonly<Record<string, string>>): SvmInstruction;
    decodeInstruction(_instructionName: string, _encoded: SvmInstruction): {
        args: Readonly<Record<string, unknown>>;
        accounts: Readonly<Record<string, string>>;
    };
    
    call(from: Address, instructionName: string, args: Readonly<Record<string, unknown>>, accounts: Readonly<Record<string, string>>, opts?: Partial<SvmTxBuildParams>): SvmTransaction;
}

export { ASSOCIATED_TOKEN_PROGRAM_ID as A, NATIVE_SOL_MINT as N, Program as P, type SvmInstruction as S, TOKEN_2022_PROGRAM_ID as T, type SplTokenAccountSet as a, type SplTokenArgs as b, TOKEN_PROGRAM_ID as c, splTokenEncodeInstruction as s };
