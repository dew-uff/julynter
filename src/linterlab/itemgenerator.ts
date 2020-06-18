import { showDialog, Dialog } from '@jupyterlab/apputils';
import { Cell } from '@jupyterlab/cells';
import { renameDialog, IDocumentManager } from '@jupyterlab/docmanager';
import { INotebookTracker, Notebook } from '@jupyterlab/notebook';
import { IObservableJSON } from '@jupyterlab/observables';

import { IReport, IErrorMessage, IItemGenerator, IGroupGenerator, ReportType } from '../linter/interfaces';
import { JulynterNotebook } from './julynternotebook';


function isNumber(value: string | number): boolean
{
  return ((value != null) && !isNaN(Number(value.toString())));
}

function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export class ItemGenerator implements IItemGenerator {
  _docManager: IDocumentManager;
  _tracker: INotebookTracker;
  _notebookContent: Notebook;
  _notebook: JulynterNotebook;


  constructor(
    docManager: IDocumentManager,
    tracker: INotebookTracker,
    notebook: JulynterNotebook
  ){
    this._docManager = docManager;
    this._tracker = tracker;
    this._notebook = notebook;
    this._notebookContent = tracker.currentWidget.content
  }

  create(cell_id: number | string, type: ReportType, message:IErrorMessage, args:any[]): IReport {
    return {
      text: message.label(...args),
      report_type: message.type,
      cell_id: cell_id,
      visible: true,
      filtered_out: false,
      type: type,
      onClick: message.action(this, ...args)
    }
  }

  rename_notebook(): void {
    renameDialog(this._docManager, this._tracker.currentWidget.context!.path)
  }

  go_to_cell(index: number): void {
    const cell = this._notebookContent.widgets[index];
    this._notebookContent.activeCellIndex = index;
    cell.node.scrollIntoView();
  }

  add_module(index: number, module: string): void {
    const handler = this._notebook.handler;
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
    this.go_to_cell(index);
  }

  restore_cell(index: number, executionCount: number, code: string): void {
    let cell = this._notebookContent.model.contentFactory.createCodeCell({});
    cell.value.text = code;
    cell.executionCount = executionCount;
    this._notebookContent.model.cells.insert(index, cell);
    this.go_to_cell(index);
  }
}

export class GroupGenerator implements IGroupGenerator {

  _tracker: INotebookTracker;
  _update: () => void;

  constructor(tracker: INotebookTracker, update: () => void) {
    this._tracker = tracker;
    this._update = update;
  }

  create(title: string | number, report_type: string, elements: IReport[]): IReport {
    let str_title: string;
    let metavar: IObservableJSON;
    let metaname: string;
    if (isNumber(title)){
      str_title = "Cell " + title;
      let cell: Cell = this._tracker.currentWidget.content.widgets[Number(title)];
      metavar = cell.model.metadata;
      metaname = 'julynter-cellgroup-collapsed';
    } else {
      str_title = capitalizeFirstLetter(String(title));
      metavar = this._tracker.currentWidget.model.metadata;
      metaname = 'julynter-cellgroup-' + str_title.replace(' ', '-').toLowerCase() + '-collapsed';
    }
    let collapsed = metavar.get(metaname) as boolean;
    collapsed = collapsed != undefined ? collapsed : false;
    elements.forEach(element => {
      element.visible = !collapsed;
      element.has_parent = true;
    });

    let result: IReport = {
      text: str_title,
      report_type: report_type,
      cell_id: "group",
      visible: true,
      filtered_out: false,
      collapsed: collapsed,
      type: "group",
      has_parent: true,
      onClick: null
    }
    const onClickFactory = (line: number) => {
      return () => {
        elements.forEach(element => {
          element.visible = result["collapsed"];
        });
        result["collapsed"] = !result["collapsed"];
        metavar.set(metaname, !collapsed);
        this._update();
      };
    };
    result["onClick"] = onClickFactory(0);
    return result;
  }
}
