import * as React from 'react';

import { Widget } from '@lumino/widgets';

import { ILabShell } from '@jupyterlab/application';
import { showDialog, Dialog, showErrorMessage, ReactWidget } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { INotebookTracker } from '@jupyterlab/notebook';

import { ERROR_TYPES_MAP } from '../../linter/reports';
import { ErrorTypeKey, ErrorTypeKeys, IReport } from '../../linter/interfaces';
import { Config } from '../config';
import { NotebookHandler } from '../notebookhandler';
import { createJulynterConfigWidget } from './julynterconfigwidget';
import { ErrorHandler } from '../errorhandler';
import { configIcon, requirermentsIcon, listIcon, cellIcon, typeIcon, iconMap, eyeIcon, filterIcon } from '../../iconimports';
import { refreshIcon } from '@jupyterlab/ui-components';

interface IToolbarProps {
  notebook: NotebookHandler;
  labShell: ILabShell;
  tracker: INotebookTracker;
  config: Config;
  handlers: { [id: string]: Promise<NotebookHandler> };
  errorHandler: ErrorHandler;
  filtered: IReport[];
}

/**
 * A widget used to rename a file.
 */
class RequirementsHandler extends Widget {
  /**
   * Construct a new "rename" dialog.
   */
  constructor(oldPath: string) {
    const body = document.createElement('div');
    const existingLabel = document.createElement('label');
    existingLabel.textContent = 'Requirements file';
    const existingPath = document.createElement('span');
    existingPath.textContent = oldPath;

    const nameTitle = document.createElement('label');
    nameTitle.textContent = 'New Name';
    nameTitle.className = 'jp-new-name-title';
    const name = document.createElement('input');

    body.appendChild(existingLabel);
    body.appendChild(existingPath);
    body.appendChild(nameTitle);
    body.appendChild(name);

    super({ node: body });
    this.addClass('jp-FileDialog');
    const ext = PathExt.extname(oldPath);
    const value = (this.inputNode.value = PathExt.basename(oldPath));
    this.inputNode.setSelectionRange(0, value.length - ext.length);
  }

  /**
   * Get the input text node.
   */
  get inputNode(): HTMLInputElement {
    return this.node.getElementsByTagName('input')[0] as HTMLInputElement;
  }

  /**
   * Get the value of the widget.
   */
  getValue(): string {
    return this.inputNode.value;
  }
}


export class ToolbarWidget extends ReactWidget {
  
  notebook: NotebookHandler;
  labShell: ILabShell;
  tracker: INotebookTracker;
  config: Config;
  handlers: { [id: string]: Promise<NotebookHandler> };
  errorHandler: ErrorHandler;
  filtered: IReport[];

  constructor(options: IToolbarProps) {
    super();
    this.notebook = options.notebook;
    this.labShell = options.labShell;
    this.tracker = options.tracker;
    this.config = options.config;
    this.handlers = options.handlers;
    this.errorHandler = options.errorHandler;
    this.filtered = options.filtered;
    this.addClass("julynter-toolbar-widget")
  }

  toggle(key: ErrorTypeKey): void {
    try {
      const options = this.notebook.options;
      options.updateType(key, !options.checkType(key));
    } catch (error) {
      throw this.errorHandler.report(error, 'ToolbarWidget:toggle', [
        key,
      ]);
    }
  }

  toggleMode(): void {
    try {
      let mode = this.notebook.options.checkMode();
      if (mode === 'list') {
        mode = 'cell';
      } else if (mode === 'cell') {
        mode = 'type';
      } else {
        mode = 'list';
      }
      this.notebook.options.updateMode(mode);
    } catch (error) {
      throw this.errorHandler.report(
        error,
        'ToolbarWidget:toggleMode',
        []
      );
    }
  }

  toggleView(): void {
    try {
      const options = this.notebook.options;
      options.updateView(!options.checkView());
    } catch (error) {
      throw this.errorHandler.report(error, 'ToolbarWidget:toggleView', []);
    }
  }

  toggleRestart(): void {
    try {
      const options = this.notebook.options;
      options.updateRestart(!options.checkRestart());
    } catch (error) {
      throw this.errorHandler.report(error, 'ToolbarWidget:toggleRestart', []);
    }
  }

  removeFilters(): void {
    try {
      const options = this.notebook.options;
      options.resetFiltered();
    } catch (error) {
      throw this.errorHandler.report(error, 'ToolbarWidget:toggleRestart', []);
    }
  }

  changeRequirements(): Promise<Dialog.IResult<string>> {
    try {
      const options = this.notebook.options;
      return showDialog({
        title: 'Set requirements file',
        body: new RequirementsHandler(options.checkRequirements()),
        focusNodeSelector: 'input',
        buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Set' })],
      }).then((result) => {
        if (!result.value) {
          return;
        }
        const name: string = result.value as string;
        if (name.length === 0 || name.includes(':')) {
          void showErrorMessage(
            'Set Requirements Error',
            Error(
              `"${result.value}" is not a valid name for a file. ` +
                'Names must have nonzero length, ' +
                'and cannot include ":"'
            )
          );
          return null;
        }
        options.updateRequirements(name);
      });
    } catch (error) {
      throw this.errorHandler.report(
        error,
        'ToolbarWidget:changeRequirements',
        []
      );
    }
  }

  configure(): void {
    try {
      this.labShell.add(
        createJulynterConfigWidget(
          this.tracker,
          this.handlers,
          this.config,
          this.notebook,
          this.errorHandler
        ),
        'main'
      );
    } catch (error) {
      throw this.errorHandler.report(
        error,
        'ToolbarWidget:configure',
        []
      );
    }
  }

  private createFilterButtons(): JSX.Element[] {
    let i = 0;
    return ErrorTypeKeys.map((key) => {
      const element = ERROR_TYPES_MAP[key];
      const toggleClass =
        (this.notebook.options.checkType(key)
          ? 'julynter-toolbar-icon-selected'
          : 'julynter-toolbar-icon');
      const icon = iconMap[key];
      return (
        <div
          key={`toolbar-${key}-${i++}`}
          className="julynter-toolbar-button"
          title={element.label}
          onClick={(): void => this.toggle(key)}
        >
          <icon.react elementSize="normal" className={toggleClass} elementPosition="center"/>
        </div>
      );
    });
  }

  private createViewButton(): JSX.Element {
    const toggleClass =
        (this.notebook.options.checkView()
          ? 'julynter-toolbar-icon-selected'
          : 'julynter-toolbar-icon');
    return (
      <div
        className="julynter-toolbar-button"
        title="Toggle view on cells"
        onClick={this.toggleView.bind(this)}
      >
        <eyeIcon.react elementSize="normal" className={toggleClass} elementPosition="center"/>
      </div>
    );
  }

  private createRestartButton(): JSX.Element {
    const toggleClass =
        (this.notebook.options.checkRestart()
          ? 'julynter-toolbar-icon-selected'
          : 'julynter-toolbar-icon');
    return (
      <div
        className="julynter-toolbar-button"
        title="Toggle lints that require a kernel restart"
        onClick={this.toggleRestart.bind(this)}
      >
        <refreshIcon.react elementSize="normal" className={toggleClass} elementPosition="center"/>
      </div>
    );
  }

  private createRestartFilterButton(): JSX.Element {
    let toggleClass = 'julynter-toolbar-icon';
    let element = <span> {this.filtered.length > 99 ? '++' : this.filtered.length} </span>;
    if (this.filtered.length == 0) {
      toggleClass = 'julynter-toolbar-icon-selected';
      element = <span></span>;
    }
    
    return (
      <div
        className="julynter-toolbar-button"
        title="Remove all individual lint filters"
        onClick={this.removeFilters.bind(this)}
      >
        <div className="julynter-toolbar-icon-with-text">
          <filterIcon.react elementSize="normal" className={toggleClass} elementPosition="center"/>
          <span className="julynter-toolbar-icon-text">{element}</span>
        </div>
      </div>
    );
  }

  private createModeButton(): JSX.Element {
    let toggleIcon = null;
    const mode = this.notebook.options.checkMode();
    if (mode === 'list') {
      toggleIcon = <listIcon.react elementSize="normal" className="julynter-toolbar-icon" elementPosition="center"/>
    } else if (mode === 'cell') {
      toggleIcon = <cellIcon.react elementSize="normal" className="julynter-toolbar-icon" elementPosition="center"/>
    } else if (mode === 'type') {
      toggleIcon = <typeIcon.react elementSize="normal" className="julynter-toolbar-icon" elementPosition="center"/>
    }
    return (
      <div
        key="toolbar-mode"
        className="julynter-toolbar-button"
        title="Alternate Mode"
        onClick={this.toggleMode.bind(this)}
      >
        {toggleIcon}
      </div>
    );
  }

  protected render(): React.ReactElement<any, string | ((props: any) => React.ReactElement<any, string | any | (new (props: any) => React.Component<any, any, any>)>) | (new (props: any) => React.Component<any, any, any>)> | React.ReactElement<any, string | ((props: any) => React.ReactElement<any, string | any | (new (props: any) => React.Component<any, any, any>)>) | (new (props: any) => React.Component<any, any, any>)>[] {
    try { 
      return (
        <div>
          <div className={'julynter-toolbar'}>
            {this.createFilterButtons()}
            {this.createViewButton()}
            {this.createRestartButton()}
            {this.createRestartFilterButton()}
            {this.createModeButton()}
            <div
              key="toolbar-req"
              title="Change requirements location"
              className="julynter-toolbar-button"
              onClick={this.changeRequirements.bind(this)}
            >
              <requirermentsIcon.react elementSize="normal" className="julynter-toolbar-icon" elementPosition="center"/>
            </div>
            <div
              key="toolbar-config"
              title="Configure Julynter"
              className="julynter-toolbar-button"
              onClick={this.configure.bind(this)}
            >
              <configIcon.react elementSize="normal" className="julynter-toolbar-icon" elementPosition="center"/>
            </div>
          </div>
        </div>
      );
    } catch (error) {
      throw this.errorHandler.report(error, 'ToolbarWidget:render', []);
    }
  }
}