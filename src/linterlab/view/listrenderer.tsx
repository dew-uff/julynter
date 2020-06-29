import * as React from 'react';

import { IReport } from '../../linter/interfaces';
import { ItemRenderer } from './itemrenderer';
import { NotebookHandler } from '../notebookhandler';

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
      const key = `${el.cell_id}-${el.text}-${i++}`;
      return (
        <ItemRenderer
          item={el}
          key={key}
          notebook={this.props.notebook}
        />
      );
    }); 
    return (
      <ul className='jp-Julynter-content'>{listing}</ul>
    );
  }
}
