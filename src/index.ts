import {
  JupyterFrontEnd, JupyterFrontEndPlugin, ILayoutRestorer, ILabShell
} from '@jupyterlab/application';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import {
  NotebookPanel,
  INotebookModel,
  INotebookTracker,
} from '@jupyterlab/notebook';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { IEditorTracker } from '@jupyterlab/fileeditor';

import { IDisposable, DisposableDelegate } from '@phosphor/disposable';
import { ToolbarButton } from '@jupyterlab/apputils';
import { IJulynterRegistry, JulynterRegistry } from './registry';
import { Julynter } from './julynter';

import {
  createNotebookGenerator,
} from './generators';

import '../style/index.css';



export class ButtonExtension implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
  createNew(panel: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): IDisposable {
    
    var toolbar = new ToolbarButton({
      className: "julynter-main",
      onClick: () => {
        alert("Teste");
      },
      tooltip: "View lint"
    })
    var button = toolbar.node;
    var icon = document.createElement('i');
    icon.classList.add('fa', "thermometer-1");
    button.appendChild(icon);

    panel.toolbar.insertItem(0, "teste", toolbar)
      
    return new DisposableDelegate(() => {
      toolbar.dispose();
    });

  }
}

/**
 * Initialization data for the julynter extension.
 */
const extension: JupyterFrontEndPlugin<IJulynterRegistry> = {
  id: 'jupyterlab-julynter',
  autoStart: true,
  provides: IJulynterRegistry,
  requires: [
    IDocumentManager,
    IEditorTracker,
    ILabShell,
    ILayoutRestorer,
    INotebookTracker,
  ],
  activate: activateJulynter
};

function activateJulynter(
  app: JupyterFrontEnd,
  docmanager: IDocumentManager,
  editorTracker: IEditorTracker,
  labShell: ILabShell,
  restorer: ILayoutRestorer,
  notebookTracker: INotebookTracker,
): IJulynterRegistry {
  console.log('JupyterLab extension julynter is activated!');
  // Create the widget.
  const julynter = new Julynter({ docmanager });

  // Create the registry.
  const registry = new JulynterRegistry();
  
  // Add the julynter to the left area.
  julynter.title.iconClass = 'jp-TrustedIcon jp-SideBar-tabIcon';
  julynter.title.caption = 'Julynter';
  julynter.id = 'julynter';
  labShell.add(julynter, 'left', { rank: 700 });

  // Add the julynter widget to the application restorer.
  restorer.add(julynter, 'juputerlab-julynter');

  // Create a notebook JulynterRegistry.IGenerator
  const notebookGenerator = createNotebookGenerator(
    notebookTracker,
    julynter
  );
  registry.addGenerator(notebookGenerator);

  // Change the ToC when the active widget changes.
  labShell.currentChanged.connect(() => {
    let widget = app.shell.currentWidget;
    if (!widget) {
      return;
    }
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
