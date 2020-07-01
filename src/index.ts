import { Widget } from '@lumino/widgets';

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer,
  ILabShell
} from '@jupyterlab/application';

import { NotebookPanel, INotebookTracker } from '@jupyterlab/notebook';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { Julynter, IJulynter } from './linterlab/julynter';

import '../style/index.css';

/**
 * Initialization data for the julynter extension.
 */
const extension: JupyterFrontEndPlugin<Julynter> = {
  id: 'jupyterlab-julynter',
  autoStart: true,
  provides: IJulynter,
  requires: [IDocumentManager, ILabShell, ILayoutRestorer, INotebookTracker],
  activate: activateJulynter
};

// VariableInspectionHandler -> JulynterHandler

function activateJulynter(
  app: JupyterFrontEnd,
  docmanager: IDocumentManager,
  labShell: ILabShell,
  restorer: ILayoutRestorer,
  notebookTracker: INotebookTracker
): Julynter {
  // Create the widget.
  const julynter = new Julynter(docmanager, notebookTracker, labShell);

  // Add the julynter to the left area.
  julynter.title.iconClass = 'julynter-main-icon jp-SideBar-tabIcon';
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

  return julynter;
}

export default extension;
