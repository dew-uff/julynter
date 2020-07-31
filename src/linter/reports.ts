import {
  ErrorTypeKey,
  IItemGenerator,
  IErrorAction,
  IErrorMessage,
  IErrorType,
  ReportId,
} from './interfaces';

export const ERROR_TYPES_MAP: { [id in ErrorTypeKey]: IErrorType } = {
  invalidtitle: {
    key: 'invalidtitle',
    label: 'Invalid Title',
    toggle: 'Toggle Title Checking',
    icon: 'julynter-toolbar-title-icon',
  },
  hiddenstate: {
    key: 'hiddenstate',
    label: 'Hidden State',
    toggle: 'Toggle Hidden State Checking',
    icon: 'julynter-toolbar-hidden-state-icon',
  },
  confusenotebook: {
    key: 'confusenotebook',
    label: 'Confuse Notebook',
    toggle: 'Toggle Confuse Notebook Checking',
    icon: 'julynter-toolbar-confuse-notebook-icon',
  },
  import: {
    key: 'import',
    label: 'Import',
    toggle: 'Toggle Import Checking',
    icon: 'julynter-toolbar-import-icon',
  },
  absolutepath: {
    key: 'absolutepath',
    label: 'Absolute Path',
    toggle: 'Toggle Absolute Path Checking',
    icon: 'julynter-toolbar-absolute-path-icon',
  },
};

export const ERROR_TYPES: IErrorType[] = [
  ERROR_TYPES_MAP.invalidtitle,
  ERROR_TYPES_MAP.hiddenstate,
  ERROR_TYPES_MAP.confusenotebook,
  ERROR_TYPES_MAP.import,
  ERROR_TYPES_MAP.absolutepath,
];

const goToCell: IErrorAction = {
  label: 'Go to cell',
  title: 'Move notebook scroll to cell',
  execute(
    itemgenerator: IItemGenerator,
    index: number,
    ...others: any[]
  ): () => void {
    return (): void => {
      itemgenerator.goToCell(index);
    };
  },
};

const renameNotebook: IErrorAction = {
  label: 'Rename notebook',
  title: 'Open notebook rename dialog',
  execute(itemgenerator: IItemGenerator, ...others: any[]): () => void {
    return (): void => {
      itemgenerator.renameNotebook();
    };
  },
};

const addModule: IErrorAction = {
  label: 'Add module',
  title: 'Add module to requirements file',
  execute(
    itemgenerator: IItemGenerator,
    index: number,
    module: string,
    ...others: any[]
  ): () => void {
    return (): void => {
      itemgenerator.addModule(index, module);
    };
  },
};

const restoreCell: IErrorAction = {
  label: 'Restore cell',
  title: 'Create deleted cell',
  execute: (
    itemgenerator: IItemGenerator,
    index: number,
    execCount: number,
    code: string,
    ...others: any[]
  ) => {
    return (): void => {
      itemgenerator.restoreCell(index, execCount, code);
    };
  },
};

export const ERRORS: { [id in ReportId]: IErrorMessage } = {
  // Confuse notebook
  c1: {
    label: (i: number): string =>
      `Cell ${i} is a non-executed cell among executed ones`,
    suggestion: 'Please consider cleaning it to guarantee the reproducibility.',
    type: 'confusenotebook',
    action: goToCell,
    reason:
      'When you try to run all cells following the top-down order, non-executed cells might fail to execute or produce different results, hampering the reproducibility.',
  },
  c2: {
    label: (i: number, executionCountNumber: number | null): string =>
      `Cell ${i} has the execution count ${executionCountNumber} in the wrong order`,
    suggestion:
      'Please consider re-running the notebook to guarantee the reproducibility.',
    type: 'confusenotebook',
    action: goToCell,
    reason:
      'When you try to run all cells following the top-down order, cells in the wrong order might fail to execute or produce different results, hampering the reproducibility.',
  },
  c3: {
    label: (i: number): string =>
      `Cell ${i} is empty in the middle of the notebook`,
    suggestion: 'Please consider removing it to improve the readability.',
    type: 'confusenotebook',
    action: goToCell,
    reason:
      'Empty cells in between executable ones occupy space and might impact the readability of the notebook.',
  },
  c4: {
    label: (i: number): string =>
      'The first cell of the notebook is not a markdown cell',
    suggestion:
      'Please consider adding a markdown cell to describe the notebook.',
    type: 'confusenotebook',
    action: goToCell,
    reason:
      'A markdown cell at the beginning of the notebook can provide a human-friendly title with no constraints and introduce the notebook, indicating its purpose and external requirements.',
  },
  c5: {
    label: (i: number): string =>
      'The last cell of the notebook is not a markdown cell',
    suggestion:
      'Please consider adding a markdown cell to conclude the notebook.',
    type: 'confusenotebook',
    action: goToCell,
    reason:
      'A markdown cell at the end of the notebook can conclude it, presenting a summary of the obtained results.',
  },
  // Hidden State
  h1: {
    label: (i: number): string =>
      `Cell ${i} has execution results, but it wasn't executed on this session`,
    suggestion:
      'Please consider re-executing it to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell,
    reason:
      'A cell with results of a previous session may fail to execute or produce different results in this one, hampering the reproducibility.',
  },
  h2: {
    label: (i: number): string =>
      `Cell ${i} has changed since its execution, but it wasn't executed after the changes`,
    suggestion:
      'Please consider re-executing it to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell,
    reason:
      'A cell with code changes may produce different results than what it generated before the changes, hampering the reproducibility.',
  },
  h3: {
    label: (i: number, executionCountNumber: number | null): string =>
      `Cell ${i} repeats the execution count ${executionCountNumber}`,
    suggestion:
      'Please consider re-running the notebook to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell,
    reason:
      'A cell with a repeated execution count indicates that there are results of multiple execution sessions in this notebook. Running all cells in the top-down order might produce different results, hampering the reproducibility.',
  },
  h4: {
    label: (i: number): string => `Cell ${i} skips the execution count`,
    suggestion:
      'Please consider re-running the notebook to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell,
    reason:
      'A skip in the execution count might indicate the presence of a hidden state caused by a cell that does not exist anymore. Hidden states might prevent cells from executing or producing the same results, hampering the reproducibility.',
  },
  h5: {
    label: (i: number, dep: number, code: string, variable: string): string =>
      `Cell ${i} uses name '${variable}' that was defined on In[${dep}], but it does not exist anymore`,
    suggestion:
      'Please consider restoring the cell and re-running the notebook to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: restoreCell,
    reason:
      'The cell that created the name was removed or edited, indicating a hidden state. Using a variable from a cell that does not exist anymore prevents the reproducibility of the notebook.',
  },
  h6: {
    label: (i: number, missing: string): string =>
      `Cell ${i} has the following undefined names: ${missing}`,
    suggestion:
      'Please consider defining them to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell,
    reason:
      'The cell uses a name that does not exist in this notebook. Using a name that does not exist prevents the reproducibility of the notebook.',
  },
  // Import
  i1: {
    label: (i: number): string =>
      `Cell ${i} has imports but it is not the first cell`,
    suggestion:
      'Please consider moving the import to the first cell of the notebook.',
    type: 'import',
    action: goToCell,
    reason:
      "Imports at the beginning of the notebook allow for a quick failure in the case of a non-installed dependency. It prevents users from stopping their executions for installing dependencies. Additionally, imports in the middle might reduce notebooks' readability by taking the attention from the logic to the import constructs.",
  },
  i2: {
    label: (i: number, module: string): string =>
      `Module ${module} was imported by Cell ${i}, but it is not in the requirements file`,
    suggestion: 'Please consider adding them to guarantee the reproducibility.',
    type: 'import',
    action: addModule,
    reason:
      'Using a requirements file with pinned versions for all imported modules increases the reproducibility of the notebook.',
  },
  // Path
  p1: {
    label: (i: number, paths: string): string =>
      `Cell ${i} has the following absolute paths: ${paths}`,
    suggestion:
      'Please consider using relative paths to guarantee the reproducibility.',
    type: 'absolutepath',
    action: goToCell,
    reason:
      'Absolute paths prevent from running the notebook at different machines, hampering the reproducibility.',
  },
  // Title
  t1: {
    label: (): string => 'Title is empty',
    suggestion: 'Please consider renaming it to a meaningful name.',
    type: 'invalidtitle',
    action: renameNotebook,
    reason:
      'Empty titles are meaningless and provide no context for who is selecting the notebook in the file browser.',
  },
  t2: {
    label: (): string => 'Title starts with "Untitled"',
    suggestion: 'Please consider renaming it to a meaningful name.',
    type: 'invalidtitle',
    action: renameNotebook,
    reason:
      'Untitled notebooks provide no context for who is selecting the notebook in the file browser.',
  },
  t3: {
    label: (): string => 'Title has "-Copy"',
    suggestion: 'Please consider renaming it to a meaningful name.',
    type: 'invalidtitle',
    action: renameNotebook,
    reason:
      'Notebooks with "-Copy" in their name are hard to distinguish from their original version in the file browser.',
  },
  t4: {
    label: (): string => 'Title has blank spaces',
    suggestion: 'Please consider replacing them to support all OS.',
    type: 'invalidtitle',
    action: renameNotebook,
    reason:
      'Blank spaces on filenames are not safe to use on all operating systems, hampering the interoperability.',
  },
  t5: {
    label: (): string => 'Title has special characters',
    suggestion: 'Please consider replacing them to support all OS.',
    type: 'invalidtitle',
    action: renameNotebook,
    reason:
      'Special characters on filenames are not safe to use on all operating systems, hampering the interoperability.',
  },
  t6: {
    label: (): string => 'Title is too big',
    suggestion:
      'Please consider renaming it a smaller name and using a markdown cell for the full name.',
    type: 'invalidtitle',
    action: renameNotebook,
    reason:
      'Big names not only cause problems on some operating systems but also are hard to read on tabs and some file browsers.',
  },
  t7: {
    label: (): string => 'Title is too small',
    suggestion: 'Please consider renaming it a meaningful name.',
    type: 'invalidtitle',
    action: renameNotebook,
    reason:
      'Small titles might be meaningless and provide no context for selecting the notebook in the file browser.',
  },
};
