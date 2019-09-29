/**
 * Possible export types
 */
export type ReportType = 'header' | 'markdown' | 'code' | 'raw' | 'title' | 'group';

/**
 * Possible visualization modes
 */
export type ViewModes = 'list' | 'cell' | 'type';

/**
 * An object that represents a query result
 */
export interface IQueryResult {
  executed_code?: { [cell: number]: string };
  cell_dependencies?: { [cell: string]: { [name: string]: string } };
  missing_dependencies?: { [cell: string]: string[] };
  absolute_paths?: { [cell: number]: string[] };
  has_imports?: number[];
  missing_requirements?: { [cell: number]: { [name: string]: {
      status: number;
      msg: string;
  } } };
}

/**
 * An object that represents an error report.
 */
export interface IReport {
  text: string;
  report_type: string;
  cell_id: string | number;
  visible: boolean;
  filtered_out: boolean;
  
  onClick: () => void;

  type?: ReportType;
  collapsed?: boolean;
  has_parent?: boolean;
}

/**
 * An error type that can be filtered
 */
export interface IErrorType {
  key: string;
  label: string;
  toggle: string;
  icon: string;
}

/**
 * An error message
 */
export interface IErrorMessage {
  label: (...args: any[]) => string;
  suggestion: string;
  type: string;
  action: (itemgenerator: IItemGenerator, ...args: any[]) => () => void;
}

/**
 * An object that generates error reports
 */
export interface IItemGenerator {
  create(cell_id: number | string, type: ReportType, message:IErrorMessage, args:any[]): IReport;
  rename_notebook(): void;
  go_to_cell(index: number): void;
  add_module(index: number, module: string): void;
}

/**
 * An object that generates grouped error reports
 */
export interface IGroupGenerator {
  create(key: string, elements: IReport[]): IReport;
}


/**
 * Linter configuration options
 */
export interface IJulynterLintOptions {
  "invalid-title": boolean;
  "hidden-state": boolean;
  "confuse-notebook": boolean;
  "import": boolean;
  "absolute-path": boolean;
  "mode": ViewModes;
  "requirements": string;
}

/**
 * And object that sets and reads options from notebooks
 */
export interface ILintOptionsManager {
  check(key: string): boolean;
  checkMode(): ViewModes;
  checkRequirements(): string;
  update(key: string, value:boolean): void;
  updateMode(mode: ViewModes): void;
  updateRequirements(req: string): void;
  initializeOptions(checks: IJulynterLintOptions): void;
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
export interface IGenericCodeCellModelMetadata extends IGenericCellModelMetadata {
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
