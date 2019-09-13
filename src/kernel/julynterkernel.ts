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
        executed_code?: { [cell: string]: string };
        cell_dependencies?: { [cell: string]: { [name: string]: string } };
        missing_dependencies?: { [cell: string]: string[] };
        absolute_paths?: { [cell: string]: string[] };
        has_imports?: number[];
        missing_requirements?: { [cell: string]: { [name: string]: {
            status: number;
            msg: string;
        } } };
    }
}