import { INotebookTracker } from '@jupyterlab/notebook';

import { NotebookGeneratorOptionsManager } from './optionsmanager';

import * as React from 'react';

interface INotebookGeneratorToolbarProps {}

interface INotebookGeneratorToolbarState {
  checkTitle: boolean;
}

export function notebookGeneratorToolbar(
  options: NotebookGeneratorOptionsManager,
  tracker: INotebookTracker
) {
  // Render the toolbar
  return class extends React.Component<
    INotebookGeneratorToolbarProps,
    INotebookGeneratorToolbarState
  > {
    constructor(props: INotebookGeneratorToolbarProps) {
      super(props);
      this.state = {
        checkTitle: true
      };
      if (tracker.currentWidget) {
        // Read saved user settings in notebook metadata
        tracker.currentWidget.context.ready.then(() => {
          if (tracker.currentWidget) {
            tracker.currentWidget.content.activeCellChanged.connect(() => {
              options.updateWidget();
            });
            let _title = tracker.currentWidget.model.metadata.get(
              'julynter-checktitle'
            ) as boolean;
            let checkTitle =
              _title != undefined ? _title : options.checkTitle;
        
            options.initializeOptions(
              checkTitle,
            );
            this.setState({
              checkTitle: options.checkTitle,
            });
          }
        });
      }
    }

    toggleTitle = (component: React.Component) => {
      options.checkTitle = !options.checkTitle;
      this.setState({ checkTitle: options.checkTitle });
    };


    render() {
      let titleIcon = this.state.checkTitle ? (
        <div
          className="julynter-toolbar-title-button julynter-toolbar-button"
          onClick={event => this.toggleTitle.bind(this)(this)}
        >
          <div
            role="text"
            aria-label="Toggle Title Checking"
            title="Toggle Title Checking"
            className="julynter-toolbar-title-icon julynter-toolbar-icon-selected"
          />
        </div>
      ) : (
        <div
          className="julynter-toolbar-title-button julynter-toolbar-button"
          onClick={event => this.toggleTitle.bind(this)(this)}
        >
          <div
            role="text"
            aria-label="Toggle Title Checking"
            title="Toggle Title Checking"
            className="julynter-toolbar-title-icon julynter-toolbar-icon"
          />
        </div>
      );


      return (
        <div>
          <div className={'julynter-toolbar'}>
            {titleIcon}
          </div>
        </div>
      );
    }
  };
}