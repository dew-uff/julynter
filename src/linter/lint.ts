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
  IReport,
  ILintingResult,
} from './interfaces';
import sha1 from 'sha1';

export function hash(value: string): string {
  // ToDo: apply sha1
  return sha1(value);
}

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
  ): ILintingResult {
    const headings: IReport[] = [];
    let hashSource = this.checkTitle(notebookMetadata, headings, itemGenerator);
    hashSource += this.checkCellDefinitions(
      notebookMetadata,
      headings,
      itemGenerator
    );
    const result: ILintingResult = this.createFilteredResult(
      headings,
      hash(hashSource)
    );
    if (this.options.checkMode() === 'cell') {
      result.visible = this.groupByCell(result.visible, groupGenerator);
    } else if (this.options.checkMode() === 'type') {
      result.visible = this.groupByType(result.visible, groupGenerator);
    }
    return result;
  }

  private checkTitle(
    notebookMetadata: IGenericNotebookMetadata,
    headings: IReport[],
    generator: IItemGenerator
  ): string {
    const title = notebookMetadata.title.toLowerCase();
    if (title === '.ipynb') {
      headings.push(generator.create('title', 'title', 't1', title, []));
    }
    if (title.startsWith('untitled')) {
      headings.push(generator.create('title', 'title', 't2', title, []));
    }
    if (title.includes('-copy')) {
      headings.push(generator.create('title', 'title', 't3', title, []));
    }
    if (title.includes(' ')) {
      headings.push(generator.create('title', 'title', 't4', title, []));
    }
    if (!/^([a-z]|[0-9]|_|-| |\.)*$/.test(title)) {
      headings.push(generator.create('title', 'title', 't5', title, []));
    }
    if (title.length > 100) {
      headings.push(generator.create('title', 'title', 't6', title, []));
    }
    if (title.length < 10) {
      headings.push(generator.create('title', 'title', 't7', title, []));
    }
    return title + ':';
  }

  private checkCellDefinitions(
    notebookMetadata: IGenericNotebookMetadata,
    headings: IReport[],
    itemGenerator: IItemGenerator
  ): string {
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
    let lastText = '';
    let emptyCounter = 0;
    let hashSource = '';
    for (let i = 0; i < notebookMetadata.cells.length; i++) {
      const cell: IGenericCellMetadata = notebookMetadata.cells[i];
      const model = cell.model;
      const text = model.value.text;
      if (model.type === 'code') {
        if (firstCodeCell === -1) {
          firstCodeCell = i;
        }
        const executionCount = (cell as IGenericCodeCellMetadata).model
          .executionCount;
        const executionCountNumber = executionCount as number | null;
        hashSource += `[${executionCountNumber || ''}]`;

        if (this.hasKernel) {
          if (
            executionCountNumber !== null &&
            executionCountNumber !== undefined
          ) {
            if (!{}.hasOwnProperty.call(executedCode, executionCountNumber)) {
              headings.push(
                itemGenerator.create(
                  i,
                  cell.model.type,
                  'h1',
                  `[${executionCountNumber}]${text}`,
                  [i]
                )
              );
            } else {
              const historyCode = executedCode[executionCountNumber].trim();
              if (historyCode !== text.trim()) {
                headings.push(
                  itemGenerator.create(
                    i,
                    cell.model.type,
                    'h2',
                    `[${executionCountNumber}]${historyCode}`,
                    [i]
                  )
                );
              }
            }
          }
        }

        if (executionCountNumber === null) {
          if (i < nonExecutedTail && model.value.text.trim() !== '') {
            headings.push(
              itemGenerator.create(i, cell.model.type, 'c1', text, [i])
            );
          }
        } else {
          if (executionCountNumber < lastExecutionCount) {
            headings.push(
              itemGenerator.create(
                i,
                cell.model.type,
                'c2',
                `[${executionCountNumber}]${text}`,
                [i, executionCountNumber]
              )
            );
          }
          if ({}.hasOwnProperty.call(executionCounts, executionCountNumber)) {
            headings.push(
              itemGenerator.create(
                i,
                cell.model.type,
                'h3',
                `[${executionCountNumber}]${text}`,
                [i, executionCountNumber]
              )
            );
          }
          executionCounts[executionCountNumber] = [i, cell];
          lastExecutionCount = executionCountNumber;
        }
      }
      hashSource += text + ';;;';
      if (text.trim() === '' && i < emptyTail) {
        headings.push(
          itemGenerator.create(
            i,
            cell.model.type,
            'c3',
            `-${emptyCounter}-${lastText}`,
            [i]
          )
        );
        emptyCounter += 1;
      } else {
        lastText = text;
        emptyCounter = 0;
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
        const model = cell.model;
        const text = model.value.text;
        if (hasImports.includes(currentCount) && index !== firstCodeCell) {
          headings.push(
            itemGenerator.create(index, cell.model.type, 'i1', text, [index])
          );
        }
        if ({}.hasOwnProperty.call(absolutePaths, currentCount)) {
          headings.push(
            itemGenerator.create(index, cell.model.type, 'p1', text, [
              index,
              absolutePaths[currentCount].map((x) => "'" + x + "'").join(', '),
            ])
          );
        }
        if ({}.hasOwnProperty.call(missingRequirements, currentCount)) {
          Object.keys(missingRequirements[currentCount]).forEach(
            (module, j) => {
              headings.push(
                itemGenerator.create(
                  index,
                  cell.model.type,
                  'i2',
                  `:${module}:${text}`,
                  [index, module]
                )
              );
            }
          );
        }

        if (lastExecutionCount === null && currentCount !== 1) {
          headings.push(
            itemGenerator.create(index, cell.model.type, 'h4', text, [index])
          );
        } else if (
          lastExecutionCount !== null &&
          lastExecutionCount !== currentCount - 1
        ) {
          headings.push(
            itemGenerator.create(index, cell.model.type, 'h4', text, [index])
          );
        }
        lastExecutionCount = currentCount;

        if (hasKernel) {
          const dependencies = cellDependencies[currentCount];
          if (dependencies !== undefined) {
            Object.keys(dependencies).forEach((variable) => {
              const number = Number(dependencies[variable]);
              if (!{}.hasOwnProperty.call(executionCounts, number)) {
                headings.push(
                  itemGenerator.create(
                    index,
                    cell.model.type,
                    'h5',
                    `${variable};${text}`,
                    [index, number, executedCode[number], variable]
                  )
                );
              }
            });
          }
          const missing = missingDependencies[currentCount];
          if (missing !== undefined && missing.length > 0) {
            headings.push(
              itemGenerator.create(
                index,
                cell.model.type,
                'h6',
                `${missing.join(',')};${text}`,
                [index, missing.map((x) => "'" + x + "'").join(', ')]
              )
            );
          }
        }
      });
    if (notebookMetadata.cells.length > 0) {
      const cell = notebookMetadata.cells[0];
      const model = cell.model;
      const text = model.value.text;
      if (model.type !== 'markdown') {
        headings.push(
          itemGenerator.create(0, cell.model.type, 'c4', text, [0])
        );
      }
    }
    if (emptyTail > 1) {
      const cell = notebookMetadata.cells[emptyTail - 1];
      const model = cell.model;
      const text = model.value.text;
      if (model.type !== 'markdown') {
        headings.push(
          itemGenerator.create(emptyTail - 1, cell.model.type, 'c5', text, [
            emptyTail - 1,
          ])
        );
      }
    }
    return hashSource;
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

  private createFilteredResult(
    headings: IReport[],
    notebookHash: string
  ): ILintingResult {
    const options = this.options;
    const filtered = options.checkFiltered();
    const result: ILintingResult = {
      visible: [],
      filteredType: [],
      filteredId: [],
      filteredRestart: [],
      filteredIndividual: [],
      hash: notebookHash,
    };

    headings.forEach((element) => {
      if (!options.checkType(element.reportType)) {
        result.filteredType.push(element);
      } else if (
        element.reportId !== 'group' &&
        !options.checkReport(element.reportId)
      ) {
        result.filteredId.push(element);
      } else if (element.restart && !options.checkRestart()) {
        result.filteredRestart.push(element);
      } else if (filtered.includes(element.hash)) {
        result.filteredIndividual.push(element);
      } else {
        result.visible.push(element);
      }
    });

    return result;
  }

  private groupByCell(
    headings: IReport[],
    groupGenerator: IGroupGenerator
  ): IReport[] {
    const groups: { [id: string]: IReport[] } = {};
    headings.forEach((element) => {
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
    headings.forEach((element) => {
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
