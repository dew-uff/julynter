import { ISanitizer } from '@jupyterlab/apputils';


import { IJulynterLintOptions, ILintOptionsManager, ViewMode, ErrorTypeKey, ErrorTypeKeys, ReportId, ReportIds } from '../linter/interfaces'
import { Config } from './config';
import { NotebookPanel } from '@jupyterlab/notebook';
import { ExperimentManager } from './experimentmanager';

export class OptionsManager implements ILintOptionsManager {
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

  private loadKey<T>(key: string, def:T): T {
    let result = def;
    if (this._nbPanel != null) {
      const temp = this._nbPanel.model.metadata.get('julynter-check-' + key);
      if (temp !== undefined && temp !== null) {
        result = temp as unknown as T;
      } 
    }
    return result;
  }

  private saveKey(key: string, value: any) {
    if (this._nbPanel != null) {
      this._nbPanel.model.metadata.set('julynter-check-' + key, value);
      this._experimentManager.reportSetConfig(this._nbPanel, key, value);
    }
    this._update();
  }

  checkReport(key: ReportId) {
    return this._checks.reports[key];
  }

  checkType(key: ErrorTypeKey) {
    return this._checks.types[key];
  }

  checkMode() {
    return this._checks.mode;
  }

  checkRequirements() {
    return this._checks.requirements;
  }

  updateReport(key: ReportId, value: boolean) {
    this._checks.reports[key] = value;
    this.saveKey('report-' + key, value);
  }

  updateType(key: ErrorTypeKey, value: boolean) {
    this._checks.types[key] = value;
    this.saveKey('type-' + key, value);
  }

  updateMode(mode: ViewMode) {
    this._checks.mode = mode;
    this.saveKey('mode', mode);
  }

  updateRequirements(req: string) {
    this._checks.requirements = req;
    this.saveKey('requirements', req);
  }

  get checks(): IJulynterLintOptions {
    return this._checks;
  }

  updateWidget() {
    this._update();
  }

  // initialize options, will NOT change notebook metadata
  initializeOptions(checks: IJulynterLintOptions) {
    this._checks = checks;
    this._update();
  }

  reloadOptions() {
    const self = this;
    this._checks = {
      mode: this.loadKey('mode', this._default.mode),
      requirements: this.loadKey('requirements', this._default.requirements),
      reports: ReportIds.reduce((previous, key) => {
        previous[key] = self.loadKey('report-' + key, this._default.reports[key]);
        return previous; 
      }, {...this._default.reports}),
      types: ErrorTypeKeys.reduce((previous, key) => {
        previous[key] = self.loadKey('type-' + key, this._default.types[key]);
        return previous; 
      }, {...this._default.types}),
    }
    this._update();
  }

  saveOptions() {
    this.saveKey('mode', this._checks.mode);
    this.saveKey('requirements', this._checks.requirements);
    for (const key of ErrorTypeKeys) {
      this.saveKey('type-' + key, this._checks.types[key]);
    }
    for (const key of ReportIds) {
      this.saveKey('report-' + key, this._checks.reports[key]);
    }
    this._experimentManager.reportSaveConfig(this._nbPanel, this._checks);
    this._update();
  }

  get experimentManager() {
    return this._experimentManager;
  }

}