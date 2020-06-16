// Code from https://github.com/lckr/jupyterlab-variableInspector

import { ISignal, Signal } from "@lumino/signaling";

import { ISessionContext } from "@jupyterlab/apputils";

import { KernelMessage } from "@jupyterlab/services";
import { IInfoReply } from "@jupyterlab/services/lib/kernel/messages";
``

/**
 * Connector class that handles execute request to a kernel
 */
export
    class KernelConnector {

    private _session: ISessionContext;
    private _kernelRestarted = new Signal<this, Promise<void>>(this); 

    constructor( options: KernelConnector.IOptions ) {
        this._session = options.session;
        this._session.statusChanged.connect( (sender: ISessionContext, new_status: KernelMessage.Status) => {
            switch (new_status) {
            	case "restarting":
                case "autorestarting":
            	    this._kernelRestarted.emit(this._session.ready);
            	default:
            		break;
            }
        });
    }

    get kernelRestarted(): ISignal<KernelConnector, Promise<void>>{
        return this._kernelRestarted;
    }

    get kernelLanguage(): Promise<string> {
        return this._session.session.kernel.info.then( (infoReply: IInfoReply) => {
            return infoReply.language_info.name;
        });
    }

    get kernelName(): string {
        return this._session.kernelDisplayName;
    }


    /**
     *  A Promise that is fulfilled when the session associated w/ the connector is ready.
     */
    get ready(): Promise<void> {
        return this._session.ready;
    }

    /**
     *  A signal emitted for iopub messages of the kernel associated with the kernel.
     */
    get iopubMessage(): ISignal<ISessionContext, KernelMessage.IMessage> {
        return this._session.iopubMessage;
    }



    /**
     * Executes the given request on the kernel associated with the connector.
     * @param content: IExecuteRequestMsg to forward to the kernel.
     * @param ioCallback: Callable to forward IOPub messages of the kernel to.
     * @returns Promise<KernelMessage.IExecuteReplyMsg>
     */
     fetch( content: KernelMessage.IExecuteRequestMsg['content'], ioCallback: ( msg: KernelMessage.IIOPubMessage ) => any ): Promise<KernelMessage.IExecuteReplyMsg> {
        const kernel = this._session.session.kernel;
        if ( !kernel ) {
            return Promise.reject( new Error( "Require kernel to perform advanced julynter operations!" ) );
        }

        let future = kernel.requestExecute(content, false);
        future.onIOPub = ( ( msg: KernelMessage.IIOPubMessage ) => {
            ioCallback( msg );
        } );
        return future.done as Promise<KernelMessage.IExecuteReplyMsg>;
    }

}

export
namespace KernelConnector {
    export
        interface IOptions {
        session: ISessionContext;

    }
}