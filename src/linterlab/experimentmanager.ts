import { JSONObject } from '@lumino/coreutils';
import { ISessionContext, Clipboard } from '@jupyterlab/apputils';
import { ICodeCellModel, CodeCell, Cell } from '@jupyterlab/cells';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IStream, IError, CellType, IBaseCell } from '@jupyterlab/nbformat';
import { Notebook, NotebookPanel, NotebookActions } from '@jupyterlab/notebook';
import { KernelMessage, Contents } from '@jupyterlab/services';
import { IReport, IJulynterLintOptions, ILintingResult } from '../linter/interfaces';
import { requestAPI } from '../server';
import { NotebookHandler } from './notebookhandler';

const JUPYTER_CELL_MIME = 'application/vnd.jupyter.cells';

export const IExperimentConfigAttributes = [
  'lintingMessages',
  'lintingTypes',
  'execution',
  'activity',
  'code',
  'name',
  'enabled',
] as const;
export type IExperimentConfigAttribute = typeof IExperimentConfigAttributes[number];

export type IExperimentConfig = {
  [id in IExperimentConfigAttribute]: boolean | 'maybe';
};

type headers = 'Action' | 'Activity' | 'Code' | 'Execution' | 'Lint';

interface IBase {
  header: headers;
  operation: string;
  date?: Date;
}

interface INotebookBase extends IBase {
  notebookName: string;
  notebookId: string;
}

interface IInfoNotebook extends INotebookBase {
  info: string;
}

interface IParamNotebook extends IInfoNotebook {
  param: string;
}

interface IOnIndexesBase extends INotebookBase {
  indexes: number[];
}

interface IRenameAction extends IBase {
  oldName: string;
  newName: string;
}

interface ICodesAction extends IOnIndexesBase {
  newIndexes: number[];
  codes: string[];
}

interface IChangeTypeAction extends IOnIndexesBase {
  oldType: string;
  newType: string;
}

interface IPasteAction extends ICodesAction, IInfoNotebook {
  pasteCount: number;
}

interface IConfigActivity extends INotebookBase {
  options: IJulynterLintOptions;
}

interface INotebookCells extends INotebookBase {
  cells: ICellResult[];
}

interface INotebookExecution extends INotebookCells, IOnIndexesBase {}

interface INotebookLint extends INotebookBase {
  newReports: IReportResult[];
  removedReports: IReportResult[];
}

interface INotebookLintSubject extends INotebookBase {
  report: IReportResult;
  source: string;
}

interface INotebookLintFeedback extends INotebookLintSubject {
  message: string;
}

type AnyReport =
  | INotebookLintFeedback
  | INotebookLintSubject
  | INotebookLint
  | INotebookExecution
  | INotebookCells
  | IConfigActivity
  | IPasteAction
  | IChangeTypeAction
  | ICodesAction
  | IRenameAction
  | IOnIndexesBase
  | IParamNotebook
  | IInfoNotebook
  | INotebookBase
  | IBase;

interface ICellOutput {
  type: string;
  mime: string[];
}

interface ICellResult {
  type: string;
  code: string;
  length: number;
  empty: boolean;
  executionCount: number;
  outputs: ICellOutput[];
}

interface IReportResult {
  text?: string;
  reportType: string;
  reportId: string;
  suggestion?: string;
  cellId: string;
  visible: boolean;
  filteredOut: boolean;
  type: string;
}

export class ExperimentManager {
  public config: IExperimentConfig;
  public lastLint: {
    [id: string]: IReport[];
  };

  constructor(docmanager: IDocumentManager) {
    this.config = {
      lintingMessages: 'maybe',
      lintingTypes: 'maybe',
      execution: 'maybe',
      activity: 'maybe',
      code: 'maybe',
      name: 'maybe',
      enabled: true,
    };
    this.lastLint = {};
    this._overrideJupyterLab(docmanager);
  }

  private _overrideJupyterLab(docmanager: IDocumentManager): void {
    const oldRename = docmanager.rename.bind(docmanager);
    docmanager.rename = (
      oldPath: string,
      newPath: string
    ): Promise<Contents.IModel> => {
      return oldRename(oldPath, newPath).then((result) => {
        this.reportRename(oldPath, newPath);
        return result;
      });
    };

    const oldExecute = CodeCell.execute;
    CodeCell['execute'] = (
      cell: CodeCell,
      sessionContext: ISessionContext,
      metadata?: JSONObject
    ): Promise<KernelMessage.IExecuteReplyMsg | void> => {
      return oldExecute(cell, sessionContext, metadata).then((msg) => {
        this.reportExecution(cell, sessionContext);
        return msg;
      });
    };

    const oldSplit = NotebookActions.splitCell;
    NotebookActions.splitCell = (notebook: Notebook): void => {
      const oldIndex = notebook.activeCellIndex;
      const result = oldSplit(notebook);
      this.reportSplitCell(oldIndex, notebook);
      return result;
    };

    const oldMerge = NotebookActions.mergeCells;
    NotebookActions.mergeCells = (notebook: Notebook): void => {
      const toMerge = this._getActiveIndexes(notebook);
      const result = oldMerge(notebook);
      this.reportMergeCell(toMerge, notebook);
      return result;
    };

    const oldDeleteCells = NotebookActions.deleteCells;
    NotebookActions.deleteCells = (notebook: Notebook): void => {
      const toDelete = this._getActiveIndexes(notebook);
      const result = oldDeleteCells(notebook);
      this.reportIndexesAction(toDelete, notebook, 'deleteCells');
      return result;
    };

    const oldInsertAbove = NotebookActions.insertAbove;
    NotebookActions.insertAbove = (notebook: Notebook): void => {
      const oldIndex = notebook.activeCellIndex;
      const result = oldInsertAbove(notebook);
      this.reportIndexesAction([oldIndex], notebook, 'insertAbove');
      return result;
    };

    const oldInsertBelow = NotebookActions.insertBelow;
    NotebookActions.insertBelow = (notebook: Notebook): void => {
      const oldIndex = notebook.activeCellIndex;
      const result = oldInsertBelow(notebook);
      this.reportIndexesAction([oldIndex], notebook, 'insertBelow');
      return result;
    };

    const oldMoveDown = NotebookActions.moveDown;
    NotebookActions.moveDown = (notebook: Notebook): void => {
      const toMove = this._getActiveIndexes(notebook);
      const result = oldMoveDown(notebook);
      this.reportIndexesAction(toMove, notebook, 'moveDown');
      return result;
    };

    const oldMoveUp = NotebookActions.moveUp;
    NotebookActions.moveUp = (notebook: Notebook): void => {
      const toMove = this._getActiveIndexes(notebook);
      const result = oldMoveUp(notebook);
      this.reportIndexesAction(toMove, notebook, 'moveUp');
      return result;
    };

    const oldChangeCellType = NotebookActions.changeCellType;
    NotebookActions.changeCellType = (
      notebook: Notebook,
      value: CellType
    ): void => {
      const index = notebook.activeCellIndex;
      const oldValue = notebook.activeCell.model.type;
      const result = oldChangeCellType(notebook, value);
      this.reportChangeCellType(index, oldValue, value, notebook);
      return result;
    };

    const oldRun = NotebookActions.run;
    NotebookActions.run = (
      notebook: Notebook,
      sessionContext?: ISessionContext
    ): Promise<boolean> => {
      const cell = notebook.activeCell;
      if (cell.model.type === 'markdown') {
        this.reportExecution(cell, sessionContext);
      }
      const result = oldRun(notebook, sessionContext);
      return result;
    };

    const oldRunAndAdvance = NotebookActions.runAndAdvance;
    NotebookActions.runAndAdvance = (
      notebook: Notebook,
      sessionContext?: ISessionContext
    ): Promise<boolean> => {
      const index = notebook.activeCellIndex;
      const last = notebook.widgets.length - 1;
      const cell = notebook.activeCell;
      if (cell.model.type === 'markdown') {
        this.reportExecution(cell, sessionContext);
      }
      const result = oldRunAndAdvance(notebook, sessionContext);
      if (index === last) {
        this.reportIndexesAction([index], notebook, 'newCellAfterRun');
      }
      return result;
    };

    const oldRunAndInsert = NotebookActions.runAndInsert;
    NotebookActions.runAndInsert = (
      notebook: Notebook,
      sessionContext?: ISessionContext
    ): Promise<boolean> => {
      const index = notebook.activeCellIndex;
      const cell = notebook.activeCell;
      if (cell.model.type === 'markdown') {
        this.reportExecution(cell, sessionContext);
      }
      const result = oldRunAndInsert(notebook, sessionContext);
      this.reportIndexesAction([index], notebook, 'newCellAfterRun');
      return result;
    };

    const oldCut = NotebookActions.cut;
    NotebookActions.cut = (notebook: Notebook): void => {
      const toDelete = this._getActiveIndexes(notebook);
      const result = oldCut(notebook);
      this.reportIndexesAction(toDelete, notebook, 'cut');
      return result;
    };

    const oldPaste = NotebookActions.paste;
    NotebookActions.paste = (
      notebook: Notebook,
      mode: 'below' | 'above' | 'replace' = 'below'
    ): void => {
      if (!notebook.model || !notebook.activeCell) {
        return oldPaste(notebook, mode);
      }
      const clipboard = Clipboard.getInstance();
      if (!clipboard.hasData(JUPYTER_CELL_MIME)) {
        return oldPaste(notebook, mode);
      }
      const toInsert = clipboard.getData(JUPYTER_CELL_MIME) as IBaseCell[];
      let toDelete: number[] = [];
      if (mode === 'replace') {
        toDelete = this._getActiveIndexes(notebook);
      }
      const index = notebook.activeCellIndex;
      const result = oldPaste(notebook, mode);
      this.reportPaste(index, toInsert, toDelete, mode, notebook);
      return result;
    };

    const oldUndo = NotebookActions.undo;
    NotebookActions.undo = (notebook: Notebook): void => {
      const result = oldUndo(notebook);
      this.reportAction(notebook, 'undo');
      return result;
    };

    const oldRedo = NotebookActions.redo;
    NotebookActions.redo = (notebook: Notebook): void => {
      const result = oldRedo(notebook);
      this.reportAction(notebook, 'redo');
      return result;
    };

    const oldRunAll = NotebookActions.runAll;
    NotebookActions.runAll = (
      notebook: Notebook,
      sessionContext?: ISessionContext
    ): Promise<boolean> => {
      this.reportAction(notebook, 'runAll');
      return oldRunAll(notebook, sessionContext);
    };

    const oldRunAllAbove = NotebookActions.runAllAbove;
    NotebookActions.runAllAbove = (
      notebook: Notebook,
      sessionContext?: ISessionContext
    ): Promise<boolean> => {
      this.reportAction(notebook, 'runAllAbove');
      return oldRunAllAbove(notebook, sessionContext);
    };

    const oldRunAllBelow = NotebookActions.runAllBelow;
    NotebookActions.runAllBelow = (
      notebook: Notebook,
      sessionContext?: ISessionContext
    ): Promise<boolean> => {
      this.reportAction(notebook, 'runAllBelow');
      return oldRunAllBelow(notebook, sessionContext);
    };

    const oldClearOutputs = NotebookActions.clearOutputs;
    NotebookActions.clearOutputs = (notebook: Notebook): void => {
      const toDelete = this._getActiveIndexes(notebook);
      const result = oldClearOutputs(notebook);
      this.reportIndexesAction(toDelete, notebook, 'clearOutputs');
      return result;
    };

    const oldClearAllOutputs = NotebookActions.clearAllOutputs;
    NotebookActions.clearAllOutputs = (notebook: Notebook): void => {
      this.reportAction(notebook, 'clearAllOutputs');
      return oldClearAllOutputs(notebook);
    };
  }

  /* Start Actions */

  reportRename(oldName: string, newName: string): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    const send: IRenameAction = {
      header: 'Action',
      operation: 'rename',
      oldName: oldName,
      newName: newName,
    };
    this._send(send);
  }

  reportSplitCell(oldIndex: number, notebook: Notebook): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    const newIndex = notebook.activeCellIndex;
    let codes = null as string[] | null;

    if (this.config.code) {
      codes = [];
      for (let i = oldIndex; i <= newIndex; i++) {
        codes.push(notebook.widgets[i].model.value.text);
      }
    }

    const send: ICodesAction = {
      header: 'Action',
      operation: 'splitCell',
      notebookName: this._notebookName(notebook.title.label),
      notebookId: notebook.parent.id,
      indexes: [oldIndex],
      newIndexes: [newIndex],
      codes: codes,
    };
    this._send(send);
  }

  reportMergeCell(toMerge: number[], notebook: Notebook): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    const newIndex = notebook.activeCellIndex;
    let code = null as string;

    if (this.config.code) {
      code = notebook.widgets[newIndex].model.value.text;
    }

    const send: ICodesAction = {
      header: 'Action',
      operation: 'mergeCells',
      notebookName: this._notebookName(notebook.title.label),
      notebookId: notebook.parent.id,
      indexes: toMerge,
      newIndexes: [newIndex],
      codes: [code],
    };
    this._send(send);
  }

  reportIndexesAction(
    indexes: number[],
    notebook: Notebook,
    operation: string
  ): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    const send: IOnIndexesBase = {
      header: 'Action',
      operation: operation,
      notebookName: this._notebookName(notebook.title.label),
      notebookId: notebook.parent.id,
      indexes: indexes,
    };
    this._send(send);
  }

  reportChangeCellType(
    index: number,
    oldValue: CellType,
    newValue: CellType,
    notebook: Notebook
  ): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    const send: IChangeTypeAction = {
      header: 'Action',
      operation: 'changeCellType',
      notebookName: this._notebookName(notebook.title.label),
      notebookId: notebook.parent.id,
      indexes: [index],
      oldType: oldValue,
      newType: newValue,
    };
    this._send(send);
  }

  reportPaste(
    index: number,
    toInsert: IBaseCell[],
    toDelete: number[],
    mode: string,
    notebook: Notebook
  ): void {
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

    const send: IPasteAction = {
      header: 'Action',
      operation: 'paste',
      notebookName: this._notebookName(notebook.title.label),
      notebookId: notebook.parent.id,
      indexes: toDelete,
      newIndexes: [index],
      codes: codes,
      info: mode,
      pasteCount: toInsert.length,
    };
    this._send(send);
  }

  reportAction(notebook: Notebook, operation: string): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    const send: INotebookBase = {
      header: 'Action',
      operation: operation,
      notebookName: this._notebookName(notebook.title.label),
      notebookId: notebook.parent.id,
    };
    this._send(send);
  }

  /* End Actions */

  /* Start Activities */

  reportLoadConfig(nbPanel: NotebookPanel, checks: IJulynterLintOptions): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    const send: IConfigActivity = {
      header: 'Activity',
      operation: 'loadConfig',
      notebookName: this._notebookName(nbPanel.title.label),
      notebookId: nbPanel.id,
      options: checks,
    };
    this._send(send);
  }

  reportSaveConfig(nbPanel: NotebookPanel, checks: IJulynterLintOptions): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    const send: IConfigActivity = {
      header: 'Activity',
      operation: 'saveConfig',
      notebookName: this._notebookName(nbPanel.title.label),
      notebookId: nbPanel.id,
      options: checks,
    };
    this._send(send);
  }

  reportCloseNotebook(handler: NotebookHandler): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    if ({}.hasOwnProperty.call(this.lastLint, handler.id)) {
      delete this.lastLint[handler.id];
    }

    const send: INotebookBase = {
      header: 'Activity',
      operation: 'close',
      notebookName: this._notebookName(handler.name),
      notebookId: handler.id,
    };
    this._send(send);
  }

  reportKernelActivity(
    handler: NotebookHandler,
    operation: string,
    kernelName: string
  ): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    const send: IInfoNotebook = {
      header: 'Activity',
      operation: operation,
      notebookName: this._notebookName(handler.name),
      notebookId: handler.id,
      info: kernelName,
    };
    this._send(send);
  }

  reportActivity(handler: NotebookHandler, operation: string): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    const send: INotebookBase = {
      header: 'Activity',
      operation: operation,
      notebookName: this._notebookName(handler.name),
      notebookId: handler.id,
    };
    this._send(send);
  }

  reportVisibility(handler: NotebookHandler, visible: boolean): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    if (!handler) {
      return;
    }

    const send: IInfoNotebook = {
      header: 'Activity',
      operation: 'visibility',
      notebookName: this._notebookName(handler.name),
      notebookId: handler.id,
      info: visible.toString(),
    };
    this._send(send);
  }

  reportSetConfig(
    nbPanel: NotebookPanel,
    config: string,
    value: boolean | string
  ): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    const send: IParamNotebook = {
      header: 'Activity',
      operation: 'setConfig',
      notebookName: this._notebookName(nbPanel.title.label),
      notebookId: nbPanel.id,
      param: config,
      info: value.toString(),
    };
    this._send(send);
  }

  reportNotebookKernel(
    handler: NotebookHandler,
    kernel: string,
    language: string
  ): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }

    const send: IParamNotebook = {
      header: 'Activity',
      operation: 'loadKernel',
      notebookName: this._notebookName(handler.name),
      notebookId: handler.id,
      param: language,
      info: kernel,
    };
    this._send(send);
  }

  /* End Activities */

  /* Start code */

  reportNotebookCode(handler: NotebookHandler): void {
    if (!this.config.enabled || !(this.config.code || this.config.execution)) {
      return;
    }
    const cells: any[] = [];

    const nbcells = handler.nbPanel.content.widgets;
    for (let i = 0; i < nbcells.length; i++) {
      const cell = nbcells[i];
      const cellResult = this._collectCell(cell);
      cells.push(cellResult);
    }

    const send: INotebookCells = {
      header: 'Code',
      operation: 'code',
      notebookName: this._notebookName(handler.name),
      notebookId: handler.id,
      cells: cells,
    };
    this._send(send);
  }

  reportExecution(cell: Cell, sessionContext: ISessionContext): void {
    if (!this.config.enabled || !(this.config.code || this.config.execution)) {
      return;
    }
    const send: INotebookExecution = {
      header: 'Execution',
      operation: 'execute',
      notebookName: this._notebookName(sessionContext.path),
      notebookId: cell.parent.parent.id,
      cells: [this._collectCell(cell)],
      indexes: [(cell.parent as Notebook).widgets.indexOf(cell)],
    };
    this._send(send);
  }

  /* End code */

  /* Start lint */

  reportLinting(handler: NotebookHandler, result: ILintingResult): void {
    if (!this.config.enabled) {
      return;
    }
    const reports = result.visible;

    if (!{}.hasOwnProperty.call(this.lastLint, handler.id)) {
      this.lastLint[handler.id] = [];
    }

    const newReports = reports.filter((report) => {
      if (report.type === 'group') {
        return false;
      }
      const same = this.lastLint[handler.id].find((other) => {
        return (
          other.text === report.text &&
          other.reportType === report.reportType &&
          other.cellId === report.cellId &&
          other.reportId === report.reportId
        );
      });
      if (same) {
        report.feedback = same.feedback;
        same.kept = true;
        return false;
      } else {
        report.feedback = 1;
      }
      return true;
    });

    const removedReports = this.lastLint[handler.id].filter((report) => {
      if (report.type === 'group') {
        return false;
      }
      if (report.kept) {
        return false;
      }
      return true;
    });

    this.lastLint[handler.id] = reports;

    if (!(this.config.lintingMessages || this.config.lintingTypes)) {
      return;
    }
    if (newReports.length === 0 && removedReports.length === 0) {
      return;
    }
    const mapfn = this.config.lintingMessages
      ? this.selectMessages.bind(this)
      : this.selectTypes.bind(this);
    const send: INotebookLint = {
      header: 'Lint',
      operation: 'lint',
      notebookName: this._notebookName(handler.name),
      notebookId: handler.id,
      newReports: newReports.map(mapfn),
      removedReports: removedReports.map(mapfn),
    };
    this._send(send);
  }

  reportFeedback(
    handler: NotebookHandler,
    report: IReport,
    message: string,
    source: string
  ): void {
    if (!this.config.enabled) {
      return;
    }
    const mapfn = this.config.lintingMessages
      ? this.selectMessages.bind(this)
      : this.selectTypes.bind(this);
    const newReport = mapfn(report);

    const send: INotebookLintFeedback = {
      header: 'Lint',
      operation: 'feedback',
      notebookName: this._notebookName(handler.name),
      notebookId: handler.id,
      report: newReport,
      message: message,
      source: source
    };
    this._send(send);
  }

  reportLintClick(handler: NotebookHandler, report: IReport, source: string): void {
    if (!this.config.enabled || !this.config.activity) {
      return;
    }
    if (!this.config.lintingMessages && !this.config.lintingTypes) {
      return;
    }
    const mapfn = this.config.lintingMessages
      ? this.selectMessages.bind(this)
      : this.selectTypes.bind(this);
    const newReport = mapfn(report);
    const send: INotebookLintSubject = {
      header: 'Lint',
      operation: 'lintclick',
      notebookName: this._notebookName(handler.name),
      notebookId: handler.id,
      report: newReport,
      source: source,
    };
    this._send(send);
  }

  private selectMessages(report: IReport): IReportResult {
    return {
      text: report.text,
      reportType: report.reportType,
      reportId: report.reportId,
      suggestion: report.suggestion,
      cellId: report.cellId.toString(),
      visible: report.visible,
      filteredOut: report.filteredOut,
      type: report.type,
    };
  }

  private selectTypes(report: IReport): IReportResult {
    return {
      reportType: report.reportType,
      reportId: report.reportId,
      cellId: report.cellId.toString(),
      visible: report.visible,
      filteredOut: report.filteredOut,
      type: report.type,
    };
  }

  /* End lint */

  private _collectCell(cell: Cell): ICellResult {
    const model = cell.model;
    const cellResult: ICellResult = {
      type: model.type,
      code: this.config.code ? model.value.text : null,
      length: model.value.text.length,
      empty: model.value.text.trim().length === 0,
      executionCount: null,
      outputs: null,
    };
    if (this.config.execution && model.type === 'code') {
      const outputs: ICellOutput[] = [];
      const codeModel = model as ICodeCellModel;
      const codeOutputs = codeModel.outputs.toJSON();
      for (let j = 0; j < codeOutputs.length; j++) {
        const codeOutput = codeOutputs[j];
        const output: ICellOutput = {
          type: codeOutput.output_type,
          mime: [],
        };
        if (output.type === 'stream') {
          output.mime = [(codeOutput as IStream).name];
        } else if (output.type === 'error') {
          output.mime = [(codeOutput as IError).ename];
        } else if ({}.hasOwnProperty.call(codeOutput, 'data')) {
          output.mime = Object.keys((codeOutput as any).data);
        }
        outputs.push(output);
      }
      cellResult.executionCount = codeModel.executionCount;
      cellResult.outputs = outputs;
    }
    return cellResult;
  }

  private _getActiveIndexes(notebook: Notebook): number[] {
    const result: number[] = [];
    notebook.widgets.forEach((child, index) => {
      if (notebook.isSelectedOrActive(child)) {
        result.push(index);
      }
    });
    return result;
  }

  private _notebookName(name: string): string {
    return this.config.name ? name : '<redacted>';
  }

  private _send(data: AnyReport): Promise<any> {
    data['date'] = new Date();
    return requestAPI<any>('experiment', {
      body: JSON.stringify(data),
      method: 'POST',
    }).catch((reason) => {
      console.error(
        `The julynter server extension appears to be missing.\n${reason}`
      );
      return reason;
    });
  }
}
