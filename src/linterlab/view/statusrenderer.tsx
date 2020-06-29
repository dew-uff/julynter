import * as React from 'react';

export interface IJulynterStatus {
  connectedOnce: boolean;
  connectedNow: boolean;
  serverSide: boolean;
  hasKernel: boolean;
  experiment: boolean;
  overrideMessage: string;
}

export class StatusRenderer extends React.Component<IJulynterStatus> {

  chooseMessageIcon(): [string, string] {
    if (!this.props.connectedOnce) {
      return [
        'Julynter did not connect to a notebook',
        'julynter-never-connected-icon'
      ]
    }
    if (!this.props.connectedNow) {
      return [
        'Julynter is not connected to a notebook',
        'julynter-disconnected-icon'
      ]
    }
    if (!this.props.hasKernel) {
      return [
        'Kernel not found',
        'julynter-kernel-off-icon'
      ]
    }
    return [
      'Kernel connected',
      'julynter-kernel-on-icon'
    ]
  }

  render(): JSX.Element | null {
    let [message, icon] = this.chooseMessageIcon();
    let exp: JSX.Element = null;
    if (this.props.overrideMessage) {
      message = this.props.overrideMessage;
    }
    if (this.props.experiment) {
      exp = <span title='Experiment is Active'>e</span>;
    }
    icon += ' julynter-icon';

    return (
      <div className='jp-Julynter-kernel'>
        {exp}

        <div
          role='text'
          aria-label={message}
          title={message}
          className={icon}
        />

      </div>
    );
  
  }
}
