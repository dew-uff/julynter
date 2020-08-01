import * as React from 'react';
import { ErrorHandler } from '../errorhandler';
import { showDialog, Dialog } from '@jupyterlab/apputils';
import { LabIcon } from '@jupyterlab/ui-components';
import { neverconnectedIcon, disconnectedIcon, kerneloffIcon, kernelonIcon } from '../../iconimports';

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
  chooseMessageIcon(): [string, LabIcon] {
    try {
      if (!this.props.connectedOnce) {
        return [
          'Julynter did not connect to a notebook',
          neverconnectedIcon,
        ];
      }
      if (!this.props.connectedNow) {
        return [
          'Julynter is not connected to a notebook',
          disconnectedIcon,
        ];
      }
      if (!this.props.hasKernel) {
        return ['Kernel not found', kerneloffIcon];
      }
      return ['Kernel connected', kernelonIcon];
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
        <div className="jp-Julynter-kernel" title={message}>
          {error}
          {exp}
          <icon.react
            tag="div"
            className="julynter-icon"
            width="12px"
            height="12px"
          />
        </div>
      );
    } catch (error) {
      throw this.props.errorHandler.report(error, 'StatusRenderer:render', []);
    }
  }
}
