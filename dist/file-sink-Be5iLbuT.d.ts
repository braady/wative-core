import { k as ContainerState, q as LogSink, L as LogLevel, p as LogRecord } from './workspace-CBxKR80D.js';
import { a as ContainerProvider } from './container-provider-B8M0ylrK.js';

declare class HybridProvider extends ContainerProvider {
    #private;
    readonly rootPath: string;
    constructor(rootPath: string);
    protected _exist(path: string): Promise<boolean>;
    protected _listItems(path: string): Promise<string[]>;
    protected _read(path: string): Promise<Uint8Array>;
    
    protected _write(path: string, data: Uint8Array): Promise<void>;
    protected _remove(path: string): Promise<void>;
    protected _ensureDir(path: string): Promise<void>;
    
    protected _prepareUnlock(): Promise<void>;
    
    protected get _rootPrefix(): string;
    
    protected _join(base: string, segment: string): string;
    
    static probe(rootPath: string): Promise<boolean>;
    
    inspectContainer(): Promise<ContainerState>;
}

declare class HybridProviderV3 extends HybridProvider {
    constructor(rootPath: string);
}

interface FileSinkOptions {
    dir: string;
    filePrefix?: string;
    maxFileSize?: number;
    maxFiles?: number;
    minLevel?: LogLevel;
}
declare class FileSink implements LogSink {
    #private;
    constructor(opts: FileSinkOptions);
    write(record: LogRecord): void;
    
    flush(): Promise<void>;
    close(): Promise<void>;
}

export { FileSink as F, HybridProvider as H, type FileSinkOptions as a, HybridProviderV3 as b };
