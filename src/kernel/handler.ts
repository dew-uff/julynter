import { 
    IDisposable
} from "@phosphor/disposable";

import {
    Signal, ISignal
} from "@phosphor/signaling"

import {
    KernelMessage
} from "@jupyterlab/services";

import {
    nbformat
} from "@jupyterlab/coreutils"

import {
    KernelConnector
} from "./kernelconnector";

import {
    IJulynterKernel, 
} from "./julynterkernel";

import { IClientSession } from "@jupyterlab/apputils";


export class JulynterKernelHandler implements IDisposable, IJulynterKernel.IJulynterKernelHandler {
    private _connector: KernelConnector;
    private _queryCommand: string;
    private _initScript: string;
    private _disposed = new Signal<this, void>( this );
    private _inspected = new Signal<this, IJulynterKernel.IJulynterKernelUpdate>( this );
    private _isDisposed = false;
    private _ready : Promise<void>;
    private _id : string;
    private _attempts: number;

    constructor( options: JulynterKernelHandler.IOptions ) {
        this._connector = options.connector;
        this._id = options.id;
        this._queryCommand = options.queryCommand;
        this._initScript = options.initScript;
        this._attempts = 0;
        
        this._ready =  this._connector.ready.then(() => {
            this._initOnKernel().then(( msg:KernelMessage.IExecuteReplyMsg ) => {
                this._connector.iopubMessage.connect( this._queryCall );
                return;

            } );
        } );
        
        this._connector.kernelRestarted.connect(( sender: any, kernelReady: Promise<void> ) => {
            this._inspected.emit(<IJulynterKernel.IJulynterKernelUpdate>{
                status: "Restarting Kernel...",
            });
            // Emit restarting
    
            this._ready = kernelReady.then(() => {
                this._initOnKernel().then(( msg: KernelMessage.IExecuteReplyMsg ) => {
                    this._connector.iopubMessage.connect( this._queryCall );
                    this.performInspection();
                } );         
            } );
        } );

    }

    get id():string{
        return this._id;
    }

    /**
     * A signal emitted when the handler is disposed.
     */
    get disposed(): ISignal<JulynterKernelHandler, void> {
        return this._disposed;
    }

    get isDisposed(): boolean {
        return this._isDisposed;
    }
    
    get ready():Promise<void>{
        return this._ready;
    }

    /**
     * A signal emitted when an inspector value is generated.
     */
    get inspected(): ISignal<JulynterKernelHandler, IJulynterKernel.IJulynterKernelUpdate> {
        return this._inspected;
    }


    /**
     * Performs an inspection by sending an execute request with the query command to the kernel.
     */
    public performInspection(): void {
        let content: KernelMessage.IExecuteRequestMsg['content'] = {
            code: this._queryCommand,
            stop_on_error: false,
            store_history: false
        };
        this._connector.fetch( content, this._handleQueryResponse );
    }


    /*
     * Disposes the kernel connector.
     */
    dispose(): void {
        if ( this.isDisposed ) {
            return;
        }
        this._isDisposed = true;
        this._disposed.emit( void 0 );
        Signal.clearData( this );
    }

    /**
     * Initializes the kernel by running the set up script located at _initScriptPath.
     */
    private _initOnKernel(): Promise<KernelMessage.IExecuteReplyMsg> {
        let content: KernelMessage.IExecuteRequestMsg['content'] = {
            code: this._initScript,
            stop_on_error: true,
            silent: true,
        };

        return this._connector.fetch( content, ( () => { } ) );
    }

    /*
     * Handle query response. Emit new signal containing the IVariableInspector.IInspectorUpdate object.
     * (TODO: query resp. could be forwarded to panel directly)
     */
    private _handleQueryResponse = ( response: KernelMessage.IIOPubMessage ): void => {
        let msgType = response.header.msg_type;
        switch ( msgType ) {
            case "execute_result":
                let payload = response.content as nbformat.IExecuteResult;
                let content: string = <string>payload.data["text/plain"];
                if (content.slice(0, 1) == "'" || content.slice(0, 1) == "\""){
                    content = content.slice(1,-1);
                    content = content.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
                }

                this._inspected.emit({
                    status: "",
                    kernelName : this._connector.kernelName || "",
                    languageName : this._connector.kernelType || "",
                    result:  <IJulynterKernel.IQueryResult>JSON.parse(content)
                });
                break;
            case "display_data":
                let payload_display = response.content as nbformat.IExecuteResult;
                let content_display: string = <string>payload_display.data["text/plain"];
                if (content_display.slice(0, 1) == "'" || content_display.slice(0, 1) == "\""){
                    content_display = content_display.slice(1,-1);
                    content_display = content_display.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
                }

                this._inspected.emit({
                    status: "",
                    kernelName : this._connector.kernelName || "",
                    languageName : this._connector.kernelType || "",
                    result:  <IJulynterKernel.IQueryResult>JSON.parse(content_display)
                });
                break;
            case "error":
                    let payload_error = response.content as nbformat.IError;
                    if (payload_error.evalue.includes("julynter")) {
                        this._attempts += 1;
                        console.log("Failed to initialize scripts. Retrying " + this._attempts + "/3");
                        if (this._attempts <= 3) {
                            this._inspected.emit(<IJulynterKernel.IJulynterKernelUpdate>{
                                status: "Retrying to init",
                            });
                            this._initOnKernel().then(( msg: KernelMessage.IExecuteReplyMsg ) => {
                                this._connector.iopubMessage.connect( this._queryCall );
                                this.performInspection();
                            } );         
                        }
                    }
            default:
                break;
        }
    };

    /*
     * Invokes a inspection if the signal emitted from specified session is an 'execute_input' msg.
     */
    private _queryCall = ( sess: IClientSession, args: KernelMessage.IMessage ) => {
        let msg: KernelMessage.IExecuteInputMsg = args as KernelMessage.IExecuteInputMsg;
        let msgType = msg.header.msg_type;
        switch ( msgType ) {
            case 'execute_input':
                let code = msg.content.code;
                if ( !( code == this._queryCommand ) ) {
                    this.performInspection();
                }
                break;
            default:
                break;
        }
    };
}


/**
 * A name space for inspection handler statics.
 */
export
namespace JulynterKernelHandler {
    /**
     * The instantiation options for an inspection handler.
     */
    export
        interface IOptions {
        connector: KernelConnector;
        queryCommand: string;
        initScript: string;
        id : string;
    }
}

export
    class DummyHandler implements IDisposable,IJulynterKernel.IJulynterKernelHandler{
        private _isDisposed = false;
        private _disposed = new Signal<this,void>( this );
        private _inspected = new Signal<this, IJulynterKernel.IJulynterKernelUpdate>( this );
        private _connector : KernelConnector;
        
        constructor(connector : KernelConnector) {
            this._connector = connector;
        }
                
        get disposed() : ISignal<DummyHandler, void>{
            return this._disposed;
        }
       
        get isDisposed() : boolean {
            return this._isDisposed;
        }
       
        get inspected() : ISignal<DummyHandler, IJulynterKernel.IJulynterKernelUpdate>{
            return this._inspected;
        }
       
        dispose(): void {
            if ( this.isDisposed ) {
                return;
            }
            this._isDisposed = true;
            this._disposed.emit( void 0 );
            Signal.clearData( this );
        }
       
        public performInspection(): void{
            this._inspected.emit(<IJulynterKernel.IJulynterKernelUpdate>{
                status: "Language currently not supported",
                kernelName : this._connector.kernelName || "",
                languageName : this._connector.kernelType || ""
            });
        }

        public performDelete(varName: string){}
}

