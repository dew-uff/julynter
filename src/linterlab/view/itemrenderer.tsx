import * as React from 'react';

import { ReactWidget } from '@jupyterlab/apputils';

import { IReport } from '../../linter/interfaces';
import { NotebookHandler } from '../notebookhandler';
import { ErrorHandler } from '../errorhandler';
import { CellWidget } from './cellwidget';
import { LintAction } from './lintaction';


interface IItemProps {
  item: IReport;
  notebook: NotebookHandler;
  errorHandler: ErrorHandler;
  cellLints: { [num: string]: CellWidget };
}


export class ItemWidget extends ReactWidget {
  props: IItemProps;
  action: LintAction;

  constructor(options: IItemProps) {
    super();
    this.props = options;
    this.action = new LintAction(options.item, options.notebook, options.errorHandler, this.update.bind(this));
    if (this.props.item.cellId in this.props.cellLints) {
      this.props.cellLints[this.props.item.cellId].add(this.action);
    }
  }

  createFeedback(): JSX.Element {
    const item: IReport = this.props.item;
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

      return (
        <div className="julynter-feedback">
          <span className="julynter-feedback-text">Experiment Feedback:</span>
          <div className="julynter-feedback-buttons">
            <div
              className="julynter-feedback-button"
              onClick={this.action.handle(this.action.negativeFeedback)}
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
              onClick={this.action.handle(this.action.positiveFeedback)}
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
              onClick={this.action.handle(this.action.messageFeedback)}
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
    return null;
  }

  protected render(): JSX.Element {
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
      let feedbackDiv = this.createFeedback();

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

      const reportPromptClass = 'julynter-report-prompt ' + fontSize;
      return (
        <div className="julynter-list-item" onClick={this.action.handle(this.action.click)}>
          <div
            className="julynter-entry-holder"
            title={this.props.item.suggestion}
            onContextMenu={this.action.contextMenu.bind(this.action)}
          >
            {twistButton}
            <div className={reportDivClass}>
              <div className={reportPromptClass}>
                <div>{item.text}</div>
                {feedbackDiv}
              </div>
            </div>
          </div>
        </div>
      );
    } catch (error) {
      throw this.props.errorHandler.report(error, 'ItemWidget:render', []);
    }
  }
}
