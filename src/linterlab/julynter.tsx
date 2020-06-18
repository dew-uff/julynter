import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Token } from '@lumino/coreutils';
import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';

import { ActivityMonitor, PathExt } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { NotebookPanel, INotebookTracker } from '@jupyterlab/notebook';

import { IReport, IGenericNotebookMetadata, IGenericCellMetadata } from '../linter/interfaces';
import { Languages } from '../linter/languages';
import { Linter } from '../linter/lint';

import { JulynterKernelHandler } from './kernel/handler';
import { KernelConnector } from './kernel/kernelconnector';
import { OptionsManager } from './optionsmanager';
import { ListRenderer } from './view/listrenderer';
import { KernelRenderer } from './view/kernelrenderer';
import { ItemGenerator, GroupGenerator  } from './itemgenerator';
import { JulynterNotebook } from './julynternotebook';

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
  private _monitor: ActivityMonitor<any, any> | null;
  private _tracker: INotebookTracker | null;
  private _notebook: JulynterNotebook;
  public handlers: { [id: string]: Promise<JulynterKernelHandler> };
  public options: OptionsManager;

  /**
   * Create a new table of contents.
   */
  constructor(docmanager: IDocumentManager, tracker: INotebookTracker) {
    super()
    this._docmanager = docmanager;
    this._tracker = tracker;
    this.handlers = {};
    const update = this.update.bind(this);

    this._notebook = new JulynterNotebook();
    this.options = new OptionsManager(tracker, update);
  }

  addNewNotebook(nbPanel: NotebookPanel): void {
    //A promise that resolves after the initialization of the handler is done.
    const options = this.options;
    const handlers = this.handlers;

    this.handlers[nbPanel.id] = new Promise( function( resolve, reject ) {
      const session = nbPanel.sessionContext;
      const connector = new KernelConnector( { session } );

      let scripts: Promise<Languages.LanguageModel> = connector.ready.then(() => { // Create connector and init w script if it exists for kernel type.
        return connector.kernelLanguage.then((lang:string) =>{
          return Languages.getScript( lang );
        })
      });

      scripts.then(( result: Languages.LanguageModel ) => {
        let initScript = result.initScript;
        let queryCommand = result.queryCommand;
        let addModuleCommand = result.addModuleCommand;
        
        const koptions: JulynterKernelHandler.IOptions = {
          queryCommand: queryCommand,
          addModuleCommand: addModuleCommand,
          connector: connector,
          initScript: initScript,
          id: session.path,  //Using the sessions path as an identifier for now.
          options: options
        };
        const handler = new JulynterKernelHandler( koptions );
        nbPanel.disposed.connect(() => {
            delete handlers[nbPanel.id];
            handler.dispose();
        } );
        
        handler.ready.then(() => {
            resolve( handler );
        } );
      } );
      //Otherwise log error message.
      scripts.catch(( result: string ) => {
          reject( result );
      } )
    } );
  }

  changeActiveWidget(widget: Widget): void {
    let future = this.handlers[widget.id];
    if (future !== undefined) {
      future.then((source: JulynterKernelHandler) => {
        if (source) {
          this._notebook.handler = source;
          this._notebook.handler.performQuery();
        }
      });
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
      this.options.reloadOptions();
      this.updateJulynter();
    } else {
      this._currentWidget = null;
    }
  }

  updateJulynter() {
    let title = 'Julynter';
    let listRenderer: JSX.Element = null;
    let kernelRenderer: JSX.Element = null;

    if (this._currentWidget) {
      const update = this.update.bind(this);
      const groupGenerator = new GroupGenerator(this._tracker, update);
      const itemGenerator = new ItemGenerator(this._docmanager, this._tracker, this._notebook);
      const notebookMetadata: IGenericNotebookMetadata = {
        title: this._tracker.currentWidget.title.label,
        cells: this._tracker.currentWidget.content.widgets as unknown as IGenericCellMetadata[],
      }
      const linter = new Linter(this.options, this._notebook.update, this._notebook.hasKernel);
      const reports: IReport[] = linter.generate(notebookMetadata, itemGenerator, groupGenerator);

      const context = this._docmanager.contextForWidget(this._currentWidget);
      if (context) {
        title = PathExt.basename(context.localPath);
      }
    
      listRenderer = <ListRenderer options={this.options} tracker={this._tracker} reports={reports}/>;
      kernelRenderer = <KernelRenderer notebook={this._notebook}/>;
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
    this.update();
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
    this._notebook.handler = null;
    super.dispose();
  }

}
