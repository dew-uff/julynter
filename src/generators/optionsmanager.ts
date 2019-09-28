import { ISanitizer } from '@jupyterlab/apputils';

import { INotebookTracker } from '@jupyterlab/notebook';

import { JulynterRegistry } from '../registry';

import { Julynter } from '../julynter';


export interface IJulynterLintOptions {
  "invalid-title": boolean;
  "hidden-state": boolean;
  "confuse-notebook": boolean;
  "import": boolean;
  "absolute-path": boolean;
  "mode": "list" | "cell" | "type";
  "requirements": string;
}


export class NotebookGeneratorOptionsManager extends JulynterRegistry.IGeneratorOptionsManager {
  private _preRenderedToolbar: any = null;
  private _notebook: INotebookTracker;
  private _widget: Julynter;
  private _checks: IJulynterLintOptions;
  
  constructor(widget: Julynter, notebook: INotebookTracker) {
    super();
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

  setCheck(key: string, value: boolean){
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

  setCheckMode(mode: "list" | "cell" | "type") {
    this._checks["mode"] = mode;
    this.notebookMetadata = ['julynter-check-mode', mode];
    this._widget.update();
  }


  checkRequirements() {
    return this._checks["requirements"]
  }

  setCheckRequirements(req: string) {
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