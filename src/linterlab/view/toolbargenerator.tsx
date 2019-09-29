import { INotebookTracker } from '@jupyterlab/notebook';

import { ERROR_TYPES, ErrorTypeKey } from '../../linter/errors';

import { IJulynterLintOptions, ILintOptionsManager } from '../../linter/interfaces'

import * as React from 'react';
import { showDialog, Dialog, showErrorMessage } from '@jupyterlab/apputils';
import { Widget } from '@phosphor/widgets';
import { PathExt } from '@jupyterlab/coreutils';

interface IToolbarProps {}


export function notebookGeneratorToolbar(options: ILintOptionsManager, tracker: INotebookTracker) {
  // Render the toolbar
  return class extends React.Component<IToolbarProps,IJulynterLintOptions> {
    constructor(props: IToolbarProps) {
      super(props);
      let checks: IJulynterLintOptions = this.state = {
        "invalid-title": true,
        "hidden-state": true,
        "confuse-notebook": true,
        "import": true,
        "absolute-path": true,
        "mode": "type",
        "requirements": "requirements.txt"
      };
      if (tracker.currentWidget) {
        // Read saved user settings in notebook metadata
        tracker.currentWidget.context.ready.then(() => {
          if (tracker.currentWidget) {
            tracker.currentWidget.content.activeCellChanged.connect(() => {
              options.updateWidget();
            });

            ERROR_TYPES.forEach(element => {
              let key = element.key as ErrorTypeKey;
              let _check = tracker.currentWidget.model.metadata.get(
                'julynter-check-' + key
              ) as boolean;
              checks[key] = _check = _check != undefined ? _check : options.check(key);
              this.setState<never>({ [key]: _check });
            });
            let key: string;

            key = "mode";
            let _check_mode = tracker.currentWidget.model.metadata.get(
              'julynter-check-' + key
            ) as "list" | "cell" | "type";
            checks["mode"] = _check_mode = _check_mode != undefined ? _check_mode : options.checkMode();
            this.setState({ "mode": _check_mode });

            key = "requirements";
            let _check_requirements = tracker.currentWidget.model.metadata.get(
              'julynter-check-' + key
            ) as string;
            checks["requirements"] = _check_requirements = _check_requirements != undefined ? _check_requirements : options.checkRequirements();
            this.setState({ "requirements": _check_requirements });
            
            options.initializeOptions(
              checks,
            );
            
          }
        });
      }
    }

    toggle = (key: string) => {
      return (component: React.Component) => {
        options.update(key, !options.check(key));
        this.setState<never>({ [key]: options.check(key) });
      };
    }

    toggleMode = () => {
      return (component: React.Component) => {
        let mode = options.checkMode()
        if (mode == "list") {
          mode = "cell";
        } else if (mode == "cell") {
          mode = "type"
        } else {
          mode = "list"
        }
        options.updateMode(mode);
        this.setState({ "mode": options.checkMode() });
      };
    };

    changeRequirements = () => {
      return (component: React.Component) => {
        return showDialog({
          title: 'Set requirements file',
          body: new RequirementsHandler(options.checkRequirements()),
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
          options.updateRequirements(name);
        });

      };
    }

    render() {
      let listing: JSX.Element[] = ERROR_TYPES.map(element => {
        let key = element.key.replace(' ', '-').toLowerCase();
        let toggle_class = element.icon + " " + (
          (this.state as any)[key] ? "julynter-toolbar-icon-selected" : "julynter-toolbar-icon"
        )
        let button_class = "julynter-toolbar-button";
        let label = element.label;
        return <div
          className={button_class}
          onClick={event => this.toggle(key).bind(this)(this)}
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
      let mode = options.checkMode();
      if (mode == "list") {
        toggle_class += " julynter-toolbar-list-icon";
      } else if (mode == "cell") {
        toggle_class += " julynter-toolbar-cell-icon";
      } else if (mode == "type") {
        toggle_class += " julynter-toolbar-type-icon";
      }
      let modeToggle = <div
        className="julynter-toolbar-button"
        onClick={event => this.toggleMode().bind(this)(this)}
      >
        <div
          role="text"
          aria-label="Alternate Mode"
          title="Alternate Mode"
          className={toggle_class}
        />
      </div>

      let reqConfig = <div
      className="julynter-toolbar-button"
      onClick={event => this.changeRequirements().bind(this)(this)}
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
}


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
