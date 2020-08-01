import * as React from 'react';

import { Widget } from '@lumino/widgets';

import { ILabShell } from '@jupyterlab/application';
import { showDialog, Dialog, showErrorMessage, ReactWidget } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { INotebookTracker } from '@jupyterlab/notebook';

import { ERROR_TYPES_MAP } from '../../linter/reports';
import { ErrorTypeKey, ErrorTypeKeys } from '../../linter/interfaces';
import { Config } from '../config';
import { NotebookHandler } from '../notebookhandler';
import { createJulynterConfigWidget } from './julynterconfigwidget';
import { ErrorHandler } from '../errorhandler';
import { configIcon, requirermentsIcon, listIcon, cellIcon, typeIcon, iconMap } from '../../iconimports';

interface IToolbarProps {
  notebook: NotebookHandler;
  labShell: ILabShell;
  tracker: INotebookTracker;
  config: Config;
  handlers: { [id: string]: Promise<NotebookHandler> };
  errorHandler: ErrorHandler;
}

export class ToolbarRenderer extends React.Component<IToolbarProps> {
  constructor(props: IToolbarProps) {
    super(props);
    this.toggle = this.toggle.bind(this);
    this.toggleMode = this.toggleMode.bind(this);
    this.changeRequirements = this.changeRequirements.bind(this);
  }

  toggle(key: ErrorTypeKey): void {
    try {
      const options = this.props.notebook.options;
      options.updateType(key, !options.checkType(key));
    } catch (error) {
      throw this.props.errorHandler.report(error, 'ToolbarRenderer:toggle', [
        key,
      ]);
    }
  }

  toggleMode(): void {
    try {
      let mode = this.props.notebook.options.checkMode();
      if (mode === 'list') {
        mode = 'cell';
      } else if (mode === 'cell') {
        mode = 'type';
      } else {
        mode = 'list';
      }
      this.props.notebook.options.updateMode(mode);
    } catch (error) {
      throw this.props.errorHandler.report(
        error,
        'ToolbarRenderer:toggleMode',
        []
      );
    }
  }

  changeRequirements(): Promise<Dialog.IResult<string>> {
    try {
      const options = this.props.notebook.options;
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
      throw this.props.errorHandler.report(
        error,
        'ToolbarRenderer:changeRequirements',
        []
      );
    }
  }

  configure(): void {
    try {
      this.props.labShell.add(
        createJulynterConfigWidget(
          this.props.tracker,
          this.props.handlers,
          this.props.config,
          this.props.notebook,
          this.props.errorHandler
        ),
        'main'
      );
    } catch (error) {
      throw this.props.errorHandler.report(
        error,
        'ToolbarRenderer:configure',
        []
      );
    }
  }

  render(): JSX.Element {
    try {
      let i = 0;
      const listing: JSX.Element[] = ErrorTypeKeys.map((key) => {
        const element = ERROR_TYPES_MAP[key];
        const toggleClass =
          (this.props.notebook.options.checkType(key)
            ? 'julynter-toolbar-icon-selected'
            : 'julynter-toolbar-icon');
        const buttonClass = 'julynter-toolbar-button';
        const label = element.label;
        const icon = iconMap[key];
        return (
          <div
            key={`toolbar-${key}-${i++}`}
            className={buttonClass}
            title={label}
            onClick={(): void => this.toggle(key)}
          >
            <icon.react 
              className={toggleClass}
              width="24px"
              height="24px"
              tag="div"/>
          </div>
        );
      });

      let toggleIcon = null;
      const mode = this.props.notebook.options.checkMode();
      if (mode === 'list') {
        toggleIcon = <listIcon.react 
          className="julynter-toolbar-icon"
          width="24px"
          height="24px"
          tag="div"/>
      } else if (mode === 'cell') {
        toggleIcon = <cellIcon.react 
          className="julynter-toolbar-icon"
          width="24px"
          height="24px"
          tag="div"/>
      } else if (mode === 'type') {
        toggleIcon = <typeIcon.react 
          className="julynter-toolbar-icon"
          width="24px"
          height="24px"
          tag="div"/>
      }
      const modeToggle = (
        <div
          key="toolbar-mode"
          className="julynter-toolbar-button"
          title="Alternate Mode"
          onClick={this.toggleMode}
        >
          {toggleIcon}
        </div>
      );

      const reqConfig = (
        <div
          key="toolbar-req"
          title="Change requirements location"
          className="julynter-toolbar-button"
          onClick={this.changeRequirements}
        >
          <requirermentsIcon.react 
            className="julynter-toolbar-icon"
            width="24px"
            height="24px"
            tag="div"/>
        </div>
      );
      const configure = (
        <div
          key="toolbar-config"
          title="Configure Julynter"
          className="julynter-toolbar-button"
          onClick={this.configure.bind(this)}
        >
          <configIcon.react 
            className="julynter-toolbar-icon"
            width="24px"
            height="24px"
            tag="div"/>
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
    } catch (error) {
      throw this.props.errorHandler.report(error, 'ToolbarRenderer:render', []);
    }
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


export class LuminoToolbar extends ReactWidget {
  
  props: IToolbarProps;

  constructor(options: IToolbarProps) {
    super();
    this.props = options;
    this.addClass("julynter-toolbar-widget")
  }

  protected render(): React.ReactElement<any, string | ((props: any) => React.ReactElement<any, string | any | (new (props: any) => React.Component<any, any, any>)>) | (new (props: any) => React.Component<any, any, any>)> | React.ReactElement<any, string | ((props: any) => React.ReactElement<any, string | any | (new (props: any) => React.Component<any, any, any>)>) | (new (props: any) => React.Component<any, any, any>)>[] {
    return <ToolbarRenderer {...this.props}/>;
  }
}