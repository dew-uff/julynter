import {
  JupyterFrontEnd, JupyterFrontEndPlugin, ILayoutRestorer, ILabShell
} from '@jupyterlab/application';

import {
  NotebookPanel,
  INotebookTracker,
} from '@jupyterlab/notebook';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { IJulynterRegistry, JulynterRegistry } from './linterlab/registry';

import { Julynter } from './linterlab/julynter';

import { createNotebookGenerator } from './linterlab/view/notebookgenerator';

import { JulynterKernelHandler } from './linterlab/kernel/handler';

import { KernelConnector } from './linterlab/kernel/kernelconnector';

import { Languages } from './linter/languages';

import '../style/index.css';
import { OptionsManager } from './linterlab/view/optionsmanager';

/**
 * Initialization data for the julynter extension.
 */
const extension: JupyterFrontEndPlugin<IJulynterRegistry> = {
  id: 'jupyterlab-julynter',
  autoStart: true,
  provides: IJulynterRegistry,
  requires: [
    IDocumentManager,
    ILabShell,
    ILayoutRestorer,
    INotebookTracker,
  ],
  activate: activateJulynter
};

// VariableInspectionHandler -> JulynterHandler

function activateJulynter(
  app: JupyterFrontEnd,
  docmanager: IDocumentManager,
  labShell: ILabShell,
  restorer: ILayoutRestorer,
  notebookTracker: INotebookTracker
): IJulynterRegistry {
  // Create the widget.
  const julynter = new Julynter(docmanager, notebookTracker)
  // Create the registry.
  const registry = new JulynterRegistry();
  // Add the julynter to the left area.
  julynter.title.iconClass = 'jp-TrustedIcon jp-SideBar-tabIcon';
  julynter.title.caption = 'Julynter';
  julynter.id = 'julynter';
  labShell.add(julynter, 'left', { rank: 700 });
   
  // Add the julynter widget to the application restorer.
  restorer.add(julynter, 'juputerlab-julynter');
 
  // Create options manager
  const options = new OptionsManager(julynter);

  // Create a notebook JulynterRegistry.IGenerator
  registry.addGenerator(createNotebookGenerator(julynter, options));


  const handlers: { [id: string]: Promise<JulynterKernelHandler> } = {};

  /**
   * Subscribes to the creation of new notebooks. If a new notebook is created, build a new handler for the notebook.
   * Adds a promise for a instanced handler to the 'handlers' collection.
   */
  notebookTracker.widgetAdded.connect(( sender, nbPanel: NotebookPanel ) => {
   //A promise that resolves after the initialization of the handler is done.
    handlers[nbPanel.id] = new Promise( function( resolve, reject ) {
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
  } );


  console.log('JupyterLab extension julynter is activated!');
  

  // Change the julynter when the active widget changes.
  labShell.currentChanged.connect((sender, args) => {
    let widget = app.shell.currentWidget;
    if (!widget) {
      return;
    }
    let future = handlers[widget.id];
    future.then((source: JulynterKernelHandler) => {
      if (source) {
        julynter.handler = source;
        julynter.handler.performQuery();
      }
    });
    let generator = registry.findGeneratorForWidget(widget);
    if (!generator) {
      // If the previously used widget is still available, stick with it.
      // Otherwise, set the current julynter widget to null.
      if (julynter.current && julynter.current.widget.isDisposed) {
        julynter.current = null;
      }
      return;
    }
    julynter.current = { widget, generator };
  });

  return registry;
}

export default extension;
