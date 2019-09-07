
import { INotebookTracker, Notebook } from '@jupyterlab/notebook';

import { notebookItemRenderer } from './itemrenderer';

import { notebookGeneratorToolbar } from './toolbargenerator';

import { JulynterRegistry } from '../../registry';

import { Julynter } from '../../julynter';

import { NotebookGeneratorOptionsManager } from './optionsmanager';

import { INotebookHeading } from './heading';
import { Widget } from '@phosphor/widgets';


import {
  renameDialog, IDocumentManager,
} from '@jupyterlab/docmanager';
import { Cell, CodeCell } from '@jupyterlab/cells';


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
  // Create a option manager to manage user settings
  const options = new NotebookGeneratorOptionsManager(widget, tracker, {
    checkTitle: true,
  });
  return {
    tracker,
    options: options,
    toolbarGenerator: () => {
      return notebookGeneratorToolbar(options, tracker);
    },
    itemRenderer: (item: INotebookHeading) => {
      return notebookItemRenderer(options, item);
    },
    generate: panel => {
      let headings: INotebookHeading[] = [];
          
      console.log("Generate report");
      if (options.checkTitle) {
        let titleGenerator = new TitleGenerator(widget.docManager, tracker);
        let title = tracker.currentWidget.title.label.toLowerCase(); 
        doCheckTitle(title, headings, titleGenerator);
      }


      // Iterate through the cells in the notebook
      let cellGenerator = new CellGenerator(tracker);
      let executionCounts: { [key:number]: [number, Cell] } = {};
      let nonExecutedTail = tracker.currentWidget.content.widgets.length;
      let emptyTail = tracker.currentWidget.content.widgets.length;
      
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
      
      let lastExecutionCount = -1;
      for (let i = 0; i < tracker.currentWidget.content.widgets.length; i++) {
        let cell: Cell = tracker.currentWidget.content.widgets[i];
        let model = cell.model;
        if (model.type === 'code') {
          let executionCountNumber = (cell as CodeCell).model
              .executionCount as number | null;
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
      
      lastExecutionCount = null;
      console.log(executionCounts);
      Object.keys(executionCounts)
        .sort()
        .forEach(function(currentCountS, i) {
          console.log(currentCountS, i);
          let currentCount = Number(currentCountS);
          let tuple = executionCounts[currentCount];
          let cell = tuple[1];
          let index = tuple[0];
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
      
      // ToDo: check cell updates after execution
      // ToDo: check imports on requirements
      // ToDo: check variable definitions
      // ToDo: check test
      // ToDo: check first cell is markdown. Check last cell is markdown
      // ToDo: check title size
      // ToDo: check cyclomatic complexity
      // ToDo: check position of imports
      // ToDo: check paths?


      //let cell: Cell = panel.content.widgets[0];
      
      // Iterate through the cells in the notebook, generating their headings
      /*
      for (let i = 0; i < panel.content.widgets.length; i++) {
        let cell: Cell = panel.content.widgets[i];
        let collapsed = cell.model.metadata.get('toc-hr-collapsed') as boolean;
        collapsed = collapsed !== undefined ? collapsed : false;
        let model = cell.model;
        if (model.type === 'code') {
          // Code is shown by default, overridden by previously saved settings
          if (!widget || (widget && options.showCode)) {
            // Generate the heading and add to headings if appropriate
            let executionCountNumber = (cell as CodeCell).model
              .executionCount as number | null;
            let executionCount =
              executionCountNumber !== null
                ? '[' + executionCountNumber + ']: '
                : '[ ]: ';
            let text = (model as CodeCellModel).value.text;
            const onClickFactory = (line: number) => {
              return () => {
                panel.content.activeCellIndex = i;
                cell.node.scrollIntoView();
              };
            };
            let lastLevel = Private.getLastLevel(headings);
            let renderedHeading = Private.getCodeCells(
              text,
              onClickFactory,
              executionCount,
              lastLevel,
              cell
            );
            [headings, prevHeading] = Private.addMDOrCode(
              headings,
              renderedHeading,
              prevHeading,
              collapseLevel,
              options.filtered
            );
          }
          // Iterate over the code cell outputs to check for MD/HTML
          for (let j = 0; j < (model as CodeCellModel).outputs.length; j++) {
            const outputModel = (model as CodeCellModel).outputs.get(j);
            const dataTypes = Object.keys(outputModel.data);
            const htmlData = dataTypes.filter(t => isMarkdown(t) || isDOM(t));
            if (!htmlData.length) {
              continue;
            }
            // If MD/HTML generate the heading and add to headings if applicable
            const outputWidget = (cell as CodeCell).outputArea.widgets[j];
            const onClickFactory = (el: Element) => {
              return () => {
                panel.content.activeCellIndex = i;
                panel.content.mode = 'command';
                el.scrollIntoView();
              };
            };
            let lastLevel = Private.getLastLevel(headings);
            let numbering = options.numbering;
            let renderedHeading = Private.getRenderedHTMLHeading(
              outputWidget.node,
              onClickFactory,
              sanitizer,
              numberingDict,
              lastLevel,
              numbering,
              cell
            );
            [headings, prevHeading, collapseLevel] = Private.processMD(
              renderedHeading,
              options.showMarkdown,
              headings,
              prevHeading,
              collapseLevel,
              options.filtered,
              collapsed
            );
          }
        } else if (model.type === 'markdown') {
          let mdCell = cell as MarkdownCell;
          let renderedHeading: INotebookHeading | undefined = undefined;
          let lastLevel = Private.getLastLevel(headings);
          // If the cell is rendered, generate the ToC items from the HTML
          if (mdCell.rendered && !mdCell.inputHidden) {
            const onClickFactory = (el: Element) => {
              return () => {
                if (!mdCell.rendered) {
                  panel.content.activeCellIndex = i;
                  el.scrollIntoView();
                } else {
                  panel.content.mode = 'command';
                  cell.node.scrollIntoView();
                  panel.content.activeCellIndex = i;
                }
              };
            };
            renderedHeading = Private.getRenderedHTMLHeading(
              cell.node,
              onClickFactory,
              sanitizer,
              numberingDict,
              lastLevel,
              options.numbering,
              cell
            );
            // If not rendered, generate ToC items from the text of the cell
          } else {
            const onClickFactory = (line: number) => {
              return () => {
                panel.content.activeCellIndex = i;
                cell.node.scrollIntoView();
              };
            };
            renderedHeading = Private.getMarkdownHeading(
              model!.value.text,
              onClickFactory,
              numberingDict,
              lastLevel,
              cell
            );
          }
          // Add to headings if applicable
          [headings, prevHeading, collapseLevel] = Private.processMD(
            renderedHeading,
            options.showMarkdown,
            headings,
            prevHeading,
            collapseLevel,
            options.filtered,
            collapsed
          );
        }
      }
      */
      return headings;
    }
  };
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
