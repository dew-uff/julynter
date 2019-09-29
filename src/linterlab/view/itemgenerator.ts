import { showDialog, Dialog } from '@jupyterlab/apputils';

import { Cell } from '@jupyterlab/cells';

import { renameDialog, IDocumentManager } from '@jupyterlab/docmanager';

import { INotebookTracker, Notebook } from '@jupyterlab/notebook';

import { IObservableJSON } from '@jupyterlab/observables';

import { IReport, IErrorMessage, IItemGenerator, IGroupGenerator, ReportType } from '../../linter/interfaces';

import { Julynter } from '../julynter';


function isNumber(value: string | number): boolean
{
  return ((value != null) && !isNaN(Number(value.toString())));
}

export class ItemGenerator implements IItemGenerator {
  _docManager: IDocumentManager;
  _tracker: INotebookTracker;
  _notebook: Notebook;
  _julynter: Julynter;


  constructor(julynter: Julynter){
    this._docManager = julynter.docManager;
    this._tracker = julynter.tracker;
    this._notebook = julynter.tracker.currentWidget.content
    this._julynter = julynter;
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

  rename_notebook() {
    renameDialog(this._docManager, this._tracker.currentWidget.context!.path)
  }

  go_to_cell(index: number) {
    const cell = this._notebook.widgets[index];
    this._notebook.activeCellIndex = index;
    cell.node.scrollIntoView();
  }

  add_module(index: number, module: string) {
    const handler = this._julynter.handler;
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
}

export class GroupGenerator implements IGroupGenerator {

  _julynter: Julynter;
  _tracker: INotebookTracker;

  constructor(julynter: Julynter) {
    this._tracker = julynter.tracker;
    this._julynter = julynter;
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
      str_title = String(title);
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
        this._julynter.update();
      };
    };
    result["onClick"] = onClickFactory(0);
    return result;
  }
}