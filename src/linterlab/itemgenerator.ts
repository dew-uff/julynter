import { showDialog, Dialog } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import { renameDialog, IDocumentManager } from '@jupyterlab/docmanager';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';
import { IObservableJSON } from '@jupyterlab/observables';

import { IReport, IItemGenerator, IGroupGenerator, ReportType, ReportId, ErrorTypeKey } from '../linter/interfaces';
import { NotebookHandler } from './notebookhandler';
import { ERRORS } from '../linter/errors';


function isNumber(value: string | number): boolean
{
  return ((value != null) && !isNaN(Number(value.toString())));
}

function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export class ItemGenerator implements IItemGenerator {
  _docManager: IDocumentManager;
  _nbPanel: NotebookPanel;
  _notebookContent: Notebook;
  _handler: NotebookHandler;


  constructor(
    docManager: IDocumentManager,
    handler: NotebookHandler
  ){
    this._docManager = docManager;
    this._handler = handler;
    this._notebookContent = handler.nbPanel.content
  }

  create(cell_id: number | string, type: ReportType, message_id:ReportId, args:any[]): IReport {
    const message = ERRORS[message_id];
    return {
      text: message.label(...args),
      report_type: message.type,
      report_id: message_id,
      suggestion: message.suggestion,
      cell_id: cell_id,
      visible: true,
      filtered_out: false,
      type: type,
      action: message.action,
      boundAction: message.action.execute(this, ...args)
    }
  }

  renameNotebook(): void {
    renameDialog(this._docManager, this._handler.nbPanel.context!.path)
  }

  goToCell(index: number): void {
    const cell = this._notebookContent.widgets[index];
    this._notebookContent.activeCellIndex = index;
    cell.node.scrollIntoView();
  }

  addModule(index: number, module: string): void {
    const handler = this._handler;
    showDialog({
      'title': 'Add requirement',
      body: `Add "${module}" to requirements?`,
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Add' })]
    }).then(result => {
      Promise.resolve(result.button.accept).then((ok: boolean) => {
        if (ok) {
          handler.addModule(module);
        }
      })
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

  create(title: string | number, report_type: ErrorTypeKey, elements: IReport[]): IReport {
    let str_title: string;
    let metavar: IObservableJSON;
    let metaname: string;
    if (isNumber(title)){
      str_title = 'Cell ' + title;
      const cell: Cell = this._nbPanel.content.widgets[Number(title)];
      metavar = cell.model.metadata;
      metaname = 'julynter-cellgroup-collapsed';
    } else {
      str_title = capitalizeFirstLetter(String(title));
      metavar = this._nbPanel.model.metadata;
      metaname = 'julynter-cellgroup-' + str_title.replace(' ', '-').toLowerCase() + '-collapsed';
    }
    let collapsed = metavar.get(metaname) as boolean;
    collapsed = collapsed != undefined ? collapsed : false;
    elements.forEach(element => {
      element.visible = !collapsed;
      element.has_parent = true;
    });

    const result: IReport = {
      text: str_title,
      report_type: report_type,
      report_id: 'group',
      cell_id: 'group',
      suggestion: null,
      visible: true,
      filtered_out: false,
      collapsed: collapsed,
      type: 'group',
      has_parent: true,
      action: null,
      boundAction: null
    }
    const onClickFactory = (line: number) => {
      return () => {
        elements.forEach(element => {
          element.visible = result['collapsed'];
        });
        result['collapsed'] = !result['collapsed'];
        metavar.set(metaname, !collapsed);
        this._update();
      };
    };
    result.boundAction = onClickFactory(0);
    result.action = {
      label: 'Collapse/Expand category',
      title: 'Collapse or expand lints of this type',
      execute: null
    }
    return result;
  }
}
