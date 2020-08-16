import * as React from 'react';

import { CommandRegistry } from '@lumino/commands';
import { ContextMenu } from '@lumino/widgets';
import { Clipboard, Dialog, showDialog } from '@jupyterlab/apputils';
import { IReport } from '../../linter/interfaces';
import { NotebookHandler } from '../notebookhandler';
import { ErrorHandler } from '../errorhandler';
import { FeedbackDialogRenderer, showTextDialog } from './feedbackrenderer';

export class LintAction {
  item: IReport;
  notebook: NotebookHandler;
  errorHandler: ErrorHandler;
  update: () => void;
  source: string;

  constructor(
    item: IReport,
    notebook: NotebookHandler,
    errorHandler: ErrorHandler,
    update: () => void,
    source: string
  ) {
    this.item = item;
    this.notebook = notebook;
    this.errorHandler = errorHandler;
    this.update = update;
    this.source = source;
    this.handle = this.handle.bind(this);
  }

  clone(newSource: string): LintAction {
    return new LintAction(
      this.item,
      this.notebook,
      this.errorHandler,
      this.update,
      newSource
    );
  }

  handle(action: () => void) {
    return (event: React.SyntheticEvent<HTMLSpanElement>): void => {
      event.preventDefault();
      event.stopPropagation();
      action.bind(this)();
    };
  }

  click(): void {
    try {
      const notebook = this.notebook;
      notebook.experimentManager.reportLintClick(
        notebook,
        this.item,
        this.source
      );
      this.item.boundAction();
    } catch (error) {
      throw this.errorHandler.report(error, 'LintAction:click', []);
    }
  }

  why(): void {
    try {
      const action = this.clone(this.source + '-why');
      const item = this.item;
      let suggestion = null;
      if (item.suggestion) {
        suggestion = <li>Suggestion: {item.suggestion}</li>;
      }
      const body = (
        <div>
          <ul className="julynter-feedback-ul">
            <li>{item.reason}</li>
            <li>
              <br />
            </li>
            {suggestion}
          </ul>
        </div>
      );
      showDialog({
        title:
          item.reportId === 'group'
            ? item.text
            : item.reportId + ' - ' + item.text,
        body: body,
        buttons: [
          Dialog.cancelButton(),
          Dialog.okButton({ label: item.action.label }),
        ],
      }).then((result) => {
        Promise.resolve(result.button.accept).then((ok: boolean) => {
          try {
            if (ok) {
              action.click();
            }
          } catch (error) {
            throw this.errorHandler.report(error, 'LintAction:why.then', [
              this.source,
              ok,
            ]);
          }
        });
      });
    } catch (error) {
      throw this.errorHandler.report(error, 'LintAction:why', [this.source]);
    }
  }

  populateMenu(
    commands: CommandRegistry,
    contextMenu: ContextMenu,
    postfix = ''
  ): ContextMenu {
    try {
      const item = this.item;

      commands.addCommand('action' + postfix, {
        label: item.action.label,
        caption: item.action.title,
        execute: this.click.bind(this),
      });
      contextMenu.addItem({
        command: 'action' + postfix,
        selector: '*',
      });
      commands.addCommand('copy' + postfix, {
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
            throw this.errorHandler.report(
              error,
              'LintAction:contextMenu.copy',
              [this.source, item]
            );
          }
        },
      });
      contextMenu.addItem({
        command: 'copy' + postfix,
        selector: '*',
      });
      let hideTitle = `Filter out lint ${item.reportId}`;
      let hideMessage =
        'Are you sure you want to filter out ' +
        `lints with the id "${item.reportId}"?`;
      const hideInfo = (
        <ul className="julynter-feedback-ul">
          <li>Message: {item.text}</li>
          <li>Suggestion: {item.suggestion}</li>
        </ul>
      );
      let hideExample = (
        <div>
          Example of instance:
          {hideInfo}
        </div>
      );

      if (item.reportId !== 'group') {
        commands.addCommand('hidethis' + postfix, {
          label: 'Filter out this lint',
          caption: 'Filter out this lint',
          execute: () => {
            showDialog({
              title: 'Filter out this lint',
              body: (
                <div>
                  <div> Are you sure you want to filter out this lint? </div>
                  <div> {hideInfo} </div>
                </div>
              ),
              buttons: [
                Dialog.cancelButton(),
                Dialog.okButton({ label: 'Yes' }),
              ],
            }).then((result) => {
              Promise.resolve(result.button.accept).then((ok: boolean) => {
                try {
                  console.log(ok);
                  if (ok) {
                    this.notebook.options.addLintFilter(item.hash);
                  }
                } catch (error) {
                  throw this.errorHandler.report(
                    error,
                    'LintAction:contextMenu.hidethis',
                    [this.source, ok, item]
                  );
                }
              });
            });
          },
        });
        contextMenu.addItem({
          command: 'hidethis' + postfix,
          selector: '*',
        });
      }

      if (item.reportId === 'group') {
        hideTitle = `Filter out lint type ${item.text}`;
        hideMessage =
          'Are you sure you want to filter out' +
          `lints with the type "${item.text}"?`;
        hideExample = null;
      }

      commands.addCommand('hide' + postfix, {
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
                  this.notebook.options.updateReport(item.reportId, false);
                } else if (ok) {
                  this.notebook.options.updateType(item.reportType, false);
                }
              } catch (error) {
                throw this.errorHandler.report(
                  error,
                  'LintAction:contextMenu.hide',
                  [this.source, ok, item]
                );
              }
            });
          });
        },
      });
      contextMenu.addItem({
        command: 'hide' + postfix,
        selector: '*',
      });

      if (this.item.feedback) {
        contextMenu.addItem({
          type: 'separator',
          selector: '*',
        });
        const neg = item.feedback & 2 ? 'Undo' : 'Send';
        commands.addCommand('negative' + postfix, {
          label: `${neg} negative feedback`,
          caption: `${neg} feedback indicating that you do not like this lint`,
          execute: this.negativeFeedback.bind(this),
        });
        contextMenu.addItem({
          command: 'negative' + postfix,
          selector: '*',
        });
        const pos = item.feedback & 4 ? 'Undo' : 'Send';
        commands.addCommand('positive' + postfix, {
          label: `${pos} positive feedback`,
          caption: `${pos} feedback indicating that you like this lint`,
          execute: this.positiveFeedback.bind(this),
        });
        contextMenu.addItem({
          command: 'positive' + postfix,
          selector: '*',
        });
        commands.addCommand('feedback' + postfix, {
          label: 'Send feedback',
          caption: 'Send a textual feedback',
          execute: this.messageFeedback.bind(this),
        });
        contextMenu.addItem({
          command: 'feedback' + postfix,
          selector: '*',
        });
      }
      return contextMenu;
    } catch (error) {
      throw this.errorHandler.report(error, 'LintAction:createMenu', [
        this.source,
      ]);
    }
  }

  contextMenu(event: React.MouseEvent<HTMLDivElement>): void {
    try {
      const action = this.clone(this.source + '-menu');
      const commands = new CommandRegistry();
      const contextMenu = new ContextMenu({ commands: commands });
      const item = this.item;

      commands.addCommand('info', {
        label:
          (item.reportId === 'group' ? item.text : item.reportId) + ' - Why?',
        caption: 'Why is this lint showing?',
        className: 'julynter-context-info',
        execute: action.why.bind(action),
      });
      contextMenu.addItem({
        command: 'info',
        selector: '*',
      });
      contextMenu.addItem({
        type: 'separator',
        selector: '*',
      });
      action.populateMenu(commands, contextMenu);
      contextMenu.open(event as any);
      event.preventDefault();
      event.stopPropagation();
    } catch (error) {
      throw this.errorHandler.report(error, 'LintAction:contextMenu', [
        this.source,
      ]);
    }
  }

  negativeFeedback(): void {
    try {
      const notebook = this.notebook;
      const item = this.item;
      const em = notebook.experimentManager;
      if (item.feedback & 2) {
        em.reportFeedback(notebook, item, '<<negate-negative>>', this.source);
        item.feedback -= 2;
      } else {
        em.reportFeedback(notebook, item, '<<negative>>', this.source);
        item.feedback |= 2;
      }

      this.update();
    } catch (error) {
      throw this.errorHandler.report(error, 'LintAction:negativeFeedback', [
        this.source,
      ]);
    }
  }

  positiveFeedback(): void {
    try {
      const notebook = this.notebook;
      const item = this.item;
      const em = notebook.experimentManager;
      if (item.feedback & 4) {
        em.reportFeedback(notebook, item, '<<negate-positive>>', this.source);
        item.feedback -= 4;
      } else {
        em.reportFeedback(notebook, item, '<<positive>>', this.source);
        item.feedback |= 4;
      }
      this.update();
    } catch (error) {
      throw this.errorHandler.report(error, 'LintAction:positiveFeedback', [
        this.source,
      ]);
    }
  }

  messageFeedback(): void {
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
        <FeedbackDialogRenderer item={this.item} onChange={onChange} />
      );
      const notebook = this.notebook;
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
                this.item,
                dialogResult,
                this.source
              );
            }
          } catch (error) {
            throw this.errorHandler.report(
              error,
              'LintAction:messageFeedback.then',
              [this.source, ok, dialogResult]
            );
          }
        });
      });
    } catch (error) {
      throw this.errorHandler.report(error, 'LintAction:messageFeedback', [
        this.source,
      ]);
    }
  }
}
