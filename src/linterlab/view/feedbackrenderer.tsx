import * as React from 'react';

import { Dialog } from '@jupyterlab/apputils';

import { IReport } from '../../linter/interfaces';

export class TextDialog<T> extends Dialog<T> {
  handleEvent(event: Event): void {
    switch (event.type) {
      case 'keydown':
        this._evtKeydown(event as KeyboardEvent);
        break;
      case 'click':
        this._evtClick(event as MouseEvent);
        break;
      case 'focus':
        this._evtFocus(event as FocusEvent);
        break;
      case 'contextmenu':
        event.preventDefault();
        event.stopPropagation();
        break;
      default:
        break;
    }
  }

  protected _evtKeydown(event: KeyboardEvent): void {
    if (event.keyCode !== 13) {
      super._evtKeydown(event);
    }
  }
}

export function showTextDialog<T>(
  options: Partial<Dialog.IOptions<T>> = {}
): Promise<Dialog.IResult<T>> {
  const dialog = new TextDialog(options);
  return dialog.launch();
}

interface IFeedback {
  item: IReport;
  onChange: (event: React.SyntheticEvent<HTMLTextAreaElement>) => void;
}

export class FeedbackDialogRenderer extends React.Component<IFeedback> {
  render(): JSX.Element | null {
    return (
      <div>
        <ul className="julynter-feedback-ul">
          <li>Type: {this.props.item.reportType}</li>
          <li>ID: {this.props.item.reportId}</li>
          <li>Message: {this.props.item.text}</li>
          <li>Suggestion: {this.props.item.suggestion}</li>
          <li>Feedback:</li>
        </ul>
        <textarea
          className="julynter-feedback-textarea"
          onChange={this.props.onChange}
        />
      </div>
    );
  }
}
