
import { INotebookTracker } from '@jupyterlab/notebook';

import { notebookItemRenderer } from './itemrenderer';

import { notebookGeneratorToolbar } from './toolbargenerator';

import { JulynterRegistry } from '../registry';

import { Julynter, IReport } from '../julynter';

import { NotebookGeneratorOptionsManager } from './optionsmanager';

import { INotebookHeading } from './heading';
import { ItemGenerator, GroupGenerator } from './itemgenerators';
import { Widget } from '@phosphor/widgets';

import { Cell, CodeCell } from '@jupyterlab/cells';
import { IJulynterKernel } from '../kernel/julynterkernel';

import { ERRORS, IItemGenerator } from "./errors";


export function doCheckTitle(title:string, headings: INotebookHeading[], generator:IItemGenerator) {
  if (title == '.ipynb') {
    headings.push(generator.create("title", "title", ERRORS.t1, []))
  }
  if (title.startsWith("untitled")) {
    headings.push(generator.create("title", "title", ERRORS.t2, []))
  }
  if (title.includes("-copy")) {
    headings.push(generator.create("title", "title", ERRORS.t3, []))
  }
  if (title.includes(" ")) {
    headings.push(generator.create("title", "title", ERRORS.t4, []))
  }
  if (!/^([a-z]|[0-9]|_|-| |\.)*$/.test(title)) {
    headings.push(generator.create("title", "title", ERRORS.t5, []))
  }
}


class NotebookGenerator implements JulynterRegistry.IGenerator<Widget> {
  tracker: INotebookTracker;  
  isEnabled?: (widget: Widget) => boolean;
  options: NotebookGeneratorOptionsManager;
  widget: Julynter;
  update: IJulynterKernel.IQueryResult | null;
  hasKernel: boolean;
  cellGroupGenerator: GroupGenerator;
  itemGenerator: ItemGenerator;

  constructor(tracker: INotebookTracker, widget: Julynter) {
    this.tracker = tracker;
    this.widget = widget;
    this.options = new NotebookGeneratorOptionsManager(widget, tracker);
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
    let title = this.tracker.currentWidget.title.label.toLowerCase(); 
    doCheckTitle(title, headings, this.itemGenerator);
  }

  _checkCellDefinitions(headings: IReport[]) {
    let tracker = this.tracker;
    // Iterate through the cells in the notebook
    let executionCounts: { [key:number]: [number, Cell] } = {};
    let nonExecutedTail = this._getNonExecutedTail();
    let emptyTail = this._getEmptyTail();
    let executed_code = this.update.executed_code;
    let itemGenerator = this.itemGenerator;
  
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
            if (!executed_code.hasOwnProperty(executionCountNumber)) {
              headings.push(itemGenerator.create(i, cell.model.type, ERRORS.h1, [i]))
            } else {
              let history_code = executed_code[executionCountNumber].replace("\\n", "\n");
              if (history_code != (cell as CodeCell).model.value.text) {
                headings.push(itemGenerator.create(i, cell.model.type, ERRORS.h2, [i]))
              }

            }
          }
        }

        if (executionCountNumber === null) {
          if ((i < nonExecutedTail) && (model.value.text.trim() != "")) {
            headings.push(itemGenerator.create(i, cell.model.type, ERRORS.c1, [i]))
          }
        } else {
          if (executionCountNumber < lastExecutionCount) {
            headings.push(itemGenerator.create(i, cell.model.type, ERRORS.c2, [i, executionCountNumber]))
          }
          if (executionCounts.hasOwnProperty(executionCountNumber)) {
            headings.push(itemGenerator.create(i, cell.model.type, ERRORS.h3, [i, executionCountNumber]))
          }
          executionCounts[executionCountNumber] = [i, cell];
          lastExecutionCount = executionCountNumber;
        }
      }
      let text = model.value.text;
      
      if (text.trim() == '' && i < emptyTail) {
        headings.push(itemGenerator.create(i, cell.model.type, ERRORS.c3, [i]))
      }
    }
    let has_imports = this.update.has_imports || [];
    let absolute_paths = this.update.absolute_paths || {};
    let missing_requirements = this.update.missing_requirements || {};
    lastExecutionCount = null;
    Object.keys(executionCounts)
      .sort((a, b) => Number(a) - Number(b))
      .forEach(function(currentCountS, i) {
        let currentCount = Number(currentCountS);
        let tuple = executionCounts[currentCount];
        let cell = tuple[1];
        let index = tuple[0];
        if (has_imports.includes(currentCount) && index != firstCodeCell) {
          headings.push(itemGenerator.create(index, cell.model.type, ERRORS.i1, [index]))
        }
        if (absolute_paths.hasOwnProperty(currentCount)) {
          headings.push(itemGenerator.create(index, cell.model.type, ERRORS.p1, [
            index,absolute_paths[currentCount].map(x => "'" + x + "'").join(", ")
          ]))
        }
        if (missing_requirements.hasOwnProperty(currentCount)) {
          Object.keys(missing_requirements[currentCount]).forEach(function(module, j) {
            headings.push(itemGenerator.create(index, cell.model.type, ERRORS.i2, [index, module]))
          });
        }

        if ((lastExecutionCount === null) && (currentCount != 1)) {
          headings.push(itemGenerator.create(index, cell.model.type, ERRORS.h4, [index]))
        } else if ((lastExecutionCount !== null) && (lastExecutionCount !== currentCount - 1)) {
          headings.push(itemGenerator.create(index, cell.model.type, ERRORS.h4, [index]))
        }
        lastExecutionCount = currentCount;
      });
  }

  generate(panel: Widget): IReport[] {
    let tracker = this.tracker;
    let widget = this.widget;
    this.cellGroupGenerator = new GroupGenerator(tracker, widget);
    this.itemGenerator = new ItemGenerator(tracker, widget);
    let headings: IReport[] = [];
      
    this._checkTitle(headings);
    this._checkCellDefinitions(headings);

    // ToDo: check variable definitions
    // ToDo: check test
    // ToDo: check first cell is markdown. Check last cell is markdown
    // ToDo: check title size
    // ToDo: check cyclomatic complexity

    
    //return headings;

    return this._filter_by_report_type(headings);
  }

  _filter_by_report_type(headings: IReport[]) {
    let options = this.options;
    let new_headings: IReport[] = [];
    headings.forEach(element => {
      if (options.check(element.report_type)){
        new_headings.push(element);
      }
    });

    return new_headings;
  }

  _group_by_cell(headings: IReport[]) {
    let group_generator = this.cellGroupGenerator;
    let groups: { [id:string]: IReport[]} = {};
    headings.forEach(element => {
      if (element.cell_id in groups){
        groups[element.cell_id].push(element);
      } else {
        groups[element.cell_id] = [element];
      }
    });

    let new_headings: IReport[] = [];
    for (let key in groups) {
      let elements = groups[key];
      new_headings.push(group_generator.create(key, elements));
      new_headings.push(...elements);
    }

    return new_headings;
  }

  _group_by_report_type(headings: IReport[]) {
    let group_generator = this.cellGroupGenerator;
    let groups: { [id:string]: IReport[]} = {};
    headings.forEach(element => {
      if (element.report_type in groups){
        groups[element.report_type].push(element);
      } else {
        groups[element.report_type] = [element];
      }
    });

    let new_headings: IReport[] = [];
    for (let key in groups) {
      let elements = groups[key];
      new_headings.push(group_generator.create(key, elements));
      new_headings.push(...elements);
    }

    return new_headings;
  }



  processKernelMessage(update: IJulynterKernel.IJulynterKernelUpdate): void {
    if (update.status != ""){
      this.update = {};
      this.hasKernel = false;
      //this.fromKernel.push(createHeading(update.status, "header", (line:number) => () => {}));
    } else {
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
