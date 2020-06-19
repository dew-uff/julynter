import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Token } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';

import { ActivityMonitor, PathExt } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { NotebookPanel, INotebookTracker } from '@jupyterlab/notebook';

import { IReport } from '../linter/interfaces';
import { Languages } from '../linter/languages';

import { NotebookHandler } from './notebookhandler';
import { ListRenderer } from './view/listrenderer';
import { KernelRenderer } from './view/kernelrenderer';

import { Config } from './config';
import { ExperimentManager } from './experimentmanager';

/**
 * Timeout for throttling Julynter rendering.
 */
const RENDER_TIMEOUT = 1000;


/**
 * An interface for a Julynter
 */
export interface IJulynter extends Julynter {}

/**
 * The Julynter token.
 */
export const IJulynter = new Token<Julynter>(
  'jupyterlab-julynter:IJulynter'
);


/**
 * A widget for hosting a notebook julynter.
 */
export class Julynter extends Widget {

  private _docmanager: IDocumentManager;
  private _currentWidget: Widget | null;
  private _currentHandler: NotebookHandler | null;
  private _monitor: ActivityMonitor<any, any> | null;
  private _tracker: INotebookTracker | null;
  private _config: Config;
  private _experimentManager: ExperimentManager;
  public handlers: { [id: string]: Promise<NotebookHandler> };
  

  /**
   * Create a new table of contents.
   */
  constructor(docmanager: IDocumentManager, tracker: INotebookTracker) {
    super()
    this._docmanager = docmanager;
    this._tracker = tracker;
    this.handlers = {};
    

    this._currentHandler = null;
    this._experimentManager = new ExperimentManager();
    this._config = new Config(this._experimentManager.config);
  }

  addNewNotebook(nbPanel: NotebookPanel): void {
    //A promise that resolves after the initialization of the handler is done.
    const handlers = this.handlers;
    const update = this.update.bind(this);
    const experimentmanager = this._experimentManager;
    const config = this._config;
    const docManager = this._docmanager;
    
    this.handlers[nbPanel.id] = new Promise(function(resolve, reject) {
      const session = nbPanel.sessionContext;
      const handler = new NotebookHandler(
        docManager, session, nbPanel, config, 
        experimentmanager, update
      );
      let scripts = session.ready.then(handler.getKernelLanguage.bind(handler))
      scripts.then((language: Languages.LanguageModel) => {
        config.load(() => {
          handler.configureHandler(language);
        
          
          nbPanel.disposed.connect(() => {
            delete handlers[nbPanel.id];
            handler.dispose();
          });
          
          handler.ready.then(() => {
            resolve(handler);
          });
        });
  
      });
      scripts.catch((result: string) => {
        reject(result);
      })
    });
  }

  changeActiveWidget(widget: Widget): void {
    let future = this.handlers[widget.id];
    let self = this;
    if (future !== undefined) {
      future.then((source: NotebookHandler) => {
        if (source) {
          self.currentHandler = source;
          this._experimentManager.reportVisibility(this._currentHandler, true);
          this.updateJulynter();
        } else {
          self.currentHandler = null;
          this.updateJulynter();
        }
      });
    } else if (self._currentHandler !== null) {
      self.currentHandler = null;
      this.updateJulynter();
    }
    if (this._tracker.has(widget) && widget !== this._currentWidget){
      // change wigdet and it is not the same as the previous one
      this._currentWidget = widget;
      
      // Dispose an old activity monitor if it existsd
      if (this._monitor) {
        this._monitor.dispose();
        this._monitor = null;
      }
      // If we are wiping the Julynter, update and return.
      if (!this._currentWidget) {
        this.updateJulynter();
        return;
      }

      // Find the document model associated with the widget.
      const context = this._docmanager.contextForWidget(this._currentWidget);
      if (!context || !context.model) {
        throw Error('Could not find a context for Julynter');
      }

      // Throttle the rendering rate of julynter.
      this._monitor = new ActivityMonitor({
        signal: context.model.contentChanged,
        timeout: RENDER_TIMEOUT
      });
      this._monitor.activityStopped.connect(this.update, this);
      this.updateJulynter();
    } else {
      this._currentWidget = null;
    }
  }

  updateJulynter() {
    let title = 'Julynter';
    let listRenderer: JSX.Element = null;
    let kernelRenderer: JSX.Element = null;

    if (this._currentWidget && this._currentHandler) {
      const reports: IReport[] = this.currentHandler.lint();
      const context = this._docmanager.contextForWidget(this._currentWidget);
      if (context) {
        title = PathExt.basename(context.localPath);
      }
    
      listRenderer = <ListRenderer options={this._currentHandler.options} reports={reports}/>;
      kernelRenderer = <KernelRenderer notebook={this._currentHandler}/>;
    }
    const renderedJSX = (
      <div className="jp-Julynter">
      <header>
        <div className="jp-Julynter-title">
          {title}
        </div>
        {kernelRenderer}
      </header>
      {listRenderer}
    </div>
    );
    ReactDOM.render(renderedJSX, this.node);
  }

  /**
   * Rerender after showing.
   */
  protected onAfterShow(msg: Message): void {
    this._experimentManager.reportVisibility(this._currentHandler, true);
    this.update();
  }

  /**
   * Notify after hide.
   */
  protected onAfterHide(msg: Message): void {
    this._experimentManager.reportVisibility(this._currentHandler, false);
  }

  /**
   * Handle an update request.
   */
  protected onUpdateRequest(msg: Message): void {
    // Don't bother if the Julynter is not visible
    /* if (!this.isVisible) {
      return;
    } */
    this.updateJulynter();
  }

  dispose(): void {
    if ( this.isDisposed ) {
        return;
    }
    this._currentHandler.disconnectHandler();
    this._currentHandler = null;
    super.dispose();
  }

  get currentHandler() {
    return this._currentHandler;
  }

  set currentHandler(newHandler: NotebookHandler) {
    if(this._currentHandler !== newHandler) {
      if (this._currentHandler !== null) {
        this._currentHandler.disconnectHandler();
      }
      this._currentHandler = newHandler;
      if (this._currentHandler !== null) {
        this._currentHandler.connectHandler();
      }
    }
  }

}
