import { JSONObject } from '@lumino/coreutils';
import { IDisposable } from '@lumino/disposable';
import { Signal, ISignal } from '@lumino/signaling';

import { ISessionContext } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { NotebookPanel } from '@jupyterlab/notebook';
import { KernelMessage } from '@jupyterlab/services';
import { IInfoReply } from '@jupyterlab/services/lib/kernel/messages';
import { IComm } from '@jupyterlab/services/lib/kernel/kernel';

import {
  IGenericNotebookMetadata,
  IGenericCellMetadata,
  IQueryResult,
  IReport,
} from '../linter/interfaces';
import { Languages } from '../linter/languages';
import { Linter } from '../linter/lint';
import { Config } from './config';
import { ExperimentManager } from './experimentmanager';
import { GroupGenerator, ItemGenerator } from './itemgenerator';
import { OptionsManager } from './optionsmanager';
import { ErrorHandler } from './errorhandler';
import { CellWidget } from './view/cellwidget';

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
  private _ready: Promise<void>;
  private _panelId: string;
  private _nbPanel: NotebookPanel;
  private _session: ISessionContext;
  private _docManager: IDocumentManager;
  private _update: () => void;
  private _experimentManager: ExperimentManager;
  private _eh: ErrorHandler;
  private _reportedStart: boolean;
  private _icomm: IComm;

  public options: OptionsManager;
  public update: IQueryResult | null;
  public hasKernel: boolean;
  public cellLints: { [num:string]: CellWidget };

  _boundQueryCall: (
    sess: ISessionContext,
    args: KernelMessage.IMessage<KernelMessage.MessageType>
  ) => void;

  constructor(
    docManager: IDocumentManager,
    session: ISessionContext,
    nbPanel: NotebookPanel,
    config: Config,
    em: ExperimentManager,
    eh: ErrorHandler,
    update: () => void
  ) {
    this._eh = eh;
    try {
      this.cellLints = {};
      this._docManager = docManager;
      this._session = session;
      this._nbPanel = nbPanel;
      this._experimentManager = em;
      this._update = update;
      this._panelId = this._nbPanel.id;
      this._language = Languages.GENERIC;
      this.options = new OptionsManager(nbPanel, config, em, eh, update);
      this.update = {};
      this.hasKernel = false;
      this._reportedStart = false;
      this._icomm = null;
      this._boundQueryCall = this._queryCall.bind(this);

      em.reportActivity(this, 'open');
      session.statusChanged.connect(
        (sender: ISessionContext, status: KernelMessage.Status) => {
          try {
            const kdn = session.kernelDisplayName;
            if (status.endsWith('restarting')) {
              em.reportKernelActivity(this, 'restartKernel', kdn);
              this._reportedStart = true;
              this._kernelRestarted.emit(this._session.ready);
            } else if (status === 'unknown') {
              em.reportKernelActivity(this, 'stopKernel', kdn);
              this._reportedStart = false;
            } else if (
              (status === 'idle' || status === 'busy') &&
              !this._reportedStart
            ) {
              em.reportKernelActivity(this, 'useKernel', kdn);
              this._reportedStart = true;
            }
          } catch (error) {
            throw this._eh.report(
              error,
              'NotebookHandler:constructor.statusChanged',
              [nbPanel.title.label, status]
            );
          }
        }
      );
    } catch (error) {
      throw this._eh.report(error, 'NotebookHandler:constructor', [
        nbPanel.title.label,
      ]);
    }
  }

  getKernelLanguage(): Promise<Languages.LanguageModel> {
    try {
      return this._session.session.kernel.info.then((infoReply: IInfoReply) => {
        try {
          const model = Languages.getScript(infoReply.language_info.name);
          this._experimentManager.reportNotebookKernel(
            this,
            this._session.session.kernel.name,
            infoReply.language_info.name
          );
          return model;
        } catch (error) {
          throw this._eh.report(
            error,
            'NotebookHandler:getKernelLanguage.then',
            [this._session.session.kernel.name, infoReply.language_info.name]
          );
        }
      });
    } catch (error) {
      throw this._eh.report(error, 'NotebookHandler:getKernelLanguage', []);
    }
  }

  createComm(): void {
    const kernel = this._session.session.kernel;
    if (kernel) {
      kernel.registerCommTarget('julynter.comm', (comm, msg) => {
        this._icomm = comm;
        this._icomm.onMsg = this._receiveJulynterQuery.bind(this);
        // console.log('ICOMM!', this._icomm.commId);
      });
    }
  }

  configureHandler(language: Languages.LanguageModel): void {
    try {
      this._language = language;
      this._ready = this._session.ready.then(() => {
        this.createComm();
        this._initOnKernel();
      });

      this._kernelRestarted.connect(
        (sender: any, kernelReady: Promise<void>) => {
          this._inspected.emit({
            status: 'Restarting Kernel...',
          } as IJulynterKernelUpdate);
          // Emit restarting

          this._ready = kernelReady.then(() => {
            this.createComm();
            this._initOnKernel();
          });
        }
      );
    } catch (error) {
      throw this._eh.report(error, 'NotebookHandler:configureHandler', [
        language.name,
      ]);
    }
  }

  disconnectHandler(): void {
    try {
      this.inspected.disconnect(this.onQueryUpdate, this);
      this.disposed.disconnect(this.onSourceDisposed, this);
      this._experimentManager.reportActivity(this, 'MoveOut');
    } catch (error) {
      throw this._eh.report(error, 'NotebookHandler:disconnectHandler', []);
    }
  }

  connectHandler(): void {
    try {
      this.inspected.connect(this.onQueryUpdate, this);
      this.disposed.connect(this.onSourceDisposed, this);
      this.performQuery();
      this._experimentManager.reportActivity(this, 'MoveIn');
    } catch (error) {
      throw this._eh.report(error, 'NotebookHandler:connectHandler', []);
    }
  }

  get name(): string {
    return this._session.path;
  }

  get id(): string {
    return this._panelId;
  }

  get nbPanel(): NotebookPanel {
    return this._nbPanel;
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

  get ready(): Promise<void> {
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
    try {
      if (this.isDisposed) {
        return;
      }
      this._experimentManager.reportCloseNotebook(this);
      this._isDisposed = true;
      this._disposed.emit(void 0);
      Signal.clearData(this);
    } catch (error) {
      throw this._eh.report(error, 'NotebookHandler:dispose', []);
    }
  }

  /**
   * Lint notebook
   */
  public lint(): IReport[] {
    try {
      const groupGenerator = new GroupGenerator(
        this._nbPanel,
        this._update,
        this._eh
      );
      const itemGenerator = new ItemGenerator(this._docManager, this, this._eh);
      const notebookMetadata: IGenericNotebookMetadata = {
        title: this.nbPanel.title.label,
        cells: (this.nbPanel.content
          .widgets as unknown) as IGenericCellMetadata[],
      };
      const linter = new Linter(this.options, this.update, this.hasKernel);
      const results = linter.generate(
        notebookMetadata,
        itemGenerator,
        groupGenerator
      );
      this._experimentManager.reportLinting(this, results);
      return results;
    } catch (error) {
      throw this._eh.report(error, 'NotebookHandler:lint', []);
    }
  }

  private _createPromise(error: any = null): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      if (!error) {
        resolve();
      } else {
        reject(error);
      }
    });
  }

  private initScript(): Promise<void> {
    try {
      if (this._language === null) {
        return this._createPromise('Language not loaded');
      }
      const code = this._language.initScript;
      if (code === null) {
        return this._createPromise();
      }
      const content: KernelMessage.IExecuteRequestMsg['content'] = {
        code: code,
        stop_on_error: false,
        store_history: false,
        silent: true,
      };
      const kernel = this._session.session.kernel;
      if (!kernel) {
        return Promise.reject(
          new Error('Require kernel to perform advanced julynter operations!')
        );
      }
      const future = kernel.requestExecute(content, false);
      future.onIOPub = (msg: KernelMessage.IIOPubMessage): void => {
        this.performQuery();
      };
      return future.done.then(() => {
        return;
      });
    } catch (error) {
      throw this._eh.report(error, 'NotebookHandler:initScript', []);
    }
  }

  public send(data: JSONObject): void {
    const session = this._session.session;
    if (
      this._icomm &&
      session &&
      session.kernel &&
      session.kernel.hasComm(this._icomm.commId)
    ) {
      this._icomm.send(data);
    }
  }

  /**
   * Send a query command to the kernel
   */
  public performQuery(): void {
    this.send({
      operation: 'query',
      requirements: this.options.checkRequirements(),
    });
  }

  /**
   * Send message to kernel add a module
   */
  public addModule(module: string): void {
    this.send({
      operation: 'addModule',
      module: module,
      requirements: this.options.checkRequirements(),
    });
  }

  /**
   * Initializes the kernel by running the set up script located at _initScriptPath.
   */
  private _initOnKernel(): Promise<void> {
    return this.initScript().then(() => {
      this._session.iopubMessage.disconnect(this._boundQueryCall);
      this._session.iopubMessage.connect(this._boundQueryCall);
    });
  }

  /*
   * Handle query response
   */
  private _receiveJulynterQuery(
    msg: KernelMessage.ICommMsgMsg
  ): void | PromiseLike<void> {
    try {
      const operation = msg.content.data.operation;
      if (operation === 'queryResult') {
        this._inspected.emit({
          status: '',
          kernelName: this._session.kernelDisplayName || '',
          result: msg.content.data as IQueryResult,
        });
      } else if (operation === 'error') {
        this._eh.report(
          'Failed to run ICOMM command',
          'NotebookHandler:_receiveJulynterQuery',
          [msg]
        );
      } else if (operation === 'init') {
        this.performQuery();
      }
    } catch (error) {
      throw this._eh.report(error, 'NotebookHandler:_receiveJulynterQuery', [
        msg,
      ]);
    }
  }

  /*
   * Invokes a inspection if the signal emitted from specified session is an 'execute_input' msg.
   */
  private _queryCall(
    sess: ISessionContext,
    args: KernelMessage.IMessage
  ): void {
    try {
      const msg: KernelMessage.IIOPubMessage = args as KernelMessage.IIOPubMessage;
      const msgType = msg.header.msg_type;
      switch (msgType) {
        case 'execute_input':
          this.performQuery();
          break;
        default:
          break;
      }
    } catch (error) {
      throw this._eh.report(error, 'NotebookHandler:_queryCall', [
        args.content,
      ]);
    }
  }

  /**
   * Handle kernel signals.
   */
  protected onQueryUpdate(
    sender: NotebookHandler,
    update: IJulynterKernelUpdate
  ): void {
    if (update.status !== '') {
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
  protected onSourceDisposed(sender: NotebookHandler, args: void): void {
    return;
  }
}
