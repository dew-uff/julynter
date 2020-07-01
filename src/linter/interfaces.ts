/**
 * Possible export types
 */
export type ReportType =
  | 'header'
  | 'markdown'
  | 'code'
  | 'raw'
  | 'title'
  | 'group';

/**
 * Possible visualization modes
 */
export const ViewModes = ['list', 'cell', 'type'] as const;
export type ViewMode = typeof ViewModes[number];

/**
 * Possible report types
 */
export const ErrorTypeKeys = [
  'invalidtitle',
  'hiddenstate',
  'confusenotebook',
  'import',
  'absolutepath'
] as const;
export type ErrorTypeKey = typeof ErrorTypeKeys[number];

/**
 * Possible report ids
 */
export const ReportIds = [
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i1',
  'i2',
  'p1',
  't1',
  't2',
  't3',
  't4',
  't5',
  't6',
  't7'
] as const;
export type ReportId = typeof ReportIds[number];

/**
 * An object that represents a query result
 */
export interface IQueryResult {
  executed_code?: { [cell: number]: string };
  cell_dependencies?: { [cell: string]: { [name: string]: string } };
  missing_dependencies?: { [cell: string]: string[] };
  absolute_paths?: { [cell: number]: string[] };
  has_imports?: number[];
  missing_requirements?: {
    [cell: number]: {
      [name: string]: {
        status: number;
        msg: string;
      };
    };
  };
}

/**
 * An object that represents an error report.
 */
export interface IReport {
  text: string;
  reportType: ErrorTypeKey;
  reportId: ReportId | 'group';
  suggestion: string;
  cellId: string | number;
  visible: boolean;
  filteredOut: boolean;

  action: IErrorAction;
  boundAction: () => void;

  type?: ReportType;
  collapsed?: boolean;
  hasParent?: boolean;

  // Experiment attributes
  feedback?: number;
  kept?: boolean;
}

/**
 * An error type that can be filtered
 */
export interface IErrorType {
  key: ErrorTypeKey;
  label: string;
  toggle: string;
  icon: string;
}

/**
 * An report action
 */
export interface IErrorAction {
  execute: (itemgenerator: IItemGenerator, ...args: any[]) => () => void;
  label: string;
  title: string;
}

/**
 * An error message
 */
export interface IErrorMessage {
  label: (...args: any[]) => string;
  suggestion: string;
  type: ErrorTypeKey;
  action: IErrorAction;
}

/**
 * An object that generates error reports
 */
export interface IItemGenerator {
  create(
    cellId: number | string,
    type: ReportType,
    messageId: string,
    args: any[]
  ): IReport;
  renameNotebook(): void;
  goToCell(index: number): void;
  addModule(index: number, module: string): void;
  restoreCell(index: number, executionCount: number, code: string): void;
}

/**
 * An object that generates grouped error reports
 */
export interface IGroupGenerator {
  create(key: string, reportType: string, elements: IReport[]): IReport;
}

/**
 * Linter configuration options
 */
export interface IJulynterLintOptions {
  mode: ViewMode;
  requirements: string;
  types: { [id in ErrorTypeKey]: boolean };
  reports: { [id in ReportId]: boolean };
}

/**
 * And object that sets and reads options from notebooks
 */
export interface ILintOptionsManager {
  checkReport(key: ReportId): boolean;
  checkType(key: ErrorTypeKey): boolean;
  checkMode(): ViewMode;
  checkRequirements(): string;
  updateReport(key: ReportId, value: boolean): void;
  updateType(key: ErrorTypeKey, value: boolean): void;
  updateMode(mode: ViewMode): void;
  updateRequirements(req: string): void;
  updateWidget(): void;
  initializeOptions(checks: IJulynterLintOptions): void;
  reloadOptions(): void;
  saveOptions(): void;
  checks: IJulynterLintOptions;
}

/**
 * The following interfaces mimics jupyter lab interfaces to support the
 * reconstruction of notebooks metadata on jupyter notebook
 */

/**
 * Generic version of IObservableString from @jupyterlab/observables
 */
export interface IGenericObservableString {
  text: string;
}

/**
 * Generic version of ICellModel from @jupyterlab/cells
 */
export interface IGenericCellModelMetadata {
  type: 'code' | 'markdown' | 'raw';
  value: IGenericObservableString;
}

/**
 * Generic version of ICodeCellModel from @jupyterlab/cells
 */
export interface IGenericCodeCellModelMetadata
  extends IGenericCellModelMetadata {
  executionCount: number | null;
}

/**
 * Generic version of Cell from @jupyterlab/cells
 */
export interface IGenericCellMetadata {
  model: IGenericCellModelMetadata;
}

/**
 * Generic version of CodeCell from @jupyterlab/cells
 */
export interface IGenericCodeCellMetadata {
  model: IGenericCodeCellModelMetadata;
}

/**
 * Custom generic notebook format
 */
export interface IGenericNotebookMetadata {
  title: string;
  cells: IGenericCellMetadata[];
}
