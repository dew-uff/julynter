import { Widget } from '@phosphor/widgets';

import { INotebookTracker } from '@jupyterlab/notebook';

import { JulynterRegistry } from '../registry';

import { Julynter } from '../julynter';

import { IGenericNotebookMetadata, IGenericCellMetadata, IReport } from '../../linter/interfaces';

import { Linter } from '../../linter/lint';

import { IQueryResult, ILintOptionsManager } from '../../linter/interfaces';

import { ItemGenerator, GroupGenerator } from './itemgenerator';

import { notebookItemRenderer } from './itemrenderer';

import { notebookGeneratorToolbar } from './toolbargenerator';
import { IJulynterKernelUpdate } from '../kernel/interfaces';


class NotebookGenerator implements JulynterRegistry.IGenerator<Widget> {
  tracker: INotebookTracker;  
  isEnabled?: (widget: Widget) => boolean;
  options: ILintOptionsManager;
  widget: Julynter;
  update: IQueryResult | null;
  hasKernel: boolean;

  constructor(widget: Julynter, options: ILintOptionsManager) {
    this.tracker = widget.tracker;
    this.widget = widget;
    this.options = options;
    this.update = {};
    this.hasKernel = false;
  }
  
  itemRenderer(item: IReport) {
    return notebookItemRenderer(item);
  };

  toolbarGenerator() {
    return notebookGeneratorToolbar(this.options, this.tracker);
  }

  generate(panel: Widget): IReport[] {
    let tracker = this.tracker;
    let widget = this.widget;
    let groupGenerator = new GroupGenerator(widget);
    let itemGenerator = new ItemGenerator(widget);
    let notebookMetadata: IGenericNotebookMetadata = {
      title: this.tracker.currentWidget.title.label,
      cells: tracker.currentWidget.content.widgets as unknown as IGenericCellMetadata[],
    }
    let linter = new Linter(this.options, this.update, this.hasKernel);
    return linter.generate(notebookMetadata, itemGenerator, groupGenerator);
  }

  processKernelMessage(update: IJulynterKernelUpdate): void {
    if (update.status != ""){
      this.update = {};
      this.hasKernel = false;
    } else {
      this.hasKernel = true;
      this.update = update.result;
    }
  }


}

/**
 * Create a julynter generator for notebooks.
 */
export function createNotebookGenerator(
  widget: Julynter,
  options: ILintOptionsManager
): JulynterRegistry.IGenerator<Widget> {
  return new NotebookGenerator(widget, options);
}
