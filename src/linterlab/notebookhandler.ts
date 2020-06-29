import { IDisposable } from "@lumino/disposable";

import { Signal, ISignal } from "@lumino/signaling"

import { KernelMessage } from "@jupyterlab/services";

import { IExecuteResult, IError } from "@jupyterlab/nbformat"

import { ISessionContext } from "@jupyterlab/apputils";
import { IInfoReply } from "@jupyterlab/services/lib/kernel/messages";

import { IQueryResult, IReport, IGenericNotebookMetadata, IGenericCellMetadata } from "../linter/interfaces";
import { Languages } from '../linter/languages';

import { OptionsManager } from "./optionsmanager";
import { ExperimentManager } from "./experimentmanager";
import { NotebookPanel } from "@jupyterlab/notebook";
import { Config } from "./config";
import { IDocumentManager } from "@jupyterlab/docmanager";
import { GroupGenerator, ItemGenerator } from "./itemgenerator";
import { Linter } from "../linter/lint";


export interface IJulynterKernelUpdate {
  status: string;
  kernelName?: string;
  result?: IQueryResult;
} 


export class NotebookHandler implements IDisposable {
  private _language: Languages.LanguageModel | null;

  private _kernelRestarted = new Signal<this, Promise<void>>(this); 
  private _disposed = new Signal<this, void>(this);
  private _inspected = new Signal<this, IJulynterKernelUpdate>(this);
  private _isDisposed = false;
  private _ready : Promise<void>;
  private _panelId : string;
  private _nbPanel: NotebookPanel;
  private _attempts: number;
  private _session: ISessionContext;
  private _docManager: IDocumentManager;
  private _config: Config;
  private _update: ()=>void;
  

  private _experimentManager: ExperimentManager;
  private _error: string;
  private _reportedStart: boolean;
  
  public options: OptionsManager;
  public update: IQueryResult | null;
  public hasKernel: boolean;

  constructor(
    docManager: IDocumentManager,
    session: ISessionContext, 
    nbPanel: NotebookPanel,
    config: Config,
    experimentManager: ExperimentManager,
    update: ()=>void,
  ) {
    this._docManager = docManager;
    this._session = session; 
    this._nbPanel = nbPanel;
    this._config = config;
    this._experimentManager = experimentManager;
    this._update = update;
    this._panelId = this._nbPanel.id;
    this._language = null;
    this._attempts = 0;
    this.update = {};
    this.hasKernel = false;
    this._reportedStart = false;
    
    session.kernelDisplayName
    this._experimentManager.reportActivity(this, 'open');
    session.statusChanged.connect((sender: ISessionContext, status: KernelMessage.Status) => {
      if (status.endsWith('restarting')) {
        this._experimentManager.reportKernelActivity(this, 'restartKernel', session.kernelDisplayName);
        this._reportedStart = true;
        this._kernelRestarted.emit(this._session.ready);
      } else if (status == 'unknown') {
        this._experimentManager.reportKernelActivity(this, 'stopKernel', session.kernelDisplayName);
        this._reportedStart = false;
      } else if ((status == 'idle' || status == 'busy') && !this._reportedStart) {
        this._experimentManager.reportKernelActivity(this, 'useKernel', session.kernelDisplayName);
        this._reportedStart = true;
      }
    });

    
  }
  
  getKernelLanguage(): Promise<Languages.LanguageModel> {
    return this._session.session.kernel.info.then( (infoReply: IInfoReply) => {
      return Languages.getScript(infoReply.language_info.name);
    });
  }

  configureHandler(language: Languages.LanguageModel) {
    this.options = new OptionsManager(this._nbPanel, this._config, this._experimentManager, this._update);
    
    this._language = language;
    
    this._ready =  this._session.ready.then(() => {
      this._initOnKernel().then((msg:KernelMessage.IExecuteReplyMsg) => {
        this._session.iopubMessage.connect(this._queryCall);
        return;
      });
    });
    
    this._kernelRestarted.connect((sender: any, kernelReady: Promise<void>) => {
      this._inspected.emit(<IJulynterKernelUpdate>{
          status: 'Restarting Kernel...',
      });
      // Emit restarting

      this._ready = kernelReady.then(() => {
          this._initOnKernel().then((msg: KernelMessage.IExecuteReplyMsg) => {
            this._session.iopubMessage.connect(this._queryCall);
            this.performQuery();
          });         
      });
    });
    this._experimentManager.reportNotebookCode(this);
  }

  disconnectHandler() {
    this.inspected.disconnect(this.onQueryUpdate, this);
    this.disposed.disconnect(this.onSourceDisposed, this);
    this._experimentManager.reportActivity  (this, 'MoveOut');
  }

  connectHandler() {
    this.inspected.connect( this.onQueryUpdate, this );
    this.disposed.connect( this.onSourceDisposed, this );
    this.performQuery();
    this._experimentManager.reportActivity(this, 'MoveIn');
  }

  get name():string{
    return this._session.path;
  }

  get id():string{
    return this._panelId;
  }

  get nbPanel():NotebookPanel{
    return this._nbPanel;
  }

  get error():string{
    return this._error;
  }

  get experimentManager(): ExperimentManager {
    return this._experimentManager;
  }

  /**
   * A signal emitted when the handler is disposed.
   */
  get disposed(): ISignal<NotebookHandler, void> {
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
  get inspected(): ISignal<NotebookHandler, IJulynterKernelUpdate> {
    return this._inspected;
  }

  /**
   * Disposes the kernel connector.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._experimentManager.reportCloseNotebook(this);
    this._isDisposed = true;
    this._disposed.emit(void 0);
    Signal.clearData(this);
  }

  /**
   * Lint notebook
   */
  public lint(): IReport[] {
    const groupGenerator = new GroupGenerator(this._nbPanel, this._update);
    const itemGenerator = new ItemGenerator(this._docManager, this);
    const notebookMetadata: IGenericNotebookMetadata = {
      title: this.nbPanel.title.label,
      cells: this.nbPanel.content.widgets as unknown as IGenericCellMetadata[],
    }
    const linter = new Linter(this.options, this.update, this.hasKernel);
    const results = linter.generate(notebookMetadata, itemGenerator, groupGenerator);
    this._experimentManager.reportLinting(this, results);
    return results;
  }


  /**
   * Send a query command to the kernel
   */
  public performQuery(): void {
    if (this._language === null) {
      this._error = 'Language not loaded';
      return;
    }
    let content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this._language.queryCommand(this.options.checkRequirements()),
      stop_on_error: false,
      store_history: false
    };
    this.sendToKernel(content, this._handleQueryResponse);
  }

  /**
   * Send message to kernel add a module
   */
  public addModule(module:string): void {
    if (this._language === null) {
      this._error = 'Language not loaded';
      return;
    }
    let content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this._language.addModuleCommand(module, this.options.checkRequirements()),
      stop_on_error: false,
      store_history: false
    };
    this.sendToKernel(content, this._handleQueryResponse);
  }

  /**
   * Initializes the kernel by running the set up script located at _initScriptPath.
   */
  private _initOnKernel(): Promise<KernelMessage.IExecuteReplyMsg> {
    if (this._language === null) {
      this._error = 'Language not loaded';
      return;
    }
    let content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this._language.initScript,
      stop_on_error: true,
      silent: true,
    };

    return this.sendToKernel(content, null);
  }
    
  
  /*
   * Handle query response
   */
  private _handleQueryResponse = (response: KernelMessage.IIOPubMessage): void => {
    let msgType = response.header.msg_type;
    let payload: IExecuteResult;
    let payload_error: IError;
    let content: string;
    switch (msgType) {
      case 'execute_result':
      case "display_data":
        payload = response.content as IExecuteResult;
        content = payload.data['text/plain'] as string;
        if (content.slice(0, 1) == "'" || content.slice(0, 1) == '"'){
          content = content.slice(1,-1);
          content = content.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
        }
        this._inspected.emit({
          status: '',
          kernelName : this._session.kernelDisplayName || '',
          result:  <IQueryResult>JSON.parse(content)
        });
        break;
      case "error":
        payload_error = response.content as IError;
        if (payload_error.evalue.includes("julynter")) {
          this._attempts += 1;
          console.log("Failed to initialize scripts. Retrying " + this._attempts + "/3");
          if (this._attempts <= 3) {
            this._inspected.emit(<IJulynterKernelUpdate>{
              status: "Retrying to init",
            });
            this._initOnKernel().then((msg: KernelMessage.IExecuteReplyMsg) => {
              this._session.iopubMessage.connect(this._queryCall);
              this.performQuery();
            });         
          } else {
            this._error = "Failed to initilize scripts after 3 attempts"
          }
        }
      default:
        break;
    }
  };

  /*
   * Invokes a inspection if the signal emitted from specified session is an 'execute_input' msg.
   */
  private _queryCall = ( sess: ISessionContext, args: KernelMessage.IMessage ) => {
    let msg: KernelMessage.IIOPubMessage = args as KernelMessage.IIOPubMessage;
    let msgType = msg.header.msg_type;
    let code: string;
    switch (msgType) {
      case 'execute_input':
        code = (msg as KernelMessage.IExecuteInputMsg).content.code;
        if (!code.startsWith("_jupyterlab_julynter")) {
          this.performQuery();
        }
        break;
      default:
        break;
    }
  };

  /**
   * Handle kernel signals.
   */
  protected onQueryUpdate( sender: any, update: IJulynterKernelUpdate): void {
    if (update.status != ""){
      this.update = {};
      this.hasKernel = false;
    } else {
      this.hasKernel = true;
      this.update = update.result;
    }
  }

  /**
   * Handle disposed signals.
   */
  protected onSourceDisposed( sender: any, args: void ): void {
    console.log("Julynter Closed");
  }
    

  /**
   * Executes the given request on the kernel associated with the connector.
   */
  sendToKernel(
    content: KernelMessage.IExecuteRequestMsg['content'],
    ioCallback: ((msg: KernelMessage.IIOPubMessage) => any) | null
  ): Promise<KernelMessage.IExecuteReplyMsg> {
    const kernel = this._session.session.kernel;
    if (!kernel) {
      return Promise.reject(new Error('Require kernel to perform advanced julynter operations!'));
    }
    let future = kernel.requestExecute(content, false);
    future.onIOPub = ((msg: KernelMessage.IIOPubMessage) => {
      if (ioCallback !== null) {
        ioCallback(msg);
      }  
    });
    return future.done as Promise<KernelMessage.IExecuteReplyMsg>;
  }
}
