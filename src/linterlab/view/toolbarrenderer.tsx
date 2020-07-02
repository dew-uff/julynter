import * as React from 'react';

import { Widget } from '@lumino/widgets';

import { ILabShell } from '@jupyterlab/application';
import { showDialog, Dialog, showErrorMessage } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { INotebookTracker } from '@jupyterlab/notebook';

import { ERROR_TYPES_MAP } from '../../linter/reports';
import { ErrorTypeKey, ErrorTypeKeys } from '../../linter/interfaces';
import { Config } from '../config';
import { NotebookHandler } from '../notebookhandler';
import { createJulynterConfigWidget } from './julynterconfigwidget';

interface IToolbarProps {
  notebook: NotebookHandler;
  labShell: ILabShell;
  tracker: INotebookTracker;
  config: Config;
  handlers: { [id: string]: Promise<NotebookHandler> };
}

export class ToolbarRenderer extends React.Component<IToolbarProps> {
  constructor(props: IToolbarProps) {
    super(props);
    this.toggle = this.toggle.bind(this);
    this.toggleMode = this.toggleMode.bind(this);
    this.changeRequirements = this.changeRequirements.bind(this);
  }

  toggle(key: ErrorTypeKey): void {
    const options = this.props.notebook.options;
    options.updateType(key, !options.checkType(key));
  }

  toggleMode(): void {
    let mode = this.props.notebook.options.checkMode();
    if (mode === 'list') {
      mode = 'cell';
    } else if (mode === 'cell') {
      mode = 'type';
    } else {
      mode = 'list';
    }
    this.props.notebook.options.updateMode(mode);
  }

  changeRequirements(): Promise<Dialog.IResult<string>> {
    const options = this.props.notebook.options;
    return showDialog({
      title: 'Set requirements file',
      body: new RequirementsHandler(options.checkRequirements()),
      focusNodeSelector: 'input',
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Set' })]
    }).then(result => {
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
  }

  configure(): void {
    this.props.labShell.add(
      createJulynterConfigWidget(
        this.props.tracker,
        this.props.handlers,
        this.props.config,
        this.props.notebook
      ),
      'main'
    );
  }

  render(): JSX.Element {
    let i = 0;
    const listing: JSX.Element[] = ErrorTypeKeys.map(key => {
      const element = ERROR_TYPES_MAP[key];
      const toggleClass =
        element.icon +
        ' ' +
        (this.props.notebook.options.checkType(key)
          ? 'julynter-toolbar-icon-selected'
          : 'julynter-toolbar-icon');
      const buttonClass = 'julynter-toolbar-button';
      const label = element.label;
      return (
        <div
          key={`toolbar-${key}-${i++}`}
          className={buttonClass}
          onClick={(): void => this.toggle(key)}
        >
          <div
            role="text"
            aria-label={label}
            title={label}
            className={toggleClass}
          />
        </div>
      );
    });

    let toggleClass = 'julynter-toolbar-icon';
    const mode = this.props.notebook.options.checkMode();
    if (mode === 'list') {
      toggleClass += ' julynter-toolbar-list-icon';
    } else if (mode === 'cell') {
      toggleClass += ' julynter-toolbar-cell-icon';
    } else if (mode === 'type') {
      toggleClass += ' julynter-toolbar-type-icon';
    }
    const modeToggle = (
      <div
        key="toolbar-mode"
        className="julynter-toolbar-button"
        onClick={this.toggleMode}
      >
        <div
          role="text"
          aria-label="Alternate Mode"
          title="Alternate Mode"
          className={toggleClass}
        />
      </div>
    );

    const reqConfig = (
      <div
        key="toolbar-req"
        className="julynter-toolbar-button"
        onClick={this.changeRequirements}
      >
        <div
          role="text"
          aria-label="Change requirements location"
          title="Change requirements location"
          className="julynter-toolbar-icon julynter-toolbar-rename-icon"
        />
      </div>
    );

    const configure = (
      <div
        key="toolbar-config"
        className="julynter-toolbar-button"
        onClick={this.configure.bind(this)}
      >
        <div
          role="text"
          aria-label="Configure Julynter"
          title="Configure Julynter"
          className="julynter-toolbar-icon julynter-toolbar-config-icon"
        />
      </div>
    );
    return (
      <div>
        <div className={'julynter-toolbar'}>
          {listing}
          {modeToggle}
          {reqConfig}
          {configure}
        </div>
      </div>
    );
  }
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
