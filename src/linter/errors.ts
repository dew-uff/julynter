import {
  ErrorTypeKey,
  IItemGenerator,
  IErrorAction,
  IErrorMessage,
  IErrorType,
  ReportId
} from './interfaces';

export const ERROR_TYPES_MAP: { [id in ErrorTypeKey]: IErrorType } = {
  invalidtitle: {
    key: 'invalidtitle',
    label: 'Invalid Title',
    toggle: 'Toggle Title Checking',
    icon: 'julynter-toolbar-title-icon'
  },
  hiddenstate: {
    key: 'hiddenstate',
    label: 'Hidden State',
    toggle: 'Toggle Hidden State Checking',
    icon: 'julynter-toolbar-hidden-state-icon'
  },
  confusenotebook: {
    key: 'confusenotebook',
    label: 'Confuse Notebook',
    toggle: 'Toggle Confuse Notebook Checking',
    icon: 'julynter-toolbar-confuse-notebook-icon'
  },
  import: {
    key: 'import',
    label: 'Import',
    toggle: 'Toggle Import Checking',
    icon: 'julynter-toolbar-import-icon'
  },
  absolutepath: {
    key: 'absolutepath',
    label: 'Absolute Path',
    toggle: 'Toggle Absolute Path Checking',
    icon: 'julynter-toolbar-absolute-path-icon'
  }
};

export const ERROR_TYPES: IErrorType[] = [
  ERROR_TYPES_MAP.invalidtitle,
  ERROR_TYPES_MAP.hiddenstate,
  ERROR_TYPES_MAP.confusenotebook,
  ERROR_TYPES_MAP.import,
  ERROR_TYPES_MAP.absolutepath
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
  }
};

const renameNotebook: IErrorAction = {
  label: 'Rename notebook',
  title: 'Open notebook rename dialog',
  execute(itemgenerator: IItemGenerator, ...others: any[]): () => void {
    return (): void => {
      itemgenerator.renameNotebook();
    };
  }
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
  }
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
  }
};

export const ERRORS: { [id in ReportId]: IErrorMessage } = {
  // Confuse notebook
  c1: {
    label: (i: number): string =>
      `Cell ${i} is a non-executed cell among executed ones`,
    suggestion: 'Please consider cleaning it to guarantee the reproducibility.',
    type: 'confusenotebook',
    action: goToCell
  },
  c2: {
    label: (i: number, executionCountNumber: number | null): string =>
      `Cell ${i} has the execution count ${executionCountNumber} in the wrong order`,
    suggestion:
      'Please consider re-running the notebook to guarantee the reproducibility.',
    type: 'confusenotebook',
    action: goToCell
  },
  c3: {
    label: (i: number): string =>
      `Cell ${i} is empty in the middle of the notebook`,
    suggestion: 'Please consider removing it to improve the readability.',
    type: 'confusenotebook',
    action: goToCell
  },
  c4: {
    label: (i: number): string =>
      'The first cell of the notebook is not a markdown cell',
    suggestion:
      'Please consider adding a markdown cell to describe the notebook.',
    type: 'confusenotebook',
    action: goToCell
  },
  c5: {
    label: (i: number): string =>
      'The last cell of the notebook is not a markdown cell',
    suggestion:
      'Please consider adding a markdown cell to conclude the notebook.',
    type: 'confusenotebook',
    action: goToCell
  },
  // Hidden State
  h1: {
    label: (i: number): string =>
      `Cell ${i} has execution results, but it wasn't executed on this session`,
    suggestion:
      'Please consider re-executing it to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell
  },
  h2: {
    label: (i: number): string =>
      `Cell ${i} has changed since its execution, but it wasn't executed after the changes`,
    suggestion:
      'Please consider re-executing it to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell
  },
  h3: {
    label: (i: number, executionCountNumber: number | null): string =>
      `Cell ${i} repeats the execution count ${executionCountNumber}`,
    suggestion:
      'Please consider re-running the notebook to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell
  },
  h4: {
    label: (i: number): string => `Cell ${i} skips the execution count`,
    suggestion:
      'Please consider re-running the notebook to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell
  },
  h5: {
    label: (i: number, dep: number, code: string, variable: string): string =>
      `Cell ${i} uses name '${variable}' that was defined on In[${dep}], but it does not exist anymore`,
    suggestion:
      'Please consider restoring the cell and re-running the notebook to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: restoreCell
  },
  h6: {
    label: (i: number, missing: string): string =>
      `Cell ${i} has the following undefined names: ${missing}`,
    suggestion:
      'Please consider definint them to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell
  },
  // Import
  i1: {
    label: (i: number): string =>
      `Cell ${i} has imports but it is not the first cell`,
    suggestion:
      'Please consider moving the import to the first cell of the notebook.',
    type: 'import',
    action: goToCell
  },
  i2: {
    label: (i: number, module: string): string =>
      `Module ${module} was imported by Cell ${i}, but it is not in the requirements file`,
    suggestion: 'Please consider adding them to guarantee the reproducibility.',
    type: 'import',
    action: addModule
  },
  // Path
  p1: {
    label: (i: number, paths: string): string =>
      `Cell ${i} has the following absolute paths: ${paths}`,
    suggestion:
      'Please consider using relative paths to guarantee the reproducibility.',
    type: 'absolutepath',
    action: goToCell
  },
  // Title
  t1: {
    label: (): string => 'Title is empty',
    suggestion: 'Please consider renaming it to a meaningful name.',
    type: 'invalidtitle',
    action: renameNotebook
  },
  t2: {
    label: (): string => 'Title starts with "Untitled"',
    suggestion: 'Please consider renaming it to a meaningful name.',
    type: 'invalidtitle',
    action: renameNotebook
  },
  t3: {
    label: (): string => 'Title has "-Copy"',
    suggestion: 'Please consider renaming it to a meaningful name.',
    type: 'invalidtitle',
    action: renameNotebook
  },
  t4: {
    label: (): string => 'Title has blank spaces',
    suggestion: 'Please consider replacing them to support all OS.',
    type: 'invalidtitle',
    action: renameNotebook
  },
  t5: {
    label: (): string => 'Title has special characters',
    suggestion: 'Please consider replacing them to support all OS.',
    type: 'invalidtitle',
    action: renameNotebook
  },
  t6: {
    label: (): string => 'Title is too big',
    suggestion:
      'Please consider renaming it a smaller name and using a markdown cell for the full name.',
    type: 'invalidtitle',
    action: renameNotebook
  },
  t7: {
    label: (): string => 'Title is too small',
    suggestion: 'Please consider renaming it a meaningful name.',
    type: 'invalidtitle',
    action: renameNotebook
  }
};
