import { ISanitizer } from '@jupyterlab/apputils';
import { NotebookPanel } from '@jupyterlab/notebook';

import { IJulynterLintOptions } from '../linter/interfaces';
import { Config } from './config';
import { ExperimentManager } from './experimentmanager';
import { AbstractOptionsManager } from '../linter/options';
import { ErrorHandler } from './errorhandler';
import { ReadonlyPartialJSONValue } from '@lumino/coreutils';

export class OptionsManager extends AbstractOptionsManager {
  private _experimentManager: ExperimentManager;
  private _eh: ErrorHandler;
  private _nbPanel: NotebookPanel;
  private _update: () => void;

  constructor(
    nbPanel: NotebookPanel,
    config: Config,
    environmentManager: ExperimentManager,
    errorHandler: ErrorHandler,
    update: () => void
  ) {
    super();
    this.default = config.defaultOptions;
    this._experimentManager = environmentManager;
    this._eh = errorHandler;
    this._nbPanel = nbPanel;
    this._update = update;
    this.initializeOptions({ ...this.default }, []);
    this.reloadOptions();
  }

  readonly sanitizer: ISanitizer;

  loadKey<T>(key: string, def: T): T {
    try {
      let result = def;
      if (this._nbPanel) {
        const temp = this._nbPanel.model.metadata.get('julynter-check-' + key);
        if (temp !== undefined && temp !== null) {
          result = (temp as unknown) as T;
        }
      }
      return result;
    } catch (error) {
      throw this._eh.report(error, 'OptionsManager:loadKey', [key, def]);
    }
  }

  saveKey(key: string, value: ReadonlyPartialJSONValue, ereport = true): void {
    try {
      if (this._nbPanel) {
        this._nbPanel.model.metadata.set('julynter-check-' + key, value);
        if (ereport) {
          this._experimentManager.reportSetConfig(this._nbPanel, key, value);
        }
      }
      this._update();
    } catch (error) {
      throw this._eh.report(error, 'OptionsManager:loadKey', [
        key,
        value,
        ereport,
      ]);
    }
  }

  // initialize options, will NOT change notebook metadata
  initializeOptions(checks: IJulynterLintOptions, filtered: string[]): void {
    try {
      super.initializeOptions(checks, filtered);
      this._update();
    } catch (error) {
      throw this._eh.report(error, 'OptionsManager:initializeOptions', [
        checks,
      ]);
    }
  }

  reloadOptions(): void {
    try {
      super.reloadOptions();
      this._experimentManager.reportLoadConfig(this._nbPanel, this.checks);
    } catch (error) {
      throw this._eh.report(error, 'OptionsManager:reloadOptions', []);
    }
  }

  saveOptions(): void {
    try {
      super.saveOptions();
      this._experimentManager.reportSaveConfig(this._nbPanel, this.checks);
      this._update();
    } catch (error) {
      throw this._eh.report(error, 'OptionsManager:saveOptions', []);
    }
  }
}
