import { showDialog, Dialog } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import { renameDialog, IDocumentManager } from '@jupyterlab/docmanager';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { IObservableJSON } from '@jupyterlab/observables';

import { ERRORS } from '../linter/reports';
import {
  ErrorTypeKey,
  IItemGenerator,
  IGroupGenerator,
  IReport,
  ReportId,
  ReportType,
} from '../linter/interfaces';
import { NotebookHandler } from './notebookhandler';
import { ErrorHandler } from './errorhandler';

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
  _eh: ErrorHandler;

  constructor(
    docManager: IDocumentManager,
    handler: NotebookHandler,
    eh: ErrorHandler
  ) {
    this._docManager = docManager;
    this._handler = handler;
    this._notebookContent = handler.nbPanel.content;
    this._eh = eh;
  }

  create(
    cellId: number | string,
    type: ReportType,
    messageId: ReportId,
    args: any[]
  ): IReport {
    try {
      const message = ERRORS[messageId];
      return {
        text: message.label(...args),
        reportType: message.type,
        reportId: messageId,
        suggestion: message.suggestion,
        reason: message.reason,
        cellId: cellId,
        visible: true,
        filteredOut: false,
        type: type,
        action: message.action,
        boundAction: message.action.execute(this, ...args),
        restart: message.restart,
      };
    } catch (error) {
      throw this._eh.report(error, 'ItemGenerator:create', [
        cellId,
        type,
        messageId,
        args,
      ]);
    }
  }

  renameNotebook(): void {
    try {
      renameDialog(this._docManager, this._handler.nbPanel.context.path);
    } catch (error) {
      throw this._eh.report(error, 'ItemGenerator:renameNotebook', [
        this._handler.nbPanel.context.path,
      ]);
    }
  }

  goToCell(index: number): void {
    try {
      const cell = this._notebookContent.widgets[index];
      this._notebookContent.activeCellIndex = index;
      cell.node.scrollIntoView();
    } catch (error) {
      throw this._eh.report(error, 'ItemGenerator:goToCell', [index]);
    }
  }

  addModule(index: number, module: string): void {
    try {
      const handler = this._handler;
      showDialog({
        title: 'Add requirement',
        body: `Add "${module}" to requirements?`,
        buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Add' })],
      }).then((result) => {
        Promise.resolve(result.button.accept).then((ok: boolean) => {
          try {
            if (ok) {
              handler.addModule(module);
            }
          } catch (error) {
            throw this._eh.report(error, 'ItemGenerator:addModule.ok', [
              index,
              module,
              ok,
            ]);
          }
        });
      });
      this.goToCell(index);
    } catch (error) {
      throw this._eh.report(error, 'ItemGenerator:addModule', [index, module]);
    }
  }

  restoreCell(index: number, executionCount: number, code: string): void {
    try {
      const cell = this._notebookContent.model.contentFactory.createCodeCell(
        {}
      );
      cell.value.text = code;
      cell.executionCount = executionCount;
      this._notebookContent.model.cells.insert(index, cell);
      this.goToCell(index);
    } catch (error) {
      throw this._eh.report(error, 'ItemGenerator:restoreCell', [
        index,
        executionCount,
        code,
      ]);
    }
  }
}

export class GroupGenerator implements IGroupGenerator {
  _nbPanel: NotebookPanel;
  _update: () => void;
  _eh: ErrorHandler;

  constructor(nbPanel: NotebookPanel, update: () => void, eh: ErrorHandler) {
    this._nbPanel = nbPanel;
    this._update = update;
    this._eh = eh;
  }

  create(
    title: string | number,
    reportType: ErrorTypeKey,
    elements: IReport[]
  ): IReport {
    try {
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
      elements.forEach((element) => {
        element.visible = !collapsed;
        element.hasParent = true;
      });

      const result: IReport = {
        text: strTitle,
        reportType: reportType,
        reportId: 'group',
        cellId: 'group',
        suggestion: null,
        reason: 'This groups other lint messages',
        visible: true,
        filteredOut: false,
        collapsed: collapsed,
        type: 'group',
        hasParent: true,
        action: null,
        restart: false,
        boundAction: () => {
          return;
        },
      };
      const onClickFactory = (line: number) => {
        return (): void => {
          try {
            elements.forEach((element) => {
              element.visible = result.collapsed;
            });
            result.collapsed = !result.collapsed;
            result.action.label = result.collapsed
              ? 'Expand category'
              : 'Collapse category';
            metavar.set(metaname, !collapsed);
            this._update();
          } catch (error) {
            throw this._eh.report(error, 'GroupGenerator:create.click', [
              title,
              reportType,
              elements,
            ]);
          }
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
        },
      };
      return result;
    } catch (error) {
      throw this._eh.report(error, 'GroupGenerator:create', [
        title,
        reportType,
        elements,
      ]);
    }
  }
}
