import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { ErrorHandler } from '../errorhandler';
import { IJulynterStatus, StatusRenderer } from './statusrenderer';

export class HeaderWidget extends ReactWidget {
  update: () => void;
  jtitle: string;
  status: IJulynterStatus;
  eh: ErrorHandler;

  constructor(
    jtitle: string,
    status: IJulynterStatus,
    eh: ErrorHandler,
    update: () => void
  ) {
    super();
    this.jtitle = jtitle;
    this.update = update;
    this.status = status;
    this.eh = eh;
    this.addClass('julynter-header-widget');
  }

  titleClick(): void {
    try {
      this.update();
    } catch (error) {
      throw this.eh.report(error, 'Julynter:titleClick', []);
    }
  }

  protected render(): JSX.Element {
    return (
      <header>
        <div
          className="julynter-title"
          onClick={this.titleClick.bind(this)}
          title="Click to reload"
        >
          {this.jtitle}
        </div>
        <StatusRenderer {...this.status} errorHandler={this.eh} />
      </header>
    );
  }
}
