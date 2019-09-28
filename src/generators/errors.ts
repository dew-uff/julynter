import { INotebookHeading } from './heading';


export interface IItemGenerator {
    create(cell_id: number | string, type: 'code' | 'markdown' | 'header' | 'raw' | 'title', message:IErrorMessage, args:any[]): INotebookHeading;
    rename_notebook(): void;
    go_to_cell(index: number): void;
    add_module(index: number, module: string): void;
}

export interface IErrorType {
    key: string;
    label: string;
    toggle: string;
    icon: string;
}

export interface IErrorMessage {
    label: (...args: any[]) => string;
    suggestion: string;
    type: string;
    action: (itemgenerator: IItemGenerator, ...args: any[]) => () => void;
}

export type ErrorTypeKey = "invalid-title" | "hidden-state" | "confuse-notebook" | "import" | "absolute-path";


export const ERROR_TYPES: IErrorType[] = [
    {
        key: "invalid-title",
        label: "Invalid Title",
        toggle: "Toggle Title Checking",
        icon: "julynter-toolbar-title-icon"
        
    },
    {
        key: "hidden-state",
        label: "Hidden State",
        toggle: "Toggle Hidden State Checking",
        icon: "julynter-toolbar-title-icon"
    },
    {
        key: "confuse-notebook",
        label: "Confuse Notebook",
        toggle: "Toggle Confuse Notebook Checking",
        icon: "julynter-toolbar-title-icon"
    },
    {
        key: "import",
        label: "Import",
        toggle: "Toggle Import Checking",
        icon: "julynter-toolbar-title-icon"
    },
    {
        key: "absolute-path",
        label: "Absolute Path",
        toggle: "Toggle Absolute Path Checking",
        icon: "julynter-toolbar-title-icon"
    }
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


}