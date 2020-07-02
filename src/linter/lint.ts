import { ERROR_TYPES_MAP } from './reports';
import {
  ErrorTypeKey,
  ErrorTypeKeys,
  IGenericNotebookMetadata,
  IGenericCellMetadata,
  IGenericCodeCellMetadata,
  IGroupGenerator,
  IItemGenerator,
  ILintOptionsManager,
  IQueryResult,
  IReport
} from './interfaces';

export class Linter {
  hasKernel: boolean;
  options: ILintOptionsManager;
  update: IQueryResult | null;

  constructor(
    options: ILintOptionsManager,
    update: IQueryResult | null,
    hasKernel: boolean
  ) {
    this.hasKernel = false;
    this.options = options;
    this.hasKernel = hasKernel;
    this.update = update;
  }

  generate(
    notebookMetadata: IGenericNotebookMetadata,
    itemGenerator: IItemGenerator,
    groupGenerator: IGroupGenerator
  ): IReport[] {
    let headings: IReport[] = [];
    this.checkTitle(notebookMetadata, headings, itemGenerator);
    this.checkCellDefinitions(notebookMetadata, headings, itemGenerator);

    headings = this.filterByReportType(headings);
    if (this.options.checkMode() === 'cell') {
      headings = this.groupByCell(headings, groupGenerator);
    } else if (this.options.checkMode() === 'type') {
      headings = this.groupByType(headings, groupGenerator);
    }
    return headings;
  }

  private checkTitle(
    notebookMetadata: IGenericNotebookMetadata,
    headings: IReport[],
    generator: IItemGenerator
  ): void {
    const title = notebookMetadata.title.toLowerCase();
    if (title === '.ipynb') {
      headings.push(generator.create('title', 'title', 't1', []));
    }
    if (title.startsWith('untitled')) {
      headings.push(generator.create('title', 'title', 't2', []));
    }
    if (title.includes('-copy')) {
      headings.push(generator.create('title', 'title', 't3', []));
    }
    if (title.includes(' ')) {
      headings.push(generator.create('title', 'title', 't4', []));
    }
    if (!/^([a-z]|[0-9]|_|-| |\.)*$/.test(title)) {
      headings.push(generator.create('title', 'title', 't5', []));
    }
    if (title.length > 100) {
      headings.push(generator.create('title', 'title', 't6', []));
    }
    if (title.length < 10) {
      headings.push(generator.create('title', 'title', 't7', []));
    }
  }

  private checkCellDefinitions(
    notebookMetadata: IGenericNotebookMetadata,
    headings: IReport[],
    itemGenerator: IItemGenerator
  ): void {
    // Iterate through the cells in the notebook
    const executionCounts: {
      [key: number]: [number, IGenericCellMetadata];
    } = {};
    const nonExecutedTail = this.getNonExecutedTail(notebookMetadata);
    const emptyTail = this.getEmptyTail(notebookMetadata);
    const executedCode = this.update.executed_code;
    const cellDependencies = this.update.cell_dependencies || {};
    const missingDependencies = this.update.missing_dependencies || {};
    const missingRequirements = this.update.missing_requirements || {};

    let lastExecutionCount = -1;
    let firstCodeCell = -1;
    for (let i = 0; i < notebookMetadata.cells.length; i++) {
      const cell: IGenericCellMetadata = notebookMetadata.cells[i];
      const model = cell.model;
      if (model.type === 'code') {
        if (firstCodeCell === -1) {
          firstCodeCell = i;
        }
        const executionCount = (cell as IGenericCodeCellMetadata).model
          .executionCount;
        const executionCountNumber = executionCount as number | null;

        if (this.hasKernel) {
          if (
            executionCountNumber !== null &&
            executionCountNumber !== undefined
          ) {
            if (!{}.hasOwnProperty.call(executedCode, executionCountNumber)) {
              headings.push(
                itemGenerator.create(i, cell.model.type, 'h1', [i])
              );
            } else {
              const historyCode = executedCode[executionCountNumber]
                .replace(/\\n/g, '\n')
                .replace(/\\\\/g, '\\')
                .trim();
              if (
                historyCode !==
                (cell as IGenericCodeCellMetadata).model.value.text.trim()
              ) {
                headings.push(
                  itemGenerator.create(i, cell.model.type, 'h2', [i])
                );
              }
            }
          }
        }

        if (executionCountNumber === null) {
          if (i < nonExecutedTail && model.value.text.trim() !== '') {
            headings.push(itemGenerator.create(i, cell.model.type, 'c1', [i]));
          }
        } else {
          if (executionCountNumber < lastExecutionCount) {
            headings.push(
              itemGenerator.create(i, cell.model.type, 'c2', [
                i,
                executionCountNumber
              ])
            );
          }
          if ({}.hasOwnProperty.call(executionCounts, executionCountNumber)) {
            headings.push(
              itemGenerator.create(i, cell.model.type, 'h3', [
                i,
                executionCountNumber
              ])
            );
          }
          executionCounts[executionCountNumber] = [i, cell];
          lastExecutionCount = executionCountNumber;
        }
      }
      const text = model.value.text;
      if (text.trim() === '' && i < emptyTail) {
        headings.push(itemGenerator.create(i, cell.model.type, 'c3', [i]));
      }
    }
    const hasImports = this.update.has_imports || [];
    const absolutePaths = this.update.absolute_paths || {};
    const hasKernel = this.hasKernel;
    lastExecutionCount = null;
    Object.keys(executionCounts)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((currentCountS, i) => {
        const currentCount = Number(currentCountS);
        const tuple = executionCounts[currentCount];
        const cell = tuple[1];
        const index = tuple[0];
        if (hasImports.includes(currentCount) && index !== firstCodeCell) {
          headings.push(
            itemGenerator.create(index, cell.model.type, 'i1', [index])
          );
        }
        if ({}.hasOwnProperty.call(absolutePaths, currentCount)) {
          headings.push(
            itemGenerator.create(index, cell.model.type, 'p1', [
              index,
              absolutePaths[currentCount].map(x => "'" + x + "'").join(', ')
            ])
          );
        }
        if ({}.hasOwnProperty.call(missingRequirements, currentCount)) {
          Object.keys(missingRequirements[currentCount]).forEach(
            (module, j) => {
              headings.push(
                itemGenerator.create(index, cell.model.type, 'i2', [
                  index,
                  module
                ])
              );
            }
          );
        }

        if (lastExecutionCount === null && currentCount !== 1) {
          headings.push(
            itemGenerator.create(index, cell.model.type, 'h4', [index])
          );
        } else if (
          lastExecutionCount !== null &&
          lastExecutionCount !== currentCount - 1
        ) {
          headings.push(
            itemGenerator.create(index, cell.model.type, 'h4', [index])
          );
        }
        lastExecutionCount = currentCount;

        if (hasKernel) {
          const dependencies = cellDependencies[currentCount];
          if (dependencies !== undefined) {
            Object.keys(dependencies).forEach(variable => {
              const number = Number(dependencies[variable]);
              if (!{}.hasOwnProperty.call(executionCounts, number)) {
                headings.push(
                  itemGenerator.create(index, cell.model.type, 'h5', [
                    index,
                    number,
                    executedCode[number].replace('\\n', '\n'),
                    variable
                  ])
                );
              }
            });
          }
          const missing = missingDependencies[currentCount];
          if (missing !== undefined && missing.length > 0) {
            headings.push(
              itemGenerator.create(index, cell.model.type, 'h6', [
                index,
                missing.map(x => "'" + x + "'").join(', ')
              ])
            );
          }
        }
      });
    if (notebookMetadata.cells.length > 0) {
      const cell = notebookMetadata.cells[0];
      const model = cell.model;
      if (model.type !== 'markdown') {
        headings.push(itemGenerator.create(0, cell.model.type, 'c4', [0]));
      }
    }
    if (emptyTail > 1) {
      const cell = notebookMetadata.cells[emptyTail - 1];
      const model = cell.model;
      if (model.type !== 'markdown') {
        headings.push(
          itemGenerator.create(emptyTail - 1, cell.model.type, 'c5', [
            emptyTail - 1
          ])
        );
      }
    }
  }

  private getNonExecutedTail(
    notebookMetadata: IGenericNotebookMetadata
  ): number {
    let nonExecutedTail = notebookMetadata.cells.length;
    for (let i = notebookMetadata.cells.length - 1; i >= 0; i--) {
      const cell: IGenericCellMetadata = notebookMetadata.cells[i];
      const model = cell.model;
      if (model.type === 'code') {
        const executionCountNumber = (cell as IGenericCodeCellMetadata).model
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
    for (let i = notebookMetadata.cells.length - 1; i >= 0; i--) {
      const cell: IGenericCellMetadata = notebookMetadata.cells[i];
      const model = cell.model;
      const text = model.value.text;
      if (text.trim() === '') {
        emptyTail = i;
      } else {
        break;
      }
    }
    return emptyTail;
  }

  private filterByReportType(headings: IReport[]): IReport[] {
    const options = this.options;
    const newHeadings: IReport[] = [];
    headings.forEach(element => {
      if (
        options.checkType(element.reportType) &&
        (element.reportId === 'group' || options.checkReport(element.reportId))
      ) {
        newHeadings.push(element);
      }
    });

    return newHeadings;
  }

  private groupByCell(
    headings: IReport[],
    groupGenerator: IGroupGenerator
  ): IReport[] {
    const groups: { [id: string]: IReport[] } = {};
    headings.forEach(element => {
      if (element.cellId in groups) {
        groups[element.cellId].push(element);
      } else {
        groups[element.cellId] = [element];
      }
    });

    const newHeadings: IReport[] = [];
    for (const key in groups) {
      const elements = groups[key];
      newHeadings.push(groupGenerator.create(key, 'group', elements));
      newHeadings.push(...elements);
    }

    return newHeadings;
  }

  private groupByType(
    headings: IReport[],
    groupGenerator: IGroupGenerator
  ): IReport[] {
    const groups: { [id in ErrorTypeKey]?: IReport[] } = {};
    headings.forEach(element => {
      if (element.reportType in groups) {
        groups[element.reportType].push(element);
      } else {
        groups[element.reportType] = [element];
      }
    });

    const newHeadings: IReport[] = [];
    for (const key of ErrorTypeKeys) {
      const elements = groups[key];
      if (elements) {
        const groupText = ERROR_TYPES_MAP[key].label;
        newHeadings.push(groupGenerator.create(groupText, key, elements));
        newHeadings.push(...elements);
      }
    }

    return newHeadings;
  }
}
