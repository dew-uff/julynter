import { ReadonlyPartialJSONValue } from '@lumino/coreutils';

import {
  ErrorTypeKey,
  ErrorTypeKeys,
  IJulynterLintOptions,
  ILintOptionsManager,
  ReportId,
  ReportIds,
  ViewMode,
} from './interfaces';

export abstract class AbstractOptionsManager implements ILintOptionsManager {
  public checks: IJulynterLintOptions;
  public default: IJulynterLintOptions;
  public filteredHashes: string[];

  abstract loadKey<T>(key: string, def: T): T;
  abstract saveKey(
    key: string,
    value: ReadonlyPartialJSONValue,
    ereport: boolean
  ): void;

  checkReport(key: ReportId): boolean {
    return this.checks.reports[key];
  }

  checkType(key: ErrorTypeKey): boolean {
    return this.checks.types[key];
  }

  checkMode(): ViewMode {
    return this.checks.mode;
  }

  checkView(): boolean {
    return this.checks.view;
  }

  checkRestart(): boolean {
    return this.checks.restart;
  }

  checkRequirements(): string {
    return this.checks.requirements;
  }

  checkFiltered(): string[] {
    return this.filteredHashes;
  }

  updateReport(key: ReportId, value: boolean): void {
    this.checks.reports[key] = value;
    this.saveKey('report-' + key, value, true);
  }

  updateType(key: ErrorTypeKey, value: boolean): void {
    this.checks.types[key] = value;
    this.saveKey('type-' + key, value, true);
  }

  updateMode(mode: ViewMode): void {
    this.checks.mode = mode;
    this.saveKey('mode', mode, true);
  }

  updateView(view: boolean): void {
    this.checks.view = view;
    this.saveKey('view', view, true);
  }

  updateRestart(restart: boolean): void {
    this.checks.restart = restart;
    this.saveKey('restart', restart, true);
  }

  updateRequirements(req: string): void {
    this.checks.requirements = req;
    this.saveKey('requirements', req, true);
  }

  resetFiltered(): void {
    this.filteredHashes = [];
    this.saveKey('filtered-hashes', this.filteredHashes, true);
  }

  addLintFilter(hash: string): void {
    this.filteredHashes.push(hash);
    this.saveKey('filtered-hashes', this.filteredHashes, true);
  }

  // initialize options, will NOT change notebook metadata
  initializeOptions(checks: IJulynterLintOptions, filteredHashes: string[]): void {
    this.checks = checks;
    this.filteredHashes = filteredHashes;
  }

  reloadOptions(): void {
    this.initializeOptions({
      mode: this.loadKey('mode', this.default.mode),
      view: this.loadKey('view', this.default.view),
      restart: this.loadKey('restart', this.default.restart),
      requirements: this.loadKey('requirements', this.default.requirements),
      reports: ReportIds.reduce(
        (previous, key) => {
          const rkey = 'report-' + key;
          previous[key] = this.loadKey(rkey, this.default.reports[key]);
          return previous;
        },
        { ...this.default.reports }
      ),
      types: ErrorTypeKeys.reduce(
        (previous, key) => {
          const tkey = 'type-' + key;
          previous[key] = this.loadKey(tkey, this.default.types[key]);
          return previous;
        },
        { ...this.default.types }
      ),
      kernel: this.default.kernel
    }, this.loadKey('filtered-hashes', []));
  }

  saveOptions(): void {
    this.saveKey('mode', this.checks.mode, false);
    this.saveKey('view', this.checks.view, false);
    this.saveKey('restart', this.checks.restart, false);
    this.saveKey('requirements', this.checks.requirements, false);
    for (const key of ErrorTypeKeys) {
      this.saveKey('type-' + key, this.checks.types[key], false);
    }
    for (const key of ReportIds) {
      this.saveKey('report-' + key, this.checks.reports[key], false);
    }
    this.saveKey('filtered-hashes', this.filteredHashes, false);
  }
}
