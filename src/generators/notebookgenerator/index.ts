
import { INotebookTracker } from '@jupyterlab/notebook';

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
