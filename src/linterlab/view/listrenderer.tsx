import * as React from 'react';

import { IReport } from '../../linter/interfaces';
import { NotebookHandler } from '../notebookhandler';
import { ItemRenderer } from './itemrenderer'; /* eslint @typescript-eslint/no-unused-vars: 0 */
import { ErrorHandler } from '../errorhandler';
import { ReactWidget } from '@jupyterlab/apputils';

interface IListProps {
  reports: IReport[];
  notebook: NotebookHandler;
  errorHandler: ErrorHandler;
  cellLints: HTMLElement[];
}

export class ListRenderer extends React.Component<IListProps> {
  constructor(props: IListProps) {
    super(props);
  }

  render(): JSX.Element | null {
    try {
      let i = 0;
      const listing: JSX.Element[] = this.props.reports.map((el) => {
        const key = `${el.cellId}-${el.text}-${i++}`;
        return (
          <ItemRenderer
            item={el}
            key={key}
            notebook={this.props.notebook}
            errorHandler={this.props.errorHandler}
            cellLints={this.props.cellLints}
          />
        );
      });
      return <ul className="jp-Julynter-content">{listing}</ul>;
    } catch (error) {
      throw this.props.errorHandler.report(error, 'ListRenderer:render', []);
    }
  }
}

export class LuminoList extends ReactWidget {
  
  props: IListProps;

  constructor(options: IListProps) {
    super();
    this.props = options;
  }

  protected render(): React.ReactElement<any, string | ((props: any) => React.ReactElement<any, string | any | (new (props: any) => React.Component<any, any, any>)>) | (new (props: any) => React.Component<any, any, any>)> | React.ReactElement<any, string | ((props: any) => React.ReactElement<any, string | any | (new (props: any) => React.Component<any, any, any>)>) | (new (props: any) => React.Component<any, any, any>)>[] {
    return <ListRenderer {...this.props}/>;
  }
}

export class EmptyListWidget extends ReactWidget {
  protected render(): React.ReactElement<any, string | ((props: any) => React.ReactElement<any, string | any | (new (props: any) => React.Component<any, any, any>)>) | (new (props: any) => React.Component<any, any, any>)> | React.ReactElement<any, string | ((props: any) => React.ReactElement<any, string | any | (new (props: any) => React.Component<any, any, any>)>) | (new (props: any) => React.Component<any, any, any>)>[] {
    return <div className="julynter-error-desc"> No notebooks to lint </div>;
  }

}