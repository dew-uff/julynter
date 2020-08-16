import { Widget } from '@lumino/widgets';

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer,
  ILabShell,
} from '@jupyterlab/application';

import { NotebookPanel, INotebookTracker } from '@jupyterlab/notebook';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { Julynter } from './linterlab/julynter';

import '../style/index.css';
import { ErrorHandler } from './linterlab/errorhandler';
import { julynterIcon } from './iconimports';

/**
 * Initialization data for the julynter extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-extension:julynter',
  autoStart: true,
  requires: [IDocumentManager, ILabShell, ILayoutRestorer, INotebookTracker],
  activate: activateJulynter,
};

// VariableInspectionHandler -> JulynterHandler

function activateJulynter(
  app: JupyterFrontEnd,
  docmanager: IDocumentManager,
  labShell: ILabShell,
  restorer: ILayoutRestorer,
  notebookTracker: INotebookTracker
): void {
  const eh = new ErrorHandler();
  try {
    // Create the widget.
    const julynter = new Julynter(docmanager, notebookTracker, labShell, eh);
    // Add the julynter to the left area.
    julynter.title.icon = julynterIcon.bindprops({stylesheet: 'sideBar'});
    julynter.title.caption = 'Julynter';
    julynter.id = 'julynter';
    labShell.add(julynter, 'left', { rank: 700 });

    // Add the julynter widget to the application restorer.
    restorer.add(julynter, 'juputerlab-julynter');

    /**
     * Subscribes to the creation of new notebooks. If a new notebook is created, build a new handler for the notebook.
     * Adds a promise for a instanced handler to the 'handlers' collection.
     */
    notebookTracker.widgetAdded.connect((sender, nbPanel: NotebookPanel) => {
      julynter.addNewNotebook(nbPanel);
    });

    // Change the julynter when the active widget changes.
    labShell.currentChanged.connect((sender, args) => {
      const widget: Widget = args.newValue;
      if (!widget) {
        return;
      }
      julynter.changeActiveWidget(widget);
    });

    console.log('JupyterLab extension julynter is activated!');

    //return julynter;
  } catch (error) {
    throw eh.report(error, 'activateJulynter', []);
  }
}

export default extension;
