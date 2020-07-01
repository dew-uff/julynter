import { ISanitizer } from '@jupyterlab/apputils';
import { NotebookPanel } from '@jupyterlab/notebook';

import {
  ErrorTypeKey,
  ErrorTypeKeys,
  IJulynterLintOptions,
  ILintOptionsManager,
  ReportId,
  ReportIds,
  ViewMode
} from '../linter/interfaces';
import { Config } from './config';
import { ExperimentManager } from './experimentmanager';

export class OptionsManager implements ILintOptionsManager {
  private _checks: IJulynterLintOptions;
  private _default: IJulynterLintOptions;
  private _experimentManager: ExperimentManager;
  private _nbPanel: NotebookPanel;
  private _update: () => void;

  constructor(
    nbPanel: NotebookPanel,
    config: Config,
    environmentManager: ExperimentManager,
    update: () => void
  ) {
    this._default = config.defaultOptions;
    this._experimentManager = environmentManager;
    this._checks = { ...this._default };
    this._nbPanel = nbPanel;
    this._update = update;
    this.reloadOptions();
  }

  readonly sanitizer: ISanitizer;

  private loadKey<T>(key: string, def: T): T {
    let result = def;
    if (this._nbPanel) {
      const temp = this._nbPanel.model.metadata.get('julynter-check-' + key);
      if (temp !== undefined && temp !== null) {
        result = (temp as unknown) as T;
      }
    }
    return result;
  }

  private saveKey(key: string, value: any, ereport = true): void {
    if (this._nbPanel) {
      this._nbPanel.model.metadata.set('julynter-check-' + key, value);
      if (ereport) {
        this._experimentManager.reportSetConfig(this._nbPanel, key, value);
      }
    }
    this._update();
  }

  checkReport(key: ReportId): boolean {
    return this._checks.reports[key];
  }

  checkType(key: ErrorTypeKey): boolean {
    return this._checks.types[key];
  }

  checkMode(): ViewMode {
    return this._checks.mode;
  }

  checkRequirements(): string {
    return this._checks.requirements;
  }

  updateReport(key: ReportId, value: boolean): void {
    this._checks.reports[key] = value;
    this.saveKey('report-' + key, value);
  }

  updateType(key: ErrorTypeKey, value: boolean): void {
    this._checks.types[key] = value;
    this.saveKey('type-' + key, value);
  }

  updateMode(mode: ViewMode): void {
    this._checks.mode = mode;
    this.saveKey('mode', mode);
  }

  updateRequirements(req: string): void {
    this._checks.requirements = req;
    this.saveKey('requirements', req);
  }

  get checks(): IJulynterLintOptions {
    return this._checks;
  }

  updateWidget(): void {
    this._update();
  }

  // initialize options, will NOT change notebook metadata
  initializeOptions(checks: IJulynterLintOptions): void {
    this._checks = checks;
    this._update();
  }

  reloadOptions(): void {
    this._checks = {
      mode: this.loadKey('mode', this._default.mode),
      requirements: this.loadKey('requirements', this._default.requirements),
      reports: ReportIds.reduce(
        (previous, key) => {
          const rkey = 'report-' + key;
          previous[key] = this.loadKey(rkey, this._default.reports[key]);
          return previous;
        },
        { ...this._default.reports }
      ),
      types: ErrorTypeKeys.reduce(
        (previous, key) => {
          const tkey = 'type-' + key;
          previous[key] = this.loadKey(tkey, this._default.types[key]);
          return previous;
        },
        { ...this._default.types }
      )
    };
    this._experimentManager.reportLoadConfig(this._nbPanel, this._checks);
    this._update();
  }

  saveOptions(): void {
    this.saveKey('mode', this._checks.mode, false);
    this.saveKey('requirements', this._checks.requirements, false);
    for (const key of ErrorTypeKeys) {
      this.saveKey('type-' + key, this._checks.types[key], false);
    }
    for (const key of ReportIds) {
      this.saveKey('report-' + key, this._checks.reports[key], false);
    }
    this._experimentManager.reportSaveConfig(this._nbPanel, this._checks);
    this._update();
  }

  get experimentManager(): ExperimentManager {
    return this._experimentManager;
  }
}
