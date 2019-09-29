import { INotebookTracker } from '@jupyterlab/notebook';

import { ERROR_TYPES, ErrorTypeKey } from '../../linter/errors';

import { IJulynterLintOptions } from '../../linter/interfaces'

import { OptionsManager } from './optionsmanager';

import * as React from 'react';

interface IToolbarProps {}


export function notebookGeneratorToolbar(options: OptionsManager, tracker: INotebookTracker) {
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
        "mode": "list",
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

      return (
        <div>
          <div className={'julynter-toolbar'}>
            {listing}
            {modeToggle}
          </div>
        </div>
      );
    }
  };
}