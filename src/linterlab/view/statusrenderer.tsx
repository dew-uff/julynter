import * as React from 'react';
import { ErrorHandler } from '../errorhandler';
import { showDialog, Dialog } from '@jupyterlab/apputils';

export interface IJulynterStatus {
  connectedOnce: boolean;
  connectedNow: boolean;
  serverSide: boolean;
  hasKernel: boolean;
  experiment: boolean;
}

export interface IJulynterStatusProps extends IJulynterStatus {
  errorHandler: ErrorHandler;
}

export class StatusRenderer extends React.Component<IJulynterStatusProps> {
  chooseMessageIcon(): [string, string] {
    try {
      if (!this.props.connectedOnce) {
        return [
          'Julynter did not connect to a notebook',
          'julynter-never-connected-icon julynter-icon',
        ];
      }
      if (!this.props.connectedNow) {
        return [
          'Julynter is not connected to a notebook',
          'julynter-disconnected-icon julynter-icon',
        ];
      }
      if (!this.props.hasKernel) {
        return ['Kernel not found', 'julynter-kernel-off-icon julynter-icon'];
      }
      return ['Kernel connected', 'julynter-kernel-on-icon julynter-icon'];
    } catch (error) {
      throw this.props.errorHandler.report(
        error,
        'StatusRenderer:chooseMessageIcon',
        []
      );
    }
  }

  clickError(): void {
    try {
      const text = this.props.errorHandler.errorStack.join('\n\n');

      showDialog({
        title: 'List of errors',
        body: (
          <div>
            <div>Please, submit the following log as a Bug report to</div>
            <div>
              <a
                target="_blank"
                href="https://github.com/dew-uff/julynter/issues"
              >
                https://github.com/dew-uff/julynter/issues
              </a>
            </div>
            <textarea className="julynter-error-text" value={text} />
            <div>* Check the Browser console as well.</div>
          </div>
        ),
        buttons: [
          Dialog.cancelButton({ label: 'Dismiss' }),
          Dialog.okButton({ label: 'Clear' }),
        ],
      }).then((result) => {
        Promise.resolve(result.button.accept).then((ok: boolean) => {
          try {
            if (ok) {
              this.props.errorHandler.clear();
              this.forceUpdate();
            }
          } catch (error) {
            throw this.props.errorHandler.report(
              error,
              'StatusRenderer:clickError.ok',
              [ok]
            );
          }
        });
      });
    } catch (error) {
      throw this.props.errorHandler.report(
        error,
        'StatusRenderer:clickError',
        []
      );
    }
  }

  render(): JSX.Element | null {
    try {
      const [message, icon] = this.chooseMessageIcon();
      let exp: JSX.Element = null;
      let error: JSX.Element = null;
      if (this.props.experiment) {
        exp = <span title="Experiment is Active">e</span>;
      }
      if (this.props.errorHandler.errorStack.length > 0) {
        error = (
          <span
            className="julynter-error-display"
            onClick={this.clickError.bind(this)}
            title="Click to see errors"
          >
            [Error]
          </span>
        );
      }

      return (
        <div className="jp-Julynter-kernel">
          {error}
          {exp}
          <div
            role="text"
            aria-label={message}
            title={message}
            className={icon}
          />
        </div>
      );
    } catch (error) {
      throw this.props.errorHandler.report(error, 'StatusRenderer:render', []);
    }
  }
}
