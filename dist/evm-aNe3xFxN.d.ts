import { c as Address, n as EvmTxBuildParams, m as EvmTransaction } from './workspace-bxOhg4wh.js';

interface AbiItem {
    type?: string;
    name?: string;
    inputs?: ReadonlyArray<{
        name: string;
        type: string;
        components?: unknown[];
    }>;
    outputs?: ReadonlyArray<{
        name: string;
        type: string;
        components?: unknown[];
    }>;
    stateMutability?: string;
}

declare class Contract {
    #private;
    readonly name: string;
    readonly abi: ReadonlyArray<AbiItem>;
    constructor(name: string, abi: ReadonlyArray<unknown>);
    
    static load(name: string): Contract | null;
    
    encode(functionName: string, args: ReadonlyArray<unknown>): string;
    
    decode(functionName: string, encoded: string): ReadonlyArray<unknown>;
    
    call(from: Address, contractAddress: string, functionName: string, args: ReadonlyArray<unknown>, opts?: Partial<EvmTxBuildParams>): EvmTransaction;
}

export { type AbiItem as A, Contract as C };
