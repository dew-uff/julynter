import {
    IErrorType, IItemGenerator, IErrorMessage
} from "./interfaces"

export type ErrorTypeKey = "invalid-title" | "hidden-state" | "confuse-notebook" | "import" | "absolute-path";


export const ERROR_TYPES_MAP: { [id:string]: IErrorType} = {
    "invalid-title": {
        key: "invalid-title",
        label: "Invalid Title",
        toggle: "Toggle Title Checking",
        icon: "julynter-toolbar-title-icon"
        
    },
    "hidden-state": {
        key: "hidden-state",
        label: "Hidden State",
        toggle: "Toggle Hidden State Checking",
        icon: "julynter-toolbar-hidden-state-icon"
    },
    "confuse-notebook": {
        key: "confuse-notebook",
        label: "Confuse Notebook",
        toggle: "Toggle Confuse Notebook Checking",
        icon: "julynter-toolbar-confuse-notebook-icon"
    },
    "import": {
        key: "import",
        label: "Import",
        toggle: "Toggle Import Checking",
        icon: "julynter-toolbar-import-icon"
    },
    "absolute-path": {
        key: "absolute-path",
        label: "Absolute Path",
        toggle: "Toggle Absolute Path Checking",
        icon: "julynter-toolbar-absolute-path-icon"
    }
}

export const ERROR_TYPES: IErrorType[] = [
    ERROR_TYPES_MAP["invalid-title"],
    ERROR_TYPES_MAP["hidden-state"],
    ERROR_TYPES_MAP["confuse-notebook"],
    ERROR_TYPES_MAP["import"],
    ERROR_TYPES_MAP["absolute-path"],
]

function go_to_cell(itemgenerator: IItemGenerator, index: number, ...others:any[]) {
    return () => {
        itemgenerator.go_to_cell(index);
    }
}

function rename_notebook(itemgenerator: IItemGenerator, ...others:any[]) {
    return () => {
        itemgenerator.rename_notebook();
    }
}

function add_module(itemgenerator: IItemGenerator, index: number, module:string, ...others:any[]) {
    return () => {
        itemgenerator.add_module(index, module);
    }
}

function restore_cell(itemgenerator: IItemGenerator, index: number, execCount: number, code:string, ...others:any[]) {
    return () => {
        itemgenerator.restore_cell(index, execCount, code);
    }
}

export const ERRORS: { [id: string]: IErrorMessage } = {


    c1: {
        label: (i: Number) =>`Cell ${i} is a non-executed cell among executed ones.`,
        suggestion: "Please consider cleaning it to guarantee the reproducibility.",
        type: "confuse-notebook",
        action: go_to_cell,
    },
    c2: {
        label: (i: Number, executionCountNumber: Number | null) =>`Cell ${i} has the execution count ${executionCountNumber} in the wrong order`,
        suggestion: "Please consider re-running the notebook to guarantee the reproducibility.",
        type: "confuse-notebook",
        action: go_to_cell
    },
    c3: {
        label: (i: Number) => `Cell ${i} is empty in the middle of the notebook`,
        suggestion: "Please consider removing it to improve the readability.",
        type: "confuse-notebook",
        action: go_to_cell
    },
    c4: {
        label: (i: Number) => `The first cell of the notebook is not a markdown cell`,
        suggestion: "Please consider adding a markdown cell to describe the notebook.",
        type: "confuse-notebook",
        action: go_to_cell
    },
    c5: {
        label: (i: Number) => `The last cell of the notebook is not a markdown cell`,
        suggestion: "Please consider adding a markdown cell to conclude the notebook.",
        type: "confuse-notebook",
        action: go_to_cell
    },


    h1: {
        label: (i: Number) =>`Cell ${i} has execution results, but it wasn't executed on this session`,
        suggestion: "Please consider re-executing it to guarantee the reproducibility.",
        type: "hidden-state",
        action: go_to_cell
    },
    h2: {
        label: (i: Number) =>`Cell ${i} has changed since its execution, but it wasn't executed after the changes`,
        suggestion: "Please consider re-executing it to guarantee the reproducibility.",
        type: "hidden-state",
        action: go_to_cell
    },
    h3: {
        label: (i: Number, executionCountNumber: Number | null) =>`Cell ${i} repeats the execution count ${executionCountNumber}`,
        suggestion: "Please consider re-running the notebook to guarantee the reproducibility.",
        type: "hidden-state",
        action: go_to_cell
    },
    h4: {
        label: (i: Number) =>`Cell ${i} skips the execution count`,
        suggestion: "Please consider re-running the notebook to guarantee the reproducibility.",
        type: "hidden-state",
        action: go_to_cell
    },
    h5: {
        label: (i: Number, dep: Number, code:String, variable: String) =>`Cell ${i} uses name "${variable}" that was defined on In[${dep}], but it does not exist anymore`,
        suggestion: "Please consider restoring the cell and re-running the notebook to guarantee the reproducibility.",
        type: "hidden-state",
        action: restore_cell
    },
    h6: {
        label: (i: Number, missing:String) =>`Cell ${i} has the following undefined names: ${missing}`,
        suggestion: "Please consider definint them to guarantee the reproducibility.",
        type: "hidden-state",
        action: go_to_cell
    },

    i1: {
        label: (i: Number) =>`Cell ${i} has imports but it is not the first cell`,
        suggestion: "Please consider moving the import to the first cell of the notebook.",
        type: "import",
        action: go_to_cell
    },
    i2: {
        label: (i: Number, module: String) =>`Module ${module} was imported by Cell ${i}, but it is not in the requirements file`,
        suggestion: "Please consider adding them to guarantee the reproducibility.",
        type: "import",
        action: add_module
    },


    p1: {
        label: (i: Number, paths:String) => `Cell ${i} has the following absolute paths: ${paths}`,
        suggestion: "Please consider using relative paths to guarantee the reproducibility.",
        type: "absolute-path",
        action: go_to_cell
    },


    t1: {
        label: () => "Title is empty",
        suggestion: "Please consider renaming it to a meaningful name.",
        type: "invalid-title",
        action: rename_notebook
    },
    t2: {
        label: () => 'Title starts with "Untitled"',
        suggestion: "Please consider renaming it to a meaningful name.",
        type: "invalid-title",
        action: rename_notebook
    },
    t3: {
        label: () => 'Title has "-Copy"',
        suggestion: "Please consider renaming it to a meaningful name.",
        type: "invalid-title",
        action: rename_notebook
    },
    t4: {
        label: () => 'Title has blank spaces',
        suggestion: "Please consider replacing them to support all OS.",
        type: "invalid-title",
        action: rename_notebook
    },
    t5: {
        label: () => 'Title has special characters',
        suggestion: "Please consider replacing them to support all OS.",
        type: "invalid-title",
        action: rename_notebook
    },
    t6: {
        label: () => 'Title is too big',
        suggestion: "Please consider renaming it a smaller name and using a markdown cell for the full name.",
        type: "invalid-title",
        action: rename_notebook
    },
    t7: {
        label: () => 'Title is too small',
        suggestion: "Please consider renaming it a meaningful name.",
        type: "invalid-title",
        action: rename_notebook
    },

}