import * as React from 'react';

import { IReport } from '../../linter/interfaces';
import { NotebookHandler } from '../notebookhandler';
import { ItemWidget } from './itemwidget'; /* eslint @typescript-eslint/no-unused-vars: 0 */
import { ErrorHandler } from '../errorhandler';
import { ReactWidget } from '@jupyterlab/apputils';
import { Panel } from '@lumino/widgets';
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

  create() {
    try {
      this.addClass("jp-Julynter-content")
      this.reports.forEach((el) => {
        let itemWidget = new ItemWidget({
          item: el,
          notebook: this.notebook,
          errorHandler: this.errorHandler,
          cellLints: this.cellLints
        });
        this.addWidget(itemWidget);
      });
    } catch (error) {
      throw this.errorHandler.report(error, 'ListWidget:create', []);
    }
  }
}

export class EmptyListWidget extends ReactWidget {
  protected render(): React.ReactElement<any, string | ((props: any) => React.ReactElement<any, string | any | (new (props: any) => React.Component<any, any, any>)>) | (new (props: any) => React.Component<any, any, any>)> | React.ReactElement<any, string | ((props: any) => React.ReactElement<any, string | any | (new (props: any) => React.Component<any, any, any>)>) | (new (props: any) => React.Component<any, any, any>)>[] {
    return <div className="julynter-error-desc"> No notebooks to lint </div>;
  }

}