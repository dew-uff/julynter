import * as React from 'react';

import { IReport } from '../../linter/interfaces';
import { NotebookHandler } from '../notebookhandler';
import { ItemRenderer } from './itemrenderer'; /* eslint @typescript-eslint/no-unused-vars: 0 */

interface IListProps {
  reports: IReport[];
  notebook: NotebookHandler;
}

export class ListRenderer extends React.Component<IListProps> {
  constructor(props: IListProps) {
    super(props);
  }

  render(): JSX.Element | null {
    let i = 0;
    const listing: JSX.Element[] = this.props.reports.map(el => {
      const key = `${el.cellId}-${el.text}-${i++}`;
      return (
        <ItemRenderer item={el} key={key} notebook={this.props.notebook} />
      );
    });
    return <ul className="jp-Julynter-content">{listing}</ul>;
  }
}
