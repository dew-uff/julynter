import {
  IErrorType, IItemGenerator, IErrorMessage, ReportId, ErrorTypeKey, IErrorAction
} from './interfaces'


export const ERROR_TYPES_MAP: { [id in ErrorTypeKey]: IErrorType} = {
  'invalidtitle': {
    key: 'invalidtitle',
    label: 'Invalid Title',
    toggle: 'Toggle Title Checking',
    icon: 'julynter-toolbar-title-icon'
  },
  'hiddenstate': {
    key: 'hiddenstate',
    label: 'Hidden State',
    toggle: 'Toggle Hidden State Checking',
    icon: 'julynter-toolbar-hidden-state-icon'
  },
  'confusenotebook': {
    key: 'confusenotebook',
    label: 'Confuse Notebook',
    toggle: 'Toggle Confuse Notebook Checking',
    icon: 'julynter-toolbar-confuse-notebook-icon'
  },
  'import': {
    key: 'import',
    label: 'Import',
    toggle: 'Toggle Import Checking',
    icon: 'julynter-toolbar-import-icon'
  },
  'absolutepath': {
    key: 'absolutepath',
    label: 'Absolute Path',
    toggle: 'Toggle Absolute Path Checking',
    icon: 'julynter-toolbar-absolute-path-icon'
  }
}

export const ERROR_TYPES: IErrorType[] = [
  ERROR_TYPES_MAP['invalidtitle'],
  ERROR_TYPES_MAP['hiddenstate'],
  ERROR_TYPES_MAP['confusenotebook'],
  ERROR_TYPES_MAP['import'],
  ERROR_TYPES_MAP['absolutepath'],
]

const goToCell: IErrorAction = {
  label: 'Go to cell',
  title: 'Move notebook scroll to cell',
  execute(
    itemgenerator: IItemGenerator, index: number, ...others:any[]
  ): () => void {
    return () => {
      itemgenerator.goToCell(index);
    }
  }
};

const renameNotebook: IErrorAction = {
  label: 'Rename notebook',
  title: 'Open notebook rename dialog',
  execute(
    itemgenerator: IItemGenerator, ...others:any[]
  ): () => void {
    return () => {
      itemgenerator.renameNotebook();
    }
  }
};

const addModule: IErrorAction = {
  label: 'Add module',
  title: 'Add module to requirements file',
  execute(
    itemgenerator: IItemGenerator, index: number, module:string, ...others:any[]
  ): () => void {
    return () => {
      itemgenerator.addModule(index, module);
    }
  }
}

const restoreCell: IErrorAction = {
  label: 'Restore cell',
  title: 'Create deleted cell',
  execute: (
    itemgenerator: IItemGenerator, index: number, execCount: number, code:string, ...others:any[]
  ) => {
    return () => {
      itemgenerator.restoreCell(index, execCount, code);
    }
  }
}

export const ERRORS: { [id in ReportId]: IErrorMessage } = {

  c1: {
    label: (i: Number) =>`Cell ${i} is a non-executed cell among executed ones`,
    suggestion: 'Please consider cleaning it to guarantee the reproducibility.',
    type: 'confusenotebook',
    action: goToCell,
  },
  c2: {
    label: (i: Number, executionCountNumber: Number | null) =>`Cell ${i} has the execution count ${executionCountNumber} in the wrong order`,
    suggestion: 'Please consider re-running the notebook to guarantee the reproducibility.',
    type: 'confusenotebook',
    action: goToCell
  },
  c3: {
    label: (i: Number) => `Cell ${i} is empty in the middle of the notebook`,
    suggestion: 'Please consider removing it to improve the readability.',
    type: 'confusenotebook',
    action: goToCell
  },
  c4: {
    label: (i: Number) => `The first cell of the notebook is not a markdown cell`,
    suggestion: 'Please consider adding a markdown cell to describe the notebook.',
    type: 'confusenotebook',
    action: goToCell
  },
  c5: {
    label: (i: Number) => `The last cell of the notebook is not a markdown cell`,
    suggestion: 'Please consider adding a markdown cell to conclude the notebook.',
    type: 'confusenotebook',
    action: goToCell
  },


  h1: {
    label: (i: Number) =>`Cell ${i} has execution results, but it wasn't executed on this session`,
    suggestion: 'Please consider re-executing it to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell
  },
  h2: {
    label: (i: Number) =>`Cell ${i} has changed since its execution, but it wasn't executed after the changes`,
    suggestion: 'Please consider re-executing it to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell
  },
  h3: {
    label: (i: Number, executionCountNumber: Number | null) =>`Cell ${i} repeats the execution count ${executionCountNumber}`,
    suggestion: 'Please consider re-running the notebook to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell
  },
  h4: {
    label: (i: Number) =>`Cell ${i} skips the execution count`,
    suggestion: 'Please consider re-running the notebook to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell
  },
  h5: {
    label: (i: Number, dep: Number, code:String, variable: String) =>`Cell ${i} uses name '${variable}' that was defined on In[${dep}], but it does not exist anymore`,
    suggestion: 'Please consider restoring the cell and re-running the notebook to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: restoreCell
  },
  h6: {
    label: (i: Number, missing:String) =>`Cell ${i} has the following undefined names: ${missing}`,
    suggestion: 'Please consider definint them to guarantee the reproducibility.',
    type: 'hiddenstate',
    action: goToCell
  },

  i1: {
    label: (i: Number) =>`Cell ${i} has imports but it is not the first cell`,
    suggestion: 'Please consider moving the import to the first cell of the notebook.',
    type: 'import',
    action: goToCell
  },
  i2: {
    label: (i: Number, module: String) =>`Module ${module} was imported by Cell ${i}, but it is not in the requirements file`,
    suggestion: 'Please consider adding them to guarantee the reproducibility.',
    type: 'import',
    action: addModule
  },


  p1: {
    label: (i: Number, paths:String) => `Cell ${i} has the following absolute paths: ${paths}`,
    suggestion: 'Please consider using relative paths to guarantee the reproducibility.',
    type: 'absolutepath',
    action: goToCell
  },


  t1: {
    label: () => 'Title is empty',
    suggestion: 'Please consider renaming it to a meaningful name.',
    type: 'invalidtitle',
    action: renameNotebook
  },
  t2: {
    label: () => 'Title starts with "Untitled"',
    suggestion: 'Please consider renaming it to a meaningful name.',
    type: 'invalidtitle',
    action: renameNotebook
  },
  t3: {
    label: () => 'Title has "-Copy"',
    suggestion: 'Please consider renaming it to a meaningful name.',
    type: 'invalidtitle',
    action: renameNotebook
  },
  t4: {
    label: () => 'Title has blank spaces',
    suggestion: 'Please consider replacing them to support all OS.',
    type: 'invalidtitle',
    action: renameNotebook
  },
  t5: {
    label: () => 'Title has special characters',
    suggestion: 'Please consider replacing them to support all OS.',
    type: 'invalidtitle',
    action: renameNotebook
  },
  t6: {
    label: () => 'Title is too big',
    suggestion: 'Please consider renaming it a smaller name and using a markdown cell for the full name.',
    type: 'invalidtitle',
    action: renameNotebook
  },
  t7: {
    label: () => 'Title is too small',
    suggestion: 'Please consider renaming it a meaningful name.',
    type: 'invalidtitle',
    action: renameNotebook
  },
}