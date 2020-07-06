import * as React from 'react';

import { CommandRegistry } from '@lumino/commands';
import { ContextMenu } from '@lumino/widgets';
import { Clipboard, Dialog, showDialog } from '@jupyterlab/apputils';

import { IReport } from '../../linter/interfaces';
import { NotebookHandler } from '../notebookhandler';
import {
  FeedbackDialogRenderer,
  showTextDialog,
} from './feedbackrenderer'; /* eslint @typescript-eslint/no-unused-vars: 0 */
import { ErrorHandler } from '../errorhandler';

interface IItemProps {
  item: IReport;
  notebook: NotebookHandler;
  errorHandler: ErrorHandler;
}

export class ItemRenderer extends React.Component<IItemProps> {
  constructor(props: IItemProps) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  doClick(): void {
    try {
      const notebook = this.props.notebook;
      notebook.experimentManager.reportLintClick(notebook, this.props.item);
      this.props.item.boundAction();
    } catch (error) {
      throw this.props.errorHandler.report(error, 'ItemRenderer:doClick', []);
    }
  }

  handleClick(event: React.SyntheticEvent<HTMLSpanElement>): void {
    event.preventDefault();
    event.stopPropagation();
    this.doClick();
  }

  doNegativeFeedback(): void {
    try {
      const notebook = this.props.notebook;
      const item = this.props.item;
      const em = notebook.experimentManager;
      if (item.feedback & 2) {
        em.reportFeedback(notebook, item, '<<negate-negative>>');
        item.feedback -= 2;
      } else {
        em.reportFeedback(notebook, item, '<<negative>>');
        item.feedback |= 2;
      }

      this.forceUpdate();
    } catch (error) {
      throw this.props.errorHandler.report(
        error,
        'ItemRenderer:doNegativeFeedback',
        []
      );
    }
  }

  negativeFeedback(event: React.SyntheticEvent<HTMLSpanElement>): void {
    event.preventDefault();
    event.stopPropagation();
    this.doNegativeFeedback();
  }

  doPositiveFeedback(): void {
    try {
      const notebook = this.props.notebook;
      const item = this.props.item;
      const em = notebook.experimentManager;
      if (item.feedback & 4) {
        em.reportFeedback(notebook, item, '<<negate-positive>>');
        item.feedback -= 4;
      } else {
        em.reportFeedback(notebook, item, '<<positive>>');
        item.feedback |= 4;
      }
      this.forceUpdate();
    } catch (error) {
      throw this.props.errorHandler.report(
        error,
        'ItemRenderer:doPositiveFeedback',
        []
      );
    }
  }

  positiveFeedback(event: React.SyntheticEvent<HTMLSpanElement>): void {
    event.preventDefault();
    event.stopPropagation();
    this.doPositiveFeedback();
  }

  doMessageFeedback(): void {
    let dialogResult = '';
    const onChange = (
      event: React.SyntheticEvent<HTMLTextAreaElement>
    ): void => {
      event.preventDefault();
      event.stopPropagation();
      dialogResult = event.currentTarget.value;
    };
    try {
      const body = (
        <FeedbackDialogRenderer item={this.props.item} onChange={onChange} />
      );
      const notebook = this.props.notebook;
      showTextDialog({
        title: 'Send Feedback',
        body: body,
        buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Send' })],
      }).then((result) => {
        Promise.resolve(result.button.accept).then((ok: boolean) => {
          try {
            if (ok && dialogResult) {
              notebook.experimentManager.reportFeedback(
                notebook,
                this.props.item,
                dialogResult
              );
            }
          } catch (error) {
            throw this.props.errorHandler.report(
              error,
              'ItemRenderer:doMessageFeedback.then',
              [ok, dialogResult]
            );
          }
        });
      });
    } catch (error) {
      throw this.props.errorHandler.report(
        error,
        'ItemRenderer:doMessageFeedback',
        []
      );
    }
  }

  messageFeedback(event: React.SyntheticEvent<HTMLSpanElement>): void {
    event.preventDefault();
    event.stopPropagation();
    this.doMessageFeedback();
  }

  onContextMenu(event: React.MouseEvent<HTMLDivElement>): void {
    try {
      const commands = new CommandRegistry();
      const contextMenu = new ContextMenu({ commands: commands });
      const item = this.props.item;

      commands.addCommand('info', {
        label: item.reportId === 'group' ? item.text : item.reportId,
        caption: item.action.title,
        className: 'julynter-context-info',
        execute: () => {
          return;
        },
      });
      contextMenu.addItem({
        command: 'info',
        selector: '*',
      });
      contextMenu.addItem({
        type: 'separator',
        selector: '*',
      });
      commands.addCommand('action', {
        label: item.action.label,
        caption: item.action.title,
        execute: this.doClick.bind(this),
      });
      contextMenu.addItem({
        command: 'action',
        selector: '*',
      });
      commands.addCommand('copy', {
        label: 'Copy lint',
        caption: 'Copy lint text',
        execute: () => {
          try {
            const id = item.reportId;
            const text = item.text;
            const suggestion = item.suggestion || 'N/A';
            Clipboard.copyToSystem(
              `ID: ${id}\nMessage: ${text}\nSuggestion: ${suggestion}`
            );
          } catch (error) {
            throw this.props.errorHandler.report(
              error,
              'ItemRenderer:onContextMenu.copy',
              [item]
            );
          }
        },
      });
      contextMenu.addItem({
        command: 'copy',
        selector: '*',
      });
      let hideTitle = `Filter out lint ${item.reportId}`;
      let hideMessage =
        'Are you sure you want to filter out' +
        `lints with the id "${item.reportId}"?`;
      let hideExample = (
        <div>
          Example of instance:
          <ul className="julynter-feedback-ul">
            <li>Message: {item.text}</li>
            <li>Suggestion: {item.suggestion}</li>
          </ul>
        </div>
      );
      if (item.reportId === 'group') {
        hideTitle = `Filter out lint type ${item.text}`;
        hideMessage =
          'Are you sure you want to filter out' +
          `lints with the type "${item.text}"?`;
        hideExample = null;
      }

      commands.addCommand('hide', {
        label: 'Filter out similar lints',
        caption: 'Filter out this type of lint',
        execute: () => {
          showDialog({
            title: hideTitle,
            body: (
              <div>
                <div> {hideMessage} </div>
                {hideExample}
              </div>
            ),
            buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Yes' })],
          }).then((result) => {
            Promise.resolve(result.button.accept).then((ok: boolean) => {
              try {
                if (ok && item.reportId !== 'group') {
                  this.props.notebook.options.updateReport(
                    item.reportId,
                    false
                  );
                } else if (ok) {
                  this.props.notebook.options.updateType(
                    item.reportType,
                    false
                  );
                }
              } catch (error) {
                throw this.props.errorHandler.report(
                  error,
                  'ItemRenderer:onContextMenu.hide',
                  [ok, item]
                );
              }
            });
          });
        },
      });
      contextMenu.addItem({
        command: 'hide',
        selector: '*',
      });

      if (this.props.item.feedback) {
        contextMenu.addItem({
          type: 'separator',
          selector: '*',
        });
        const neg = item.feedback & 2 ? 'Undo' : 'Send';
        commands.addCommand('negative', {
          label: `${neg} negative feedback`,
          caption: `${neg} feedback indicating that you do not like this lint`,
          execute: this.doNegativeFeedback.bind(this),
        });
        contextMenu.addItem({
          command: 'negative',
          selector: '*',
        });
        const pos = item.feedback & 4 ? 'Undo' : 'Send';
        commands.addCommand('positive', {
          label: `${pos} positive feedback`,
          caption: `${pos} feedback indicating that you like this lint`,
          execute: this.doPositiveFeedback.bind(this),
        });
        contextMenu.addItem({
          command: 'positive',
          selector: '*',
        });
        commands.addCommand('feedback', {
          label: 'Send feedback',
          caption: 'Send a textual feedback',
          execute: this.doMessageFeedback.bind(this),
        });
        contextMenu.addItem({
          command: 'feedback',
          selector: '*',
        });
      }

      contextMenu.open(event as any);
      event.preventDefault();
      event.stopPropagation();
    } catch (error) {
      throw this.props.errorHandler.report(
        error,
        'ItemRenderer:onContextMenu',
        []
      );
    }
  }

  render(): JSX.Element | null {
    try {
      const item: IReport = this.props.item;
      if (!item.visible || item.filteredOut) {
        return null;
      }
      const reportDivClass = item.hasParent
        ? 'julynter-report-div julynter-has-parent'
        : 'julynter-report-div';
      let twistButton = null;
      let fontSize = 'julynter-normal-size';
      let feedbackDiv = null;

      if (item.collapsed) {
        fontSize = 'julynter-title-size';
        twistButton = (
          <div className="julynter-collapse-button">
            <div className="julynter-twist-placeholder">placeholder</div>
            <div className="julynter-rightarrow-img julynter-arrow-img" />
          </div>
        );
      } else if (item.collapsed === false) {
        fontSize = 'julynter-title-size';
        twistButton = (
          <div className="julynter-collapse-button">
            <div className="julynter-twist-placeholder">placeholder</div>
            <div className="julynter-downarrow-img julynter-arrow-img" />
          </div>
        );
      }

      if (
        item.feedback &&
        this.props.notebook.experimentManager.config.enabled
      ) {
        const negativeClass =
          'julynter-feedback-icon jp-julynter-feedback-negative-icon' +
          (item.feedback & 2 ? ' julynter-feedback-icon-selected' : '');
        const positiveClass =
          'julynter-feedback-icon jp-julynter-feedback-positive-icon' +
          (item.feedback & 4 ? ' julynter-feedback-icon-selected' : '');

        feedbackDiv = (
          <div className="julynter-feedback">
            <span className="julynter-feedback-text">Experiment Feedback:</span>
            <div className="julynter-feedback-buttons">
              <div
                className="julynter-feedback-button"
                onClick={this.negativeFeedback.bind(this)}
              >
                <div
                  role="text"
                  aria-label="I do not like this lint"
                  title="I do not like this lint"
                  className={negativeClass}
                />
              </div>
              <div
                className="julynter-feedback-button"
                onClick={this.positiveFeedback.bind(this)}
              >
                <div
                  role="text"
                  aria-label="I like this lint"
                  title="I like this lint"
                  className={positiveClass}
                />
              </div>

              <div
                className="julynter-feedback-button"
                onClick={this.messageFeedback.bind(this)}
              >
                <div
                  role="text"
                  aria-label="Send a text feedback about this lint"
                  title="Send a text feedback about this lint"
                  className="julynter-feedback-icon jp-julynter-feedback-text-icon"
                />
              </div>
            </div>
          </div>
        );
      }
      const reportPromptClass = 'julynter-report-prompt ' + fontSize;
      return (
        <li onClick={this.handleClick}>
          <div
            className="julynter-entry-holder"
            title={this.props.item.suggestion}
            onContextMenu={this.onContextMenu.bind(this)}
          >
            {twistButton}
            <div className={reportDivClass}>
              <div className={reportPromptClass}>
                <div>{item.text}</div>
                {feedbackDiv}
              </div>
            </div>
          </div>
        </li>
      );
    } catch (error) {
      throw this.props.errorHandler.report(error, 'ItemRenderer:render', []);
    }
  }
}
