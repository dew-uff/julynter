import * as React from 'react';

import { Panel } from '@lumino/widgets';
import { ReactWidget } from '@jupyterlab/apputils';
import { IReport } from '../../linter/interfaces';
import { NotebookHandler } from '../notebookhandler';
import { ErrorHandler } from '../errorhandler';
import { ItemWidget } from './itemwidget'; /* eslint @typescript-eslint/no-unused-vars: 0 */
import { CellWidget } from './cellwidget';

interface IListProps {
  reports: IReport[];
  notebook: NotebookHandler;
  errorHandler: ErrorHandler;
  cellLints: { [num: string]: CellWidget };
}

export class ListWidget extends Panel {
  reports: IReport[];
  notebook: NotebookHandler;
  errorHandler: ErrorHandler;
  cellLints: { [num: string]: CellWidget };

  constructor(options: IListProps) {
    super();
    this.reports = options.reports;
    this.notebook = options.notebook;
    this.errorHandler = options.errorHandler;
    this.cellLints = options.cellLints;
    this.create();
  }

  create(): void {
    try {
      this.addClass('jp-Julynter-content');
      this.reports.forEach((el) => {
        const itemWidget = new ItemWidget({
          item: el,
          notebook: this.notebook,
          errorHandler: this.errorHandler,
          cellLints: this.cellLints,
        });
        this.addWidget(itemWidget);
      });
    } catch (error) {
      throw this.errorHandler.report(error, 'ListWidget:create', []);
    }
  }
}

export class EmptyListWidget extends ReactWidget {
  protected render(): JSX.Element {
    return <div className="julynter-error-desc"> No notebooks to lint </div>;
  }
}
