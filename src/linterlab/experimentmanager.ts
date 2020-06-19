import { INotebookTracker, Notebook } from "@jupyterlab/notebook";
import { IReport } from "../linter/interfaces";
import { KernelMessage } from '@jupyterlab/services';
import { NotebookHandler } from './notebookhandler';
import { ICodeCellModel, CodeCell, Cell } from "@jupyterlab/cells";
import { IStream, IError, CellType, IBaseCell } from "@jupyterlab/nbformat";
import { ISessionContext, Clipboard } from "@jupyterlab/apputils";
import { JSONObject } from "@lumino/coreutils";
import { NotebookActions } from "@jupyterlab/notebook";

const JUPYTER_CELL_MIME = 'application/vnd.jupyter.cells';



export interface IExperimentConfig {
  id: string;
  lintingMessages: boolean | 'maybe';
  lintingTypes: boolean | 'maybe';
  execution: boolean | 'maybe';
  activity: boolean | 'maybe';
  code: boolean | 'maybe';
  name: boolean | 'maybe';
  enabled: boolean | 'maybe';
}

export class ExperimentManager {

  public config: IExperimentConfig;

  /*
=> What is your participant ID? Please, write <ID>
=> Can we collect linting messages that appear for you? (Y/n)
=> Can we collect the types of linting messages? (Y/n) -- It appears if you choose N in the previous question
=> Can we collect activity information (i.e., Julynter filters, notebook opening and closing)? (Y/n)

  */

  constructor() {
    this.config = {
      id: '<unset>',
      lintingMessages: 'maybe',
      lintingTypes: 'maybe',
      execution: 'maybe',
      activity: 'maybe',
      code: 'maybe',
      name: 'maybe',
      enabled: true,
    }

    this._overrideJupyterLab();
    
    
  }

  private _overrideJupyterLab() {
    let self = this;
    let oldExecute = CodeCell.execute;
    CodeCell['execute'] = (
      cell: CodeCell,
      sessionContext: ISessionContext,
      metadata?: JSONObject
    ): Promise<KernelMessage.IExecuteReplyMsg | void> => {
      
      return oldExecute(cell, sessionContext, metadata).then((msg) => {
        self.reportExecution(cell, sessionContext);
        return msg;
      });
    }

    let oldSplit = NotebookActions.splitCell;
    NotebookActions.splitCell = (notebook: Notebook) => {
      let oldIndex = notebook.activeCellIndex;
      let result = oldSplit(notebook);
      self.reportSplitCell(oldIndex, notebook);
      return result;
    }

    let oldMerge = NotebookActions.mergeCells;
    NotebookActions.mergeCells = (notebook: Notebook) => {
      const toMerge = self._getActiveIndexes(notebook);
      let result = oldMerge(notebook);
      self.reportMergeCell(toMerge, notebook);
      return result;
    }

    let oldDeleteCells = NotebookActions.deleteCells;
    NotebookActions.deleteCells = (notebook: Notebook) => {
      const toDelete = self._getActiveIndexes(notebook);
      let result = oldDeleteCells(notebook);
      self.reportDeleteCells(toDelete, notebook, 'deleteCells');
      return result;
    }

    let oldInsertAbove = NotebookActions.insertAbove;
    NotebookActions.insertAbove = (notebook: Notebook) => {
      let oldIndex = notebook.activeCellIndex;
      let result = oldInsertAbove(notebook);
      self.reportInsertAbove(oldIndex, notebook);
      return result;
    }

    let oldInsertBelow = NotebookActions.insertBelow;
    NotebookActions.insertBelow = (notebook: Notebook) => {
      let oldIndex = notebook.activeCellIndex;
      let result = oldInsertBelow(notebook);
      self.reportInsertBelow(oldIndex, notebook);
      return result;
    }

    let oldMoveDown = NotebookActions.moveDown;
    NotebookActions.moveDown = (notebook: Notebook) => {
      const toMove = self._getActiveIndexes(notebook);
      let result = oldMoveDown(notebook);
      self.reportMove(toMove, notebook, 'moveDown');
      return result;
    }

    let oldMoveUp = NotebookActions.moveUp;
    NotebookActions.moveUp = (notebook: Notebook) => {
      const toMove = self._getActiveIndexes(notebook);
      let result = oldMoveUp(notebook);
      self.reportMove(toMove, notebook, 'moveUp');
      return result;
    }

    let oldChangeCellType = NotebookActions.changeCellType;
    NotebookActions.changeCellType = (notebook: Notebook, value: CellType) => {
      let index = notebook.activeCellIndex;
      let oldValue = notebook.activeCell.model.type;
      let result = oldChangeCellType(notebook, value);
      self.reportChangeCellType(index, oldValue, value, notebook);
      return result;
    }

    let oldRun = NotebookActions.run;
    NotebookActions.run = (notebook: Notebook, sessionContext?: ISessionContext) => {
      let cell = notebook.activeCell;
      if (cell.model.type == 'markdown') {
        self.reportExecution(cell, sessionContext);
      }
      let result = oldRun(notebook, sessionContext);
      return result;
    }

    let oldRunAndAdvance = NotebookActions.runAndAdvance;
    NotebookActions.runAndAdvance = (notebook: Notebook, sessionContext?: ISessionContext) => {
      let index = notebook.activeCellIndex;
      let last = notebook.widgets.length - 1;
      let cell = notebook.activeCell;
      if (cell.model.type == 'markdown') {
        self.reportExecution(cell, sessionContext);
      }
      let result = oldRunAndAdvance(notebook, sessionContext);
      if (index == last) {
        self.reportInsertAfterRun(index, notebook);
      }
      return result;
    }

    let oldRunAndInsert = NotebookActions.runAndInsert;
    NotebookActions.runAndInsert = (notebook: Notebook, sessionContext?: ISessionContext) => {
      let index = notebook.activeCellIndex;
      let cell = notebook.activeCell;
      if (cell.model.type == 'markdown') {
        self.reportExecution(cell, sessionContext);
      }
      let result = oldRunAndInsert(notebook, sessionContext);
      self.reportInsertAfterRun(index, notebook);
      return result;
    }

    let oldCut = NotebookActions.cut;
    NotebookActions.cut = (notebook: Notebook) => {
      const toDelete = self._getActiveIndexes(notebook);
      let result = oldCut(notebook);
      self.reportDeleteCells(toDelete, notebook, 'cut');
      return result;
    }

    let oldPaste = NotebookActions.paste;
    NotebookActions.paste = (notebook: Notebook, mode: 'below' | 'above' | 'replace' = 'below') => {
      if (!notebook.model || !notebook.activeCell) {
        return oldPaste(notebook, mode);
      }
      const clipboard = Clipboard.getInstance();
      if (!clipboard.hasData(JUPYTER_CELL_MIME)) {
        return oldPaste(notebook, mode);
      }
      const toInsert = clipboard.getData(JUPYTER_CELL_MIME) as IBaseCell[];
      let toDelete: number[] = [];
      if (mode == 'replace') {
        toDelete = self._getActiveIndexes(notebook);
      }
      let index = notebook.activeCellIndex;
      let result = oldPaste(notebook, mode);
      self.reportPaste(index, toInsert, toDelete, mode, notebook);
      return result;
    }

    let oldUndo = NotebookActions.undo;
    NotebookActions.undo = (notebook: Notebook) => {
      let result = oldUndo(notebook);
      self.reportAction(notebook, 'undo');
      return result;
    }

    let oldRedo = NotebookActions.redo;
    NotebookActions.redo = (notebook: Notebook) => {
      let result = oldRedo(notebook);
      self.reportAction(notebook, 'redo');
      return result;
    }

    let oldRunAll = NotebookActions.runAll;
    NotebookActions.runAll = (notebook: Notebook, sessionContext?: ISessionContext) => {
      self.reportAction(notebook, 'runAll');
      return oldRunAll(notebook, sessionContext);
    }


    let oldRunAllAbove = NotebookActions.runAllAbove;
    NotebookActions.runAllAbove = (notebook: Notebook, sessionContext?: ISessionContext) => {
      self.reportAction(notebook, 'runAllAbove');
      return oldRunAllAbove(notebook, sessionContext);
    }

    let oldRunAllBelow = NotebookActions.runAllBelow;
    NotebookActions.runAllBelow = (notebook: Notebook, sessionContext?: ISessionContext) => {
      self.reportAction(notebook, 'runAllBelow');
      return oldRunAllBelow(notebook, sessionContext);
    }

    let oldClearOutputs = NotebookActions.clearOutputs;
    NotebookActions.clearOutputs = (notebook: Notebook) => {
      const toDelete = self._getActiveIndexes(notebook);
      let result = oldClearOutputs(notebook);
      self.reportDeleteCells(toDelete, notebook, 'clearOutputs');
      return result;
    }

    let oldClearAllOutputs = NotebookActions.clearAllOutputs;
    NotebookActions.clearAllOutputs = (notebook: Notebook) => {
      self.reportAction(notebook, 'clearAllOutputs');
      return oldClearAllOutputs(notebook);
    }

  }

  
  /* Start Actions */

  reportSplitCell(oldIndex:number, notebook: Notebook) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    let codes = null as any[] | null;
    let newIndex = notebook.activeCellIndex;

    if (this.config.code) {
      codes = [];
      for (let i = oldIndex; i <= newIndex; i++) {
        codes.push(notebook.widgets[i].model.value.text);
      }
    }

    this._send('Action', {
      'operation': 'splitCell',
      'notebook-name': this._notebook_name(notebook.title.label),
      'notebook-id': notebook.parent.id,
      'old-index': oldIndex,
      'new-index': newIndex,
      'codes': codes
    });
  }

  reportMergeCell(toMerge:number[], notebook: Notebook) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    let code = null as string;
    let newIndex = notebook.activeCellIndex;

    if (this.config.code) {
      code = notebook.widgets[newIndex].model.value.text;
    }

    this._send('Action', {
      'operation': 'mergeCells',
      'notebook-name': this._notebook_name(notebook.title.label),
      'notebook-id': notebook.parent.id,
      'merged-indexes': toMerge,
      'new-index': newIndex,
      'code': code
    });
  }

  reportDeleteCells(toDelete:number[], notebook: Notebook, operation: string) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    this._send('Action', {
      'operation': operation,
      'notebook-name': this._notebook_name(notebook.title.label),
      'notebook-id': notebook.parent.id,
      'deleted-indexes': toDelete,
    });
  } 

  reportInsertAbove(oldIndex:number, notebook: Notebook) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    this._send('Action', {
      'operation': 'insertAbove',
      'notebook-name': this._notebook_name(notebook.title.label),
      'notebook-id': notebook.parent.id,
      'index': oldIndex,
    });
  }

  reportInsertBelow(oldIndex:number, notebook: Notebook) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    this._send('Action', {
      'operation': 'insertBelow',
      'notebook-name': this._notebook_name(notebook.title.label),
      'notebook-id': notebook.parent.id,
      'index': oldIndex,
    });
  }

  reportMove(toMove:number[], notebook: Notebook, operation: string) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    this._send('Action', {
      'operation': operation,
      'notebook-name': this._notebook_name(notebook.title.label),
      'notebook-id': notebook.parent.id,
      'moved-indexes': toMove,
    });
  }

  reportChangeCellType(index:number, oldValue: CellType, newValue: CellType, notebook: Notebook) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    this._send('Action', {
      'operation': 'changeCellType',
      'notebook-name': this._notebook_name(notebook.title.label),
      'notebook-id': notebook.parent.id,
      'index': index,
      'old-type': oldValue,
      'new-type': newValue
    });
  }

  reportInsertAfterRun(index:number, notebook: Notebook) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    this._send('Action', {
      'operation': 'newCellAfterRun',
      'notebook-name': this._notebook_name(notebook.title.label),
      'notebook-id': notebook.parent.id,
      'index': index,
    });
  }

  reportPaste(index: number, toInsert:IBaseCell[], toDelete:number[], mode:string, notebook: Notebook) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    let codes = null as string[];
    if (this.config.code) {
      codes = [];
      for (let i = 0; i < toInsert.length; i++) {
        if (Array.isArray(toInsert[i].source)) {
          codes.push((toInsert[i].source as string[]).join('\n'));
        } else {
          codes.push(toInsert[i].source as string);
        }
      }
    }

    this._send('Action', {
      'operation': 'paste',
      'notebook-name': this._notebook_name(notebook.title.label),
      'notebook-id': notebook.parent.id,
      'index': index,
      'mode': mode,
      'paste-count': toInsert.length,
      'deleted-indexes': toDelete,
      'codes': codes
    });
  }

  reportAction(notebook: Notebook, operation: string) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    this._send('Action', {
      'operation': operation,
      'notebook-name': this._notebook_name(notebook.title.label),
      'notebook-id': notebook.parent.id,
    });
  }

  /* End Actions */
  
  /* Start Activities */

  reportOpenNotebook(handler: NotebookHandler) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    this._send('Activity', {
      'operation': 'open',
      'notebook-name': this._notebook_name(handler.name),
      'notebook-id': handler.id,
      'options': handler.options.checks
    });
  } 

  reportCloseNotebook(handler: NotebookHandler) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    this._send('Activity', {
      'operation': 'close',
      'notebook-name': this._notebook_name(handler.name),
      'notebook-id': handler.id
    });
  } 

  reportKernelActivity(handler: NotebookHandler, operation: string, displayName: string) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    this._send('Activity', {
      'operation': operation,
      'notebook-name': this._notebook_name(handler.name),
      'notebook-id': handler.id,
      'kernel-name': displayName
    });
  }

  reportContextSwitch(handler: NotebookHandler, operation: string) {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    this._send('Activity', {
      'operation': operation,
      'notebook-name': this._notebook_name(handler.name),
      'notebook-id': handler.id
    });
  }

  /* End Activities */

  /* Start code */

  reportNotebookCode(handler: NotebookHandler) {
    if (!this.config.enabled || !(this.config.code || this.config.execution)) {
      return;
    }
    let cells: any[] = [];

    let nbcells = handler.nbPanel.content.widgets;
    for (let i = 0; i < nbcells.length; i++) {
      let cell = nbcells[i];
      let cellResult = this._collectCell(cell);
      cells.push(cellResult);
    }

    this._send('Code', {
      'operation': 'code',
      'notebook-name': this._notebook_name(handler.name),
      'notebook-id': handler.id,
      'cells': cells
    });
  }

  reportExecution(cell: Cell, sessionContext: ISessionContext) {
    if (!this.config.enabled || !(this.config.code || this.config.execution)) {
      return;
    }
    this._send("Execution", {
      'operation': 'execute',
      'notebook-name': this._notebook_name(sessionContext.path),
      'notebook-id': cell.parent.parent.id,
      'cell-index': (cell.parent as Notebook).widgets.indexOf(cell),
      'cell': this._collectCell(cell) 
    });
  }

  /* End code */

  /* Start lint */

  reportLinting(tracker:INotebookTracker, reports:IReport[]) {
    if (!this.config.enabled) {
      return;
    }
    console.log("Julynter: lint notebook", tracker.currentWidget.id)
    // ToDo. Check lintingMessages and lintingTypes

  }

  /* End lint */

  private _collectCell(cell: Cell){
    let model = cell.model;
    let cellResult = {
      'type': model.type,
      'code': this.config.code? model.value.text : null,
      'length': model.value.text.length,
      'empty': model.value.text.trim().length == 0,
      'executionCount': null as number | null,
      'outputs': null as any | null
    };
    if (this.config.execution && (model.type === 'code')) {
      let outputs: any[] = [];
      let codeModel = (model as ICodeCellModel);
      let codeOutputs = codeModel.outputs.toJSON();
      for (let j = 0; j < codeOutputs.length; j++) {
        let codeOutput = codeOutputs[j];
        let output = {
          'type': codeOutput.output_type,
          'mime': [] as string[],
        }
        if (output.type == 'stream') {
          output['mime'] = [(codeOutput as IStream).name];
        } else if (output.type == 'error') {
          output['mime'] = [(codeOutput as IError).ename];
        } else if ({}.hasOwnProperty.call(codeOutput, 'data')) {
          output['mime'] = Object.keys((codeOutput as any).data);
        }
        
        outputs.push(output);
      }
      cellResult.executionCount = codeModel.executionCount;
      cellResult.outputs = outputs;
    }
    return cellResult;
  }

  private _getActiveIndexes(notebook: Notebook) {
    const result: number[] = [];
    notebook.widgets.forEach((child, index) => {
      if (notebook.isSelectedOrActive(child)) {
        result.push(index);
      }
    });
    return result;
  }

  private _notebook_name(name: string) {
    return this.config.name? name : '<redacted>'
  }

  private _send(header: string, data: any){
    data['date'] = new Date();
    console.log("Julynter:", header);
    for (let key in data) {
      let value = data[key];
      console.log("  " + key + ":", value);
    }
  }

}