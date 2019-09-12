import { ISignal } from "@phosphor/signaling";

export namespace IJulynterKernel {

    export interface IJulynterKernelHandler {
        disposed: ISignal<any, void>;
        inspected: ISignal<any, IJulynterKernelUpdate>;
        performInspection(): void;
    }

    export interface IJulynterKernelUpdate {
        status: string;
        kernelName?: string;
        languageName?: string;
        result?: IQueryResult;
    } 

    export interface IQueryResult {
        executed_code: { [cell: string]: string };
    }
}