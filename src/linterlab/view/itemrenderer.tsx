import * as React from 'react';
import { CommandRegistry } from '@lumino/commands';
import { ContextMenu } from '@lumino/widgets';
import { IReport } from '../../linter/interfaces';
import { NotebookHandler } from '../notebookhandler';
import { Dialog, Clipboard, showDialog } from '@jupyterlab/apputils';

import { showTextDialog, FeedbackDialogRenderer } from './feedbackrenderer';

interface IItemProps {
  item: IReport;
  notebook: NotebookHandler;
}

export class ItemRenderer extends React.Component<IItemProps> {

  constructor(props: IItemProps) {
    super(props);
    this.handleClick = this.handleClick.bind(this)
  }

  doClick(): void {
    const notebook = this.props.notebook;
    notebook.experimentManager.reportLintClick(notebook, this.props.item);
    this.props.item.boundAction();
  }

  handleClick(event: React.SyntheticEvent<HTMLSpanElement>): void {
    event.preventDefault();
    event.stopPropagation();
    this.doClick();
  }

  doNegativeFeedback(): void {
    const notebook = this.props.notebook;
    if (this.props.item.feedback & 2) {
      notebook.experimentManager.reportFeedback(notebook, this.props.item, '<<negate-negative>>');
      this.props.item.feedback -= 2;
    } else {
      notebook.experimentManager.reportFeedback(notebook, this.props.item, '<<negative>>');
      this.props.item.feedback |= 2;
    }
    
    this.forceUpdate();
  }
  
  negativeFeedback(event: React.SyntheticEvent<HTMLSpanElement>): void {
    event.preventDefault();
    event.stopPropagation();
    this.doNegativeFeedback();
  }  

  doPositiveFeedback(): void {
    const notebook = this.props.notebook;
    if (this.props.item.feedback & 4) {
      notebook.experimentManager.reportFeedback(notebook, this.props.item, '<<negate-positive>>');
      this.props.item.feedback -= 4;
    } else {
      notebook.experimentManager.reportFeedback(notebook, this.props.item, '<<positive>>');
      this.props.item.feedback |= 4;
    }
    this.forceUpdate();
  }

  positiveFeedback(event: React.SyntheticEvent<HTMLSpanElement>): void {
    event.preventDefault();
    event.stopPropagation();
    this.doPositiveFeedback();
  }

  doMessageFeedback(): void {
    let dialogResult = '';
    const onChange = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dialogResult = event.currentTarget.value;
    }
    const body = <FeedbackDialogRenderer item={this.props.item} onChange={onChange}/>
    const notebook = this.props.notebook;
    showTextDialog({
      title: 'Send Feedback',
      body: body,
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Send' })]
    }).then(result => {
      Promise.resolve(result.button.accept).then((ok: boolean) => {
        if (ok && dialogResult) {
          notebook.experimentManager.reportFeedback(notebook, this.props.item, dialogResult);
        }
      })
    });
  }

  messageFeedback(event: React.SyntheticEvent<HTMLSpanElement>): void {
    event.preventDefault();
    event.stopPropagation();
    this.doMessageFeedback();
  }

  onContextMenu(event: React.MouseEvent<HTMLDivElement>): void {
    const commands = new CommandRegistry();
    const contextMenu = new ContextMenu({commands: commands});
    const item = this.props.item;

    commands.addCommand('info', {
      label: item.report_id == 'group'? item.text : item.report_id,
      caption: item.action.title,
      className: 'julynter-context-info',
      execute: null
    });
    contextMenu.addItem({
      command: 'info',
      selector: '*'
    })
    contextMenu.addItem({
      type: 'separator',
      selector: '*'
    })
    commands.addCommand('action', {
      label: item.action.label,
      caption: item.action.title,
      execute: this.doClick.bind(this)
    });
    contextMenu.addItem({
      command: 'action',
      selector: '*'
    })
    commands.addCommand('copy', {
      label: 'Copy lint',
      caption: 'Copy lint text',
      execute: () => {
        Clipboard.copyToSystem(`ID: ${item.report_id}\nMessage: ${item.text}\nSuggestion: ${item.suggestion || 'N/A'}`)
      }
    });
    contextMenu.addItem({
      command: 'copy',
      selector: '*'
    })
    commands.addCommand('hide', {
      label: 'Filter out similar lints',
      caption: 'Filter out this type of lint',
      execute: () => {
        showDialog({
          title: `Filter out lint ${item.report_id}`,
          body: <div>
            <div>
              Are you sure you want to filter out lints with the id {item.report_id}?
            </div>
            <div>
              Example of instance:
              <ul className='julynter-feedback-ul'>
                <li>Message: {item.text}</li>
                <li>Suggestion: {item.suggestion}</li>
              </ul>
            </div>
          </div>,
          buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Yes' })]
        }).then(result => {
            Promise.resolve(result.button.accept).then((ok: boolean) => {
              if (ok && (item.report_id !== 'group')) {
                this.props.notebook.options.updateReport(item.report_id, false);
              }
            });
        });
      }
    });
    contextMenu.addItem({
      command: 'hide',
      selector: '*'
    })

    if (this.props.item.feedback) {
      contextMenu.addItem({
        type: 'separator',
        selector: '*'
      })
      const neg = item.feedback & 2? 'Undo': 'Send';
      commands.addCommand('negative', {
        label: `${neg} negative feedback`,
        caption: `${neg} feedback indicating that you do not like this lint`,
        execute: this.doNegativeFeedback.bind(this)
      });
      contextMenu.addItem({
        command: 'negative',
        selector: '*'
      })
      const pos = item.feedback & 4? 'Undo': 'Send';
      commands.addCommand('positive', {
        label: `${pos} positive feedback`,
        caption: `${pos} feedback indicating that you like this lint`,
        execute: this.doPositiveFeedback.bind(this)
      });
      contextMenu.addItem({
        command: 'positive',
        selector: '*'
      })
      commands.addCommand('feedback', {
        label: 'Send feedback',
        caption: 'Send a textual feedback',
        execute: this.doMessageFeedback.bind(this)
      });
      contextMenu.addItem({
        command: 'feedback',
        selector: '*'
      })

    }

    
    contextMenu.open(event as any);
    event.preventDefault();
    event.stopPropagation(); 
  }



  render(): JSX.Element | null {
    const item: IReport = this.props.item;
    if (!item.visible || item.filtered_out) {
      return null;
    }
    const report_div_class = item.has_parent ? 'julynter-report-div julynter-has-parent' : 'julynter-report-div';
    let twistButton = null;
    let fontSize = 'julynter-normal-size';
    let feedbackDiv = null;

    if (item.collapsed) {
      fontSize = 'julynter-title-size'
      twistButton = (
        <div className='julynter-collapse-button'>
          <div className='julynter-twist-placeholder'>placeholder</div>
          <div className='julynter-rightarrow-img julynter-arrow-img' />
        </div>
      )
    } else if (item.collapsed === false) {
      fontSize = 'julynter-title-size'
      twistButton = (
        <div className='julynter-collapse-button'>
          <div className='julynter-twist-placeholder'>placeholder</div>
          <div className='julynter-downarrow-img julynter-arrow-img' />
        </div>
      )
    }

    if (item.feedback && this.props.notebook.experimentManager.config.enabled) {

      const negativeSelected = item.feedback & 2? ' julynter-feedback-icon-selected' : '';
      const positiveSelected = item.feedback & 4? ' julynter-feedback-icon-selected' : '';

      const negativeClass = 'julynter-feedback-icon jp-julynter-feedback-negative-icon' + negativeSelected;
      const positiveClass = 'julynter-feedback-icon jp-julynter-feedback-positive-icon' + positiveSelected;

      feedbackDiv = <div className='julynter-feedback'>
        <span className='julynter-feedback-text'>Experiment Feedback: </span>
        <div className='julynter-feedback-buttons'>
          <div
            className='julynter-feedback-button'
            onClick={this.negativeFeedback.bind(this)}
          >
            <div
              role='text'
              aria-label='I do not like this lint'
              title='I do not like this lint'
              className={negativeClass}
            />
          </div>
          <div
            className='julynter-feedback-button'
            onClick={this.positiveFeedback.bind(this)}
          >
            <div
              role='text'
              aria-label='I like this lint'
              title='I like this lint'
              className={positiveClass}
            />
          </div>
          
          <div
            className='julynter-feedback-button'
            onClick={this.messageFeedback.bind(this)}
          >
            <div
              role='text'
              aria-label='Send a text feedback about this lint'
              title='Send a text feedback about this lint'
              className='julynter-feedback-icon jp-julynter-feedback-text-icon'
            />
          </div>
        </div>
      </div>;
    }
    const report_prompt_class = 'julynter-report-prompt ' + fontSize;
    return <li onClick={this.handleClick}>
      <div className='julynter-entry-holder' title={this.props.item.suggestion} onContextMenu={this.onContextMenu.bind(this)}>
        {twistButton}
        <div className={report_div_class}>
          <div className={report_prompt_class}>
            <div>{item.text}</div>
            {feedbackDiv}
          </div>
        </div>
      </div>
    </li>;
  }
}
