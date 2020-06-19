import { ISanitizer } from '@jupyterlab/apputils';


import { IJulynterLintOptions, ILintOptionsManager, ViewModes } from "../linter/interfaces"
import { Config } from './config';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ExperimentManager } from './experimentmanager';

export class OptionsManager implements ILintOptionsManager {
  private _preRenderedToolbar: any = null;
  private _checks: IJulynterLintOptions;
  private _default: IJulynterLintOptions;
  private _experimentManager: ExperimentManager;
  private _nbPanel: NotebookPanel;
  private _update: () => void;
  
  constructor(nbPanel: NotebookPanel, config: Config, environmentManager: ExperimentManager, update: () => void) {
    this._default = config.defaultOptions;
    this._experimentManager = environmentManager;
    this._checks = { ...this._default }; 
    this._nbPanel = nbPanel;
    this._update = update;
    this.reloadOptions();
  }

  readonly sanitizer: ISanitizer;

  set notebookMetadata(value: [string, any]) {
    if (this._nbPanel != null) {
      this._nbPanel.model.metadata.set(value[0], value[1]);
    }
  }

  update(key: string, value: boolean){
    (this._checks as any)[key] = value;
    this.notebookMetadata = ['julynter-check-' + key, value];
    this._experimentManager.reportSetConfig(this._nbPanel, key, value);

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
    this._experimentManager.reportSetConfig(this._nbPanel, "mode", mode);

    this._update();
  }

  updateRequirements(req: string) {
    this._checks["requirements"] = req;
    this.notebookMetadata = ['julynter-check-requirements', req];
    this._experimentManager.reportSetConfig(this._nbPanel, "requirements", req);

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
    for (let key in this._checks) {
      let value = this._nbPanel.model.metadata.get('julynter-check-' + key);
      if (value !== undefined) {
        (this._checks as any)[key] = value;
      } else {
        (this._checks as any)[key] = (this._default as any)[key];
      }
    }
    this._experimentManager.reportLoadConfig(this._nbPanel, this._checks);
  }

  // initialize options, will NOT change notebook metadata
  initializeOptions(checks: IJulynterLintOptions) {
    this._checks = checks;
    this._update();
  }

}