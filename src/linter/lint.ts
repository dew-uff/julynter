import { 
  IQueryResult, IReport, ILintOptionsManager, IItemGenerator, IGroupGenerator,
  IGenericNotebookMetadata, IGenericCellMetadata, IGenericCodeCellMetadata
} from "./interfaces";
import { ERRORS, ERROR_TYPES_MAP } from "./errors"


export class Linter {
  hasKernel: boolean;
  options: ILintOptionsManager;
  update: IQueryResult | null;

  constructor(options: ILintOptionsManager, update: IQueryResult | null, hasKernel: boolean) {
    this.hasKernel = false;
    this.options = options;
    this.hasKernel = hasKernel;
    this.update = update;
  }

  generate(notebookMetadata: IGenericNotebookMetadata, itemGenerator: IItemGenerator, groupGenerator: IGroupGenerator): IReport[] {
    let headings: IReport[] = [];
    this.checkTitle(notebookMetadata, headings, itemGenerator);
    this.checkCellDefinitions(notebookMetadata, headings, itemGenerator);
    
    // ToDo: check variable definitions
    // ToDo: check test
    
    headings = this.filter_by_report_type(headings);
    if (this.options.checkMode() == 'cell'){
      headings = this.group_by_cell(headings, groupGenerator);
    } else if (this.options.checkMode() == 'type'){
      headings = this.group_by_type(headings, groupGenerator);
    }
    return headings;
  }

  private checkTitle(notebookMetadata: IGenericNotebookMetadata, headings: IReport[], generator: IItemGenerator) {
    let title = notebookMetadata.title.toLowerCase();
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
    if (title.length > 100) {
      headings.push(generator.create("title", "title", ERRORS.t6, []))
    }
    if (title.length < 8) {
      headings.push(generator.create("title", "title", ERRORS.t7, []))
    }
  }
  
  private checkCellDefinitions(notebookMetadata: IGenericNotebookMetadata, headings: IReport[], itemGenerator: IItemGenerator) {
    // Iterate through the cells in the notebook
    let executionCounts: { [key:number]: [number, IGenericCellMetadata] } = {};
    let nonExecutedTail = this.getNonExecutedTail(notebookMetadata);
    let emptyTail = this.getEmptyTail(notebookMetadata);
    let executed_code = this.update.executed_code;
  
    let lastExecutionCount = -1;
    let firstCodeCell = -1;
    for (let i = 0; i < notebookMetadata.cells.length; i++) {
      let cell: IGenericCellMetadata = notebookMetadata.cells[i];
      let model = cell.model;
      if (model.type === 'code') {
        if (firstCodeCell == -1) {
          firstCodeCell = i;
        }
        let executionCount = (cell as IGenericCodeCellMetadata).model.executionCount;
        let executionCountNumber = executionCount as number | null;
        
        if (this.hasKernel) {
          if (executionCountNumber != null) {
            if (!executed_code.hasOwnProperty(executionCountNumber)) {
              headings.push(itemGenerator.create(i, cell.model.type, ERRORS.h1, [i]))
            } else {
              let history_code = executed_code[executionCountNumber].replace("\\n", "\n");
              if (history_code != (cell as IGenericCodeCellMetadata).model.value.text) {
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
    if (notebookMetadata.cells.length > 0) {
      let cell = notebookMetadata.cells[0];
      let model = cell.model;
      if (model.type !== 'markdown') {
        headings.push(itemGenerator.create(0, cell.model.type, ERRORS.c4, [0]))
      }
    }
    if (emptyTail > 1) {
      let cell = notebookMetadata.cells[emptyTail - 1];
      let model = cell.model;
      if (model.type !== 'markdown') {
        headings.push(itemGenerator.create(emptyTail - 1, cell.model.type, ERRORS.c5, [emptyTail - 1]))
      }
    }
  }

  private getNonExecutedTail(notebookMetadata: IGenericNotebookMetadata): number {
    let nonExecutedTail = notebookMetadata.cells.length;
    for (let i = notebookMetadata.cells.length - 1; i >= 0; i--){
      let cell: IGenericCellMetadata = notebookMetadata.cells[i];
      let model = cell.model;
      if (model.type === 'code') {
        let executionCountNumber = (cell as IGenericCodeCellMetadata).model
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

  private getEmptyTail(notebookMetadata: IGenericNotebookMetadata): number {
    let emptyTail = notebookMetadata.cells.length;
    for (let i = notebookMetadata.cells.length - 1; i >= 0; i--){
      let cell: IGenericCellMetadata = notebookMetadata.cells[i];
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

  private filter_by_report_type(headings: IReport[]) {
    let options = this.options;
    let new_headings: IReport[] = [];
    headings.forEach(element => {
      if (options.check(element.report_type)){
        new_headings.push(element);
      }
    });

    return new_headings;
  }

  private group_by_cell(headings: IReport[], groupGenerator: IGroupGenerator) {
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
      new_headings.push(groupGenerator.create(key, "group", elements));
      new_headings.push(...elements);
    }

    return new_headings;
  }

  private group_by_type(headings: IReport[], groupGenerator: IGroupGenerator) {
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
      let groupText = ERROR_TYPES_MAP[key].label;
      new_headings.push(groupGenerator.create(groupText, key, elements));
      new_headings.push(...elements);
    }

    return new_headings;
  }

}
