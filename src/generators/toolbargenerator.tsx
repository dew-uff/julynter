import { INotebookTracker } from '@jupyterlab/notebook';

import { NotebookGeneratorOptionsManager } from './optionsmanager';

import * as React from 'react';

interface INotebookGeneratorToolbarProps {}

interface INotebookGeneratorToolbarState {
  [id: string]: boolean;
}

const CONFIG = [
  {
    label: "Togle Title Checking",
    key: "Invalid Title",
    icon: "julynter-toolbar-title-icon",
    button: "julynter-toolbar-title-button",
  }
]

export function notebookGeneratorToolbar(
  options: NotebookGeneratorOptionsManager,
  tracker: INotebookTracker
) {
  // Render the toolbar
  return class extends React.Component<INotebookGeneratorToolbarProps,INotebookGeneratorToolbarState> {
    constructor(props: INotebookGeneratorToolbarProps) {
      super(props);
      let checks: { [id: string]: boolean} = {};
      // ToDo: fix initial state
      this.state = {};
      CONFIG.forEach(element => {
        let key = element.key.replace(' ', '-').toLowerCase();
        checks[key] = true;
        this.setState({ [key]: true });
      });
      if (tracker.currentWidget) {
        // Read saved user settings in notebook metadata
        tracker.currentWidget.context.ready.then(() => {
          if (tracker.currentWidget) {
            tracker.currentWidget.content.activeCellChanged.connect(() => {
              options.updateWidget();
            });
            CONFIG.forEach(element => {
              let key = element.key.replace(' ', '-').toLowerCase();
              let _check = tracker.currentWidget.model.metadata.get(
                'julynter-check-' + key
              ) as boolean;
              _check = _check != undefined ? _check : options.check(key);
              checks[key] = _check;
              this.setState({ [key]:_check});
            });
            options.initializeOptions(
              checks,
            );
            
          }
        });
      }
    }

    toggle = (key: string) => {
      key = key.replace(' ', '-').toLowerCase();
      return (component: React.Component) => {
        options.setCheck(key, !options.check(key));
        this.setState({ [key]: options.check(key) });
      };
    };

    render() {
      let listing: JSX.Element[] = CONFIG.map(element => {
        let key = element.key.replace(' ', '-').toLowerCase();
        let toggle_class = element.icon + " " + (
          this.state[key] ? "julynter-toolbar-icon-selected" : "julynter-toolbar-icon"
        )
        let button_class = element.button + " julynter-toolbar-button";
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
      

      return (
        <div>
          <div className={'julynter-toolbar'}>
            {listing}
          </div>
        </div>
      );
    }
  };
}