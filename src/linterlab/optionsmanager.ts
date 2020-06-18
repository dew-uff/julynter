import { ISanitizer } from '@jupyterlab/apputils';

import { INotebookTracker } from '@jupyterlab/notebook';

import { IJulynterLintOptions, ILintOptionsManager, ViewModes } from "../linter/interfaces"
import { Config } from './config';

export class OptionsManager implements ILintOptionsManager {
  private _preRenderedToolbar: any = null;
  private _tracker: INotebookTracker;
  private _checks: IJulynterLintOptions;
  private _default: IJulynterLintOptions;
  private _update: () => void;
  
  constructor(tracker: INotebookTracker, config: Config, update: () => void) {
    this._default = config.defaultOptions;
    this._checks = { ...this._default }; 
    this._tracker = tracker;
    this._update = update;
  }

  readonly sanitizer: ISanitizer;

  set notebookMetadata(value: [string, any]) {
    if (this._tracker.currentWidget != null) {
      this._tracker.currentWidget.model.metadata.set(value[0], value[1]);
    }
  }

  update(key: string, value: boolean){
    (this._checks as any)[key] = value;
    this.notebookMetadata = ['julynter-check-' + key, value];
    this._update();
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
    this._update();
  }

  updateRequirements(req: string) {
    this._checks["requirements"] = req;
    this.notebookMetadata = ['julynter-check-requirements', req];
    this._update();
  }

  get checks(): IJulynterLintOptions {
    return this._checks;
  }

  set preRenderedToolbar(value: any) {
    this._preRenderedToolbar = value;
  }

  get preRenderedToolbar() {
    return this._preRenderedToolbar;
  }

  updateWidget() {
    this._update();
  }

  reloadOptions() {
    if (this._tracker.currentWidget !== undefined && this._tracker.currentWidget !== null) {
      for (let key in this._checks) {
        let value = this._tracker.currentWidget.model.metadata.get('julynter-check-' + key);
        if (value !== undefined) {
          (this._checks as any)[key] = value;
        } else {
          (this._checks as any)[key] = (this._default as any)[key];
        }
      }
    }
  }

  // initialize options, will NOT change notebook metadata
  initializeOptions(checks: IJulynterLintOptions) {
    this._checks = checks;
    this._update();
  }

}