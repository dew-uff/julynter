import * as React from 'react';

import { ReactWidget } from '@jupyterlab/apputils';

import { IReport } from '../../linter/interfaces';
import { NotebookHandler } from '../notebookhandler';
import { ErrorHandler } from '../errorhandler';
import { CellWidget } from './cellwidget';
import { LintAction } from './lintaction';
import { ERROR_TYPES_MAP } from '../../linter/reports';
import { minusIcon, plusIcon, feedbackIcon, toggleDownIcon, toggleRightIcon } from '../../iconimports';


interface IItemProps {
  item: IReport;
  notebook: NotebookHandler;
  errorHandler: ErrorHandler;
  cellLints: { [num: string]: CellWidget };
}


export class ItemWidget extends ReactWidget {
  item: IReport;
  notebook: NotebookHandler;
  errorHandler: ErrorHandler;
  cellLints: { [num: string]: CellWidget };
  action: LintAction;

  constructor(options: IItemProps) {
    super();
    this.item = options.item;
    this.notebook = options.notebook;
    this.errorHandler = options.errorHandler;
    this.cellLints = options.cellLints;
    this.action = new LintAction(options.item, options.notebook, options.errorHandler, this.update.bind(this));
    if (this.item.cellId in this.cellLints) {
      this.cellLints[this.item.cellId].add(this.action);
    }
  }

  createFeedback(): JSX.Element {
    const item: IReport = this.item;
    if (
      item.feedback &&
      this.notebook.experimentManager.config.enabled
    ) {
      const negativeClass =
        'julynter-feedback-icon ' +
        (item.feedback & 2 ? ' julynter-feedback-icon-selected' : '');
      const positiveClass =
        'julynter-feedback-icon ' +
        (item.feedback & 4 ? ' julynter-feedback-icon-selected' : '');

      return (
        <div className="julynter-feedback">
          <span className="julynter-feedback-text">Experiment Feedback:</span>
          <div className="julynter-feedback-buttons">
            <div
              className="julynter-feedback-button"
              title="I do not like this lint"
              onClick={this.action.handle(this.action.negativeFeedback)}
            >
              <minusIcon.react 
                className={negativeClass}
                tag="div"
                width="24px"
                height="24px"
              />
            </div>
            <div
              className="julynter-feedback-button"
              title="I like this lint"
              onClick={this.action.handle(this.action.positiveFeedback)}
            >
              <plusIcon.react 
                className={positiveClass}
                tag="div"
                width="24px"
                height="24px"
              />
            </div>

            <div
              className="julynter-feedback-button"
              title="Send a text feedback about this lint"
              onClick={this.action.handle(this.action.messageFeedback)}
            >
              <feedbackIcon.react 
                className="julynter-feedback-icon"
                tag="div"
                width="24px"
                height="24px"
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
      const item: IReport = this.item;
      if (!item.visible || item.filteredOut) {
        return null;
      }
      const reportDivClass = item.hasParent
        ? 'julynter-report-div julynter-has-parent'
        : 'julynter-report-div';
      let prefix = null;
      let twistButton = null;
      let fontSize = 'julynter-normal-size';
      let feedbackDiv = this.createFeedback();

      if (
        this.notebook.options.checkMode() !== 'type' &&
        item.type !== 'group'
      ) {
        prefix = ERROR_TYPES_MAP[item.reportType].label + " - ";
      }

      if (item.collapsed) {
        fontSize = 'julynter-title-size';
        twistButton = (
          <div className="julynter-collapse-button">
            <div className="julynter-twist-placeholder">placeholder</div>
            <div className="julynter-rightarrow-img julynter-arrow-img" />
            <toggleRightIcon.react tag="div" className="julynter-arrow-img"/>
          </div>
        );
      } else if (item.collapsed === false) {
        fontSize = 'julynter-title-size';
        twistButton = (
          <div className="julynter-collapse-button">
            <div className="julynter-twist-placeholder">placeholder</div>
            <toggleDownIcon.react tag="div" className="julynter-arrow-img"/>
          </div>
        );
      }

      const reportPromptClass = 'julynter-report-prompt ' + fontSize;
      return (
        <div className="julynter-list-item" onClick={this.action.handle(this.action.click)}>
          <div
            className="julynter-entry-holder"
            title={this.item.suggestion}
            onContextMenu={this.action.contextMenu.bind(this.action)}
          >
            {twistButton}
            <div className={reportDivClass}>
              <div className={reportPromptClass}>
                <div>{prefix} {item.text}</div>
                {feedbackDiv}
              </div>
            </div>
          </div>
        </div>
      );
    } catch (error) {
      throw this.errorHandler.report(error, 'ItemWidget:render', []);
    }
  }
}
