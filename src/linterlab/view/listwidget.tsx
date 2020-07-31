import * as React from 'react';

import { IReport } from '../../linter/interfaces';
import { NotebookHandler } from '../notebookhandler';
import { ItemWidget } from './itemrenderer'; /* eslint @typescript-eslint/no-unused-vars: 0 */
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
  
  props: IListProps;

  constructor(options: IListProps) {
    super();
    this.props = options;
    this.create();
  }

  create() {
    try {
      this.addClass("jp-Julynter-content")
      this.props.reports.forEach((el) => {
        let itemWidget = new ItemWidget({
          item: el,
          notebook: this.props.notebook,
          errorHandler: this.props.errorHandler,
          cellLints: this.props.cellLints
        });
        this.addWidget(itemWidget);
      });
    } catch (error) {
      throw this.props.errorHandler.report(error, 'ListWidget:create', []);
    }
  }
}

export class EmptyListWidget extends ReactWidget {
  protected render(): React.ReactElement<any, string | ((props: any) => React.ReactElement<any, string | any | (new (props: any) => React.Component<any, any, any>)>) | (new (props: any) => React.Component<any, any, any>)> | React.ReactElement<any, string | ((props: any) => React.ReactElement<any, string | any | (new (props: any) => React.Component<any, any, any>)>) | (new (props: any) => React.Component<any, any, any>)>[] {
    return <div className="julynter-error-desc"> No notebooks to lint </div>;
  }

}