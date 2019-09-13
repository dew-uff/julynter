
import { INotebookTracker, Notebook } from '@jupyterlab/notebook';

import { notebookItemRenderer } from './itemrenderer';

import { notebookGeneratorToolbar } from './toolbargenerator';

import { JulynterRegistry } from '../../registry';

import { Julynter, IReport } from '../../julynter';

import { NotebookGeneratorOptionsManager } from './optionsmanager';

import { INotebookHeading } from './heading';
import { Widget } from '@phosphor/widgets';


import {
  renameDialog, IDocumentManager,
} from '@jupyterlab/docmanager';
import { Cell, CodeCell } from '@jupyterlab/cells';
import { IJulynterKernel } from '../../kernel/julynterkernel';


export class TitleGenerator {
  _renameAction: (line:number) => () => void;

  constructor(docManager: IDocumentManager, notebook: INotebookTracker) {
    this._renameAction = (line:number) => () => {
      renameDialog(docManager, notebook.currentWidget.context!.path)
    };
  }

  create(text:string): INotebookHeading {
    const onClick = this._renameAction(0);
    return {
      text: text,
      type: 'title',
      onClick: onClick
    }
  }
}

export class CellGenerator {
  _notebook: Notebook;

  constructor(notebook: INotebookTracker) {
    this._notebook = notebook.currentWidget.content;
  }

  create(index: number, type: 'code' | 'markdown' | 'header' | 'raw', text:string): INotebookHeading {
    const cell = this._notebook.widgets[index];
    const onClickFactory = (line: number) => {
      return () => {
        this._notebook.activeCellIndex = index;
        cell.node.scrollIntoView();
      };
    };
    const onClick = onClickFactory(0);
    return {
      text: text,
      type: type,
      onClick: onClick
    }
  }
}

export function doCheckTitle(title:string, headings: INotebookHeading[], generator:TitleGenerator) {
  if (title == '.ipynb') {
    headings.push(generator.create(
      'Title is empty. Please consider renaming it to a meaningful name.'
    ));
  }
  if (title.startsWith("untitled")) {
    headings.push(generator.create(
      'Title starts with "Untitled". Please consider renaming it to a meaningful name.'
    ));
  }
  if (title.includes("-copy")) {
    headings.push(generator.create(
      'Title has "-Copy". Please consider renaming it to a meaningful name.'
    ));
  }
  if (title.includes(" ")) {
    headings.push(generator.create(
      'Title has blank spaces. Please consider replacing them to support all OS.'
    ));
  }
  if (!/^([a-z]|[0-9]|_|-| |\.)*$/.test(title)) {
    headings.push(generator.create(
      'Title has special characters. Please consider replacing them to support all OS.'
    ));
  }

}

class NotebookGenerator implements JulynterRegistry.IGenerator<Widget> {
  tracker: INotebookTracker; 
  isEnabled?: (widget: Widget) => boolean;
  options: NotebookGeneratorOptionsManager;
  widget: Julynter;
  update: IJulynterKernel.IQueryResult | null;
  hasKernel: boolean;

  constructor(tracker: INotebookTracker, widget: Julynter) {
    this.tracker = tracker;
    this.widget = widget;
    this.options = new NotebookGeneratorOptionsManager(widget, tracker, {
      checkTitle: true,
    });
    this.update = {};
    this.hasKernel = false;
  }
  

  itemRenderer(item: IReport) {
    let options = this.options;
    return notebookItemRenderer({ options, item });
  };

  toolbarGenerator() {
    let options = this.options;
    let tracker = this.tracker;
    return notebookGeneratorToolbar(options, tracker);
  }

  _getNonExecutedTail(): number {
    let tracker = this.tracker;
    let nonExecutedTail = tracker.currentWidget.content.widgets.length;
    for (let i = tracker.currentWidget.content.widgets.length - 1; i >= 0; i--){
      let cell: Cell = tracker.currentWidget.content.widgets[i];
      let model = cell.model;
      if (model.type === 'code') {
        let executionCountNumber = (cell as CodeCell).model
            .executionCount as number | null;
        if (executionCountNumber === null) {
          nonExecutedTail = i;
        } else {
          break;
        }
      }
    }
    return nonExecutedTail;
  }

  _getEmptyTail(): number {
    let tracker = this.tracker;
    let emptyTail = tracker.currentWidget.content.widgets.length;
    for (let i = tracker.currentWidget.content.widgets.length - 1; i >= 0; i--){
      let cell: Cell = tracker.currentWidget.content.widgets[i];
      let model = cell.model;
      let text = model.value.text;
      if (text.trim() == '') {
        emptyTail = i;
      } else {
        break;
      }
    }
    return emptyTail;
  }

  _checkTitle(headings: IReport[]) {
    let options = this.options;
    let widget = this.widget;
    let tracker = this.tracker;
    if (options.checkTitle) {
      let titleGenerator = new TitleGenerator(widget.docManager, tracker);
      let title = tracker.currentWidget.title.label.toLowerCase(); 
      doCheckTitle(title, headings, titleGenerator);
    }
  }

  _checkCellDefinitions(headings: IReport[]) {
    let tracker = this.tracker;
    // Iterate through the cells in the notebook
    let executionCounts: { [key:number]: [number, Cell] } = {};
    let cellGenerator = new CellGenerator(tracker);
    let nonExecutedTail = this._getNonExecutedTail();
    let emptyTail = this._getEmptyTail();
    let executed_code = this.update.executed_code;
  
    let lastExecutionCount = -1;
    let firstCodeCell = -1;
    for (let i = 0; i < tracker.currentWidget.content.widgets.length; i++) {
      let cell: Cell = tracker.currentWidget.content.widgets[i];
      let model = cell.model;
      if (model.type === 'code') {
        if (firstCodeCell == -1) {
          firstCodeCell = i;
        }
        let executionCount = (cell as CodeCell).model.executionCount;
        let executionCountNumber = executionCount as number | null;
        
        if (this.hasKernel) {
          if (executionCountNumber != null) {
            if (!executed_code.hasOwnProperty(executionCount)) {
              headings.push(cellGenerator.create(i, cell.model.type,
                "Cell " + i + " has execution results, but it wasn't executed on this session. " + 
                "Please consider re-executing it to guarantee the reproducibility."
              ))
            } else {
              let history_code = executed_code[executionCount];
              if (history_code != (cell as CodeCell).model.value.text) {
                headings.push(cellGenerator.create(i, cell.model.type,
                  "Cell " + i + " has changed since its execution, but it wasn't executed after the changes. " + 
                  "Please consider re-executing it to guarantee the reproducibility."
                ))
              }

            }
          }
        }

        if (executionCountNumber === null) {
          if ((i < nonExecutedTail) && (model.value.text.trim() != "")) {
            headings.push(cellGenerator.create(i, cell.model.type,
              "Cell " + i + " is a non-executed cell among executed ones. " + 
              "Please consider cleaning it to guarantee the reproducibility."
            ))
          }
        } else {
          if (executionCountNumber < lastExecutionCount) {
            headings.push(cellGenerator.create(i, cell.model.type,
              "Cell " + i + " has the execution count " + executionCountNumber +" in the wrong order. " + 
              "Please consider re-running the notebook to guarantee the reproducibility."
            ))
          }
          if (executionCounts.hasOwnProperty(executionCountNumber)) {
            headings.push(cellGenerator.create(i, cell.model.type,
              "Cell " + i + " repeats the execution count " + executionCountNumber +". " + 
              "Please consider re-running the notebook to guarantee the reproducibility."
            ))
          }
          executionCounts[executionCountNumber] = [i, cell];
          lastExecutionCount = executionCountNumber;
        }
      }
      let text = model.value.text;
      
      if (text.trim() == '' && i < emptyTail) {
        headings.push(cellGenerator.create(i, cell.model.type,
          "Cell " + i + " is empty in the middle of the notebook. " + 
          "Please consider removing it to improve the readability."
        ))
      }
    }
    let has_imports = this.update.has_imports;
    if (has_imports == null) {
      has_imports = [];
    }
    console.log(has_imports);
    lastExecutionCount = null;
    Object.keys(executionCounts)
      .sort((a, b) => Number(a) - Number(b))
      .forEach(function(currentCountS, i) {
        let currentCount = Number(currentCountS);
        let tuple = executionCounts[currentCount];
        let cell = tuple[1];
        let index = tuple[0];
        if (has_imports.includes(currentCount) && index != firstCodeCell) {
          headings.push(cellGenerator.create(index, cell.model.type,
            "Cell " + index + " has imports but it is not the first cell. " + 
            "Please consider moving the import to the first cell of the notebook."
          ))
        }
        if ((lastExecutionCount === null) && (currentCount != 1)) {
          headings.push(cellGenerator.create(index, cell.model.type,
            "Cell " + index + " skips the execution count. " + 
            "Please consider re-running the notebook to guarantee the reproducibility."
          ))
        } else if ((lastExecutionCount !== null) && (lastExecutionCount !== currentCount - 1)) {
          headings.push(cellGenerator.create(index, cell.model.type,
            "Cell " + index + " skips the execution count. " + 
            "Please consider re-running the notebook to guarantee the reproducibility."
          ))
        }
        lastExecutionCount = currentCount;
      });
  }

  generate(panel: Widget): IReport[] {
   
    let headings: IReport[] = [];
      
    this._checkTitle(headings);
    this._checkCellDefinitions(headings);

    // ToDo: check imports on requirements
    // ToDo: check variable definitions
    // ToDo: check paths?
    // ToDo: check test
    // ToDo: check first cell is markdown. Check last cell is markdown
    // ToDo: check title size
    // ToDo: check cyclomatic complexity
    return headings;
  }
  processKernelMessage(update: IJulynterKernel.IJulynterKernelUpdate): void {
    if (update.status != ""){
      this.update = {};
      this.hasKernel = false;
      //this.fromKernel.push(createHeading(update.status, "header", (line:number) => () => {}));
    } else {
      console.log(update);
      this.hasKernel = true;
      this.update = update.result;
    }
  }


}


/**
 * Create a julynter generator for notebooks.
 *
 * @param tracker: A notebook tracker.
 *
 * @returns A julynter generator that can parse notebooks.
 */
export function createNotebookGenerator(
  tracker: INotebookTracker,
  widget: Julynter
): JulynterRegistry.IGenerator<Widget> {
  return new NotebookGenerator(tracker, widget);
}

export function createHeading(
  text: string,
  type: 'header' | 'markdown' | 'code' | 'title',
  onClickFactory: (line: number) => (() => void),
): INotebookHeading {
  const onClick = onClickFactory(0);
  return {
    text: text,
    type: type,
    onClick: onClick
  }
}
