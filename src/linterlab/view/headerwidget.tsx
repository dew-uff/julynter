import { ReactWidget } from "@jupyterlab/apputils";
import React from "react";
import { ErrorHandler } from "../errorhandler";
import { IJulynterStatus, StatusRenderer } from "./statusrenderer";

export class HeaderWidget extends ReactWidget {

    update: () => void;
    jtitle: string;
    status: IJulynterStatus;
    eh: ErrorHandler;

    constructor(jtitle: string, status: IJulynterStatus, eh: ErrorHandler, update: () => void) {
        super();
        this.jtitle = jtitle;
        this.update = update;
        this.status = status;
        this.eh = eh;
    }

    titleClick(): void {
        try {
          this.update();
        } catch (error) {
          throw this.eh.report(error, 'Julynter:titleClick', []);
        }
      }


    protected render(): import("react").ReactElement<any, string | ((props: any) => import("react").ReactElement<any, string | any | (new (props: any) => import("react").Component<any, any, any>) >) | (new (props: any) => import("react").Component<any, any, any>) > | import("react").ReactElement<any, string | ((props: any) => import("react").ReactElement<any, string | any | (new (props: any) => import("react").Component<any, any, any>) >) | (new (props: any) => import("react").Component<any, any, any>) >[] {
        return <header>
            <div
            className="julynter-title"
            onClick={this.titleClick.bind(this)}
            title="Click to reload"
            >
            {this.jtitle}
            </div>
            <StatusRenderer {...this.status} errorHandler={this.eh} />
        </header>
    }

}