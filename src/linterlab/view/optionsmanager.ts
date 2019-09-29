import { ISanitizer } from '@jupyterlab/apputils';

import { INotebookTracker } from '@jupyterlab/notebook';

import { IJulynterLintOptions, ILintOptionsManager, ViewModes } from "../../linter/interfaces"

import { Julynter } from '../julynter';


export class OptionsManager implements ILintOptionsManager {
  private _preRenderedToolbar: any = null;
  private _notebook: INotebookTracker;
  private _widget: Julynter;
  private _checks: IJulynterLintOptions;
  
  constructor(widget: Julynter, notebook: INotebookTracker) {
    this._checks = {
      "invalid-title": true,
      "hidden-state": true,
      "confuse-notebook": true,
      "import": true,
      "absolute-path": true,
      "mode": "list",
      "requirements": "requirements.txt"
    };
    this._widget = widget;
    this._notebook = notebook;
  }

  readonly sanitizer: ISanitizer;

  set notebookMetadata(value: [string, any]) {
    if (this._notebook.currentWidget != null) {
      this._notebook.currentWidget.model.metadata.set(value[0], value[1]);
    }
  }

  update(key: string, value: boolean){
    (this._checks as any)[key] = value;
    this.notebookMetadata = ['julynter-check-' + key, value];
    this._widget.update();
  }

  check(key: string) {
    return (this._checks as any)[key];
  }

  checkMode() {
    return this._checks["mode"]
  }

  checkRequirements() {
    return this._checks["requirements"]
  }

  updateMode(mode: ViewModes) {
    this._checks["mode"] = mode;
    this.notebookMetadata = ['julynter-check-mode', mode];
    this._widget.update();
  }

  updateRequirements(req: string) {
    this._checks["requirements"] = req;
    this.notebookMetadata = ['julynter-check-requirements', req];
    this._widget.update();
  }

  get checks() {
    return this._checks;
  }

  set preRenderedToolbar(value: any) {
    this._preRenderedToolbar = value;
  }

  get preRenderedToolbar() {
    return this._preRenderedToolbar;
  }

  updateWidget() {
    this._widget.update();
  }


  // initialize options, will NOT change notebook metadata
  initializeOptions(checks: IJulynterLintOptions) {
    this._checks = checks;
    this._widget.update();
  }
  
}