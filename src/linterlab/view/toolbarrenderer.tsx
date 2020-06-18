import * as React from 'react';

import { Widget } from '@lumino/widgets';

import { showDialog, Dialog, showErrorMessage } from '@jupyterlab/apputils';
import { PathExt } from '@jupyterlab/coreutils';
import { INotebookTracker } from '@jupyterlab/notebook';

import { ERROR_TYPES } from '../../linter/errors';
import { ILintOptionsManager } from '../../linter/interfaces'


interface IToolbarProps {
  options: ILintOptionsManager;
  tracker: INotebookTracker;
}


export class ToolbarRenderer extends React.Component<IToolbarProps> {
  constructor(props: IToolbarProps) {
    super(props);
    
    if (this.props.tracker.currentWidget) {
      // Read saved user settings in notebook metadata
      this.props.tracker.currentWidget.context.ready.then(() => {
        if (this.props.tracker.currentWidget) {
          this.props.tracker.currentWidget.content.activeCellChanged.connect(() => {
            this.props.options.updateWidget();
          });
        }
      });
    }
    this.toggle = this.toggle.bind(this);
    this.toggleMode = this.toggleMode.bind(this);
    this.changeRequirements = this.changeRequirements.bind(this);
  }

  toggle(key: string): void {
    this.props.options.update(key, !this.props.options.check(key));
  }

  toggleMode(): void {
    let mode = this.props.options.checkMode()
    if (mode == "list") {
      mode = "cell";
    } else if (mode == "cell") {
      mode = "type"
    } else {
      mode = "list"
    }
    this.props.options.updateMode(mode);
  };

  changeRequirements(): Promise<Dialog.IResult<string>> {
    return showDialog({
      title: 'Set requirements file',
      body: new RequirementsHandler(this.props.options.checkRequirements()),
      focusNodeSelector: 'input',
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Set' })]
    }).then(result => {
      if (!result.value) {
        return;
      }
      let name: string = result.value as string; 
      if ((name.length == 0) || (name.includes(":"))) {
        void showErrorMessage(
          'Set Requirements Error',
          Error(
            `"${result.value}" is not a valid name for a file. ` +
              `Names must have nonzero length, ` +
              `and cannot include ":"`
          )
        );
        return null;
      }
      this.props.options.updateRequirements(name);
    });
  }

  render(): JSX.Element {
    let i = 0;
    let listing: JSX.Element[] = ERROR_TYPES.map(element => {
      let key = element.key.replace(' ', '-').toLowerCase();
      let toggle_class = element.icon + " " + (
        this.props.options.check(key) ? "julynter-toolbar-icon-selected" : "julynter-toolbar-icon"
      )
      let button_class = "julynter-toolbar-button";
      let label = element.label;
      return <div
        key={`toolbar-${key}-${i++}`}
        className={button_class}
        onClick={event => this.toggle(key)}
      >
        <div
          role="text"
          aria-label={label}
          title={label}
          className={toggle_class}
        />
      </div>
    })
    
    let toggle_class = "julynter-toolbar-icon";
    let mode = this.props.options.checkMode();
    if (mode == "list") {
      toggle_class += " julynter-toolbar-list-icon";
    } else if (mode == "cell") {
      toggle_class += " julynter-toolbar-cell-icon";
    } else if (mode == "type") {
      toggle_class += " julynter-toolbar-type-icon";
    }
    let modeToggle = <div
      key="toolbar-mode"
      className="julynter-toolbar-button"
      onClick={this.toggleMode}
    >
      <div
        role="text"
        aria-label="Alternate Mode"
        title="Alternate Mode"
        className={toggle_class}
      />
    </div>

    let reqConfig = <div
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

    return (
      <div>
        <div className={'julynter-toolbar'}>
          {listing}
          {modeToggle}
          {reqConfig}
        </div>
      </div>
    );
  }
};


/**
 * A widget used to rename a file.
 */
class RequirementsHandler extends Widget {
  /**
   * Construct a new "rename" dialog.
   */
  constructor(oldPath: string) {
    let body = document.createElement('div');
    let existingLabel = document.createElement('label');
    existingLabel.textContent = 'Requirements file';
    let existingPath = document.createElement('span');
    existingPath.textContent = oldPath;

    let nameTitle = document.createElement('label');
    nameTitle.textContent = 'New Name';
    nameTitle.className = "jp-new-name-title";
    let name = document.createElement('input');

    body.appendChild(existingLabel);
    body.appendChild(existingPath);
    body.appendChild(nameTitle);
    body.appendChild(name);
  
    super({ node: body });
    this.addClass('jp-FileDialog');
    let ext = PathExt.extname(oldPath);
    let value = (this.inputNode.value = PathExt.basename(oldPath));
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
