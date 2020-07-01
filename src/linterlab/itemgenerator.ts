import { showDialog, Dialog } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import { renameDialog, IDocumentManager } from '@jupyterlab/docmanager';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { IObservableJSON } from '@jupyterlab/observables';

import { ERRORS } from '../linter/errors';
import {
  ErrorTypeKey,
  IItemGenerator,
  IGroupGenerator,
  IReport,
  ReportId,
  ReportType
} from '../linter/interfaces';
import { NotebookHandler } from './notebookhandler';

function isNumber(value: string | number): boolean {
  return value !== null && !isNaN(Number(value.toString()));
}

function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export class ItemGenerator implements IItemGenerator {
  _docManager: IDocumentManager;
  _nbPanel: NotebookPanel;
  _notebookContent: Notebook;
  _handler: NotebookHandler;

  constructor(docManager: IDocumentManager, handler: NotebookHandler) {
    this._docManager = docManager;
    this._handler = handler;
    this._notebookContent = handler.nbPanel.content;
  }

  create(
    cellId: number | string,
    type: ReportType,
    messageId: ReportId,
    args: any[]
  ): IReport {
    const message = ERRORS[messageId];
    return {
      text: message.label(...args),
      reportType: message.type,
      reportId: messageId,
      suggestion: message.suggestion,
      cellId: cellId,
      visible: true,
      filteredOut: false,
      type: type,
      action: message.action,
      boundAction: message.action.execute(this, ...args)
    };
  }

  renameNotebook(): void {
    renameDialog(this._docManager, this._handler.nbPanel.context.path);
  }

  goToCell(index: number): void {
    const cell = this._notebookContent.widgets[index];
    this._notebookContent.activeCellIndex = index;
    cell.node.scrollIntoView();
  }

  addModule(index: number, module: string): void {
    const handler = this._handler;
    showDialog({
      title: 'Add requirement',
      body: `Add "${module}" to requirements?`,
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Add' })]
    }).then(result => {
      Promise.resolve(result.button.accept).then((ok: boolean) => {
        if (ok) {
          handler.addModule(module);
        }
      });
    });
    this.goToCell(index);
  }

  restoreCell(index: number, executionCount: number, code: string): void {
    const cell = this._notebookContent.model.contentFactory.createCodeCell({});
    cell.value.text = code;
    cell.executionCount = executionCount;
    this._notebookContent.model.cells.insert(index, cell);
    this.goToCell(index);
  }
}

export class GroupGenerator implements IGroupGenerator {
  _nbPanel: NotebookPanel;
  _update: () => void;

  constructor(nbPanel: NotebookPanel, update: () => void) {
    this._nbPanel = nbPanel;
    this._update = update;
  }

  create(
    title: string | number,
    reportType: ErrorTypeKey,
    elements: IReport[]
  ): IReport {
    let strTitle: string;
    let metavar: IObservableJSON;
    let metaname: string;
    if (isNumber(title)) {
      strTitle = 'Cell ' + title;
      const cell: Cell = this._nbPanel.content.widgets[Number(title)];
      metavar = cell.model.metadata;
      metaname = 'julynter-cellgroup-collapsed';
    } else {
      strTitle = capitalizeFirstLetter(String(title));
      metavar = this._nbPanel.model.metadata;
      metaname =
        'julynter-cellgroup-' +
        strTitle.replace(' ', '-').toLowerCase() +
        '-collapsed';
    }
    let collapsed = metavar.get(metaname) as boolean;
    collapsed = collapsed !== undefined ? collapsed : false;
    elements.forEach(element => {
      element.visible = !collapsed;
      element.hasParent = true;
    });

    const result: IReport = {
      text: strTitle,
      reportType: reportType,
      reportId: 'group',
      cellId: 'group',
      suggestion: null,
      visible: true,
      filteredOut: false,
      collapsed: collapsed,
      type: 'group',
      hasParent: true,
      action: null,
      boundAction: () => {
        return;
      }
    };
    const onClickFactory = (line: number) => {
      return (): void => {
        elements.forEach(element => {
          element.visible = result.collapsed;
        });
        result.collapsed = !result.collapsed;
        result.action.label = result.collapsed
          ? 'Expand category'
          : 'Collapse category';
        metavar.set(metaname, !collapsed);
        this._update();
      };
    };
    result.boundAction = onClickFactory(0);
    result.action = {
      label: result.collapsed ? 'Expand category' : 'Collapse category',
      title: 'Collapse or expand lints of this type',
      execute: (ItemGenerator: IItemGenerator, ...args: any[]) => {
        return (): void => {
          return;
        };
      }
    };
    return result;
  }
}
