import { ISignal } from "@phosphor/signaling";

import { IQueryResult } from "../../linter/interfaces";


export interface IJulynterKernelUpdate {
  status: string;
  kernelName?: string;
  languageName?: string;
  result?: IQueryResult;
} 

export interface IJulynterKernelHandler {
  disposed: ISignal<any, void>;
  inspected: ISignal<any, IJulynterKernelUpdate>;
  performQuery(): void;
  addModule(module:string): void;
}
