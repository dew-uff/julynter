import * as React from 'react';

import { INotebookTracker } from '@jupyterlab/notebook';
import { IReport } from '../../linter/interfaces';
import { OptionsManager } from '../optionsmanager';
import { ItemRenderer } from './itemrenderer';
import { ToolbarRenderer } from './toolbarrenderer';

interface IListProps {
  options: OptionsManager;
  tracker: INotebookTracker | null;
  reports: IReport[];
}

export class ListRenderer extends React.Component<IListProps> {

  constructor(props: IListProps) {
    super(props);
  }

  render(): JSX.Element | null {

    let i = 0;
    let listing: JSX.Element[] = this.props.reports.map(el => {
      let key = `${el.cell_id}-${el.text}-${i++}`;
      return (
        <ItemRenderer
          item={el}
          key={key}
        />
      );
    }); 
    return (
      <div>
        <ToolbarRenderer options={this.props.options} tracker={this.props.tracker}/>
        <ul className="jp-Julynter-content">{listing}</ul>
      </div>
    );
  }
}
