import { Widget } from '@phosphor/widgets';

import { INotebookTracker } from '@jupyterlab/notebook';

import { JulynterRegistry } from '../registry';

import { Julynter } from '../julynter';

import { IGenericNotebookMetadata, IGenericCellMetadata, IReport } from '../../linter/interfaces';

import { Linter } from '../../linter/lint';

import { IQueryResult } from '../../linter/interfaces';

import { ItemGenerator, GroupGenerator } from './itemgenerator';

import { OptionsManager } from './optionsmanager';

import { notebookItemRenderer } from './itemrenderer';

import { notebookGeneratorToolbar } from './toolbargenerator';
import { IJulynterKernelUpdate } from '../kernel/interfaces';


class NotebookGenerator implements JulynterRegistry.IGenerator<Widget> {
  tracker: INotebookTracker;  
  isEnabled?: (widget: Widget) => boolean;
  options: OptionsManager;
  widget: Julynter;
  update: IQueryResult | null;
  hasKernel: boolean;

  constructor(tracker: INotebookTracker, widget: Julynter) {
    this.tracker = tracker;
    this.widget = widget;
    this.options = new OptionsManager(widget, tracker);
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
    let groupGenerator = new GroupGenerator(tracker, widget);
    let itemGenerator = new ItemGenerator(tracker, widget);
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
  tracker: INotebookTracker,
  widget: Julynter
): JulynterRegistry.IGenerator<Widget> {
  return new NotebookGenerator(tracker, widget);
}
