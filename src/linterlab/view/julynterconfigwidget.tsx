import React from 'react';
import ReactDOM from 'react-dom';

import { Widget } from '@lumino/widgets';
import {
  Dialog,
  MainAreaWidget,
  ReactWidget,
  showDialog,
  showErrorMessage,
  Toolbar,
  ToolbarButtonComponent
} from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { HTMLSelect } from '@jupyterlab/ui-components';

import { ERRORS, ERROR_TYPES_MAP } from '../../linter/reports';
import {
  ErrorTypeKey,
  ErrorTypeKeys,
  IErrorMessage,
  IJulynterLintOptions,
  ReportId,
  ReportIds,
  ViewMode,
  ViewModes
} from '../../linter/interfaces';
import { Config } from '../config';
import { NotebookHandler } from '../notebookhandler';

const MODES: { [id in ViewMode]: string } = {
  list: 'View as list',
  cell: 'Group by cell',
  type: 'Group by lint type'
};

interface IErrorMessageId {
  key: ReportId;
  item: IErrorMessage;
}

interface IReportGroup {
  group: ErrorTypeKey;
  items: IErrorMessageId[];
  current: IJulynterLintOptions;
}

interface IReportGroupState {
  collapsed: boolean;
}

class ReportGroup extends React.Component<IReportGroup, IReportGroupState> {
  /* eslint @typescript-eslint/no-unused-vars: 0 */
  constructor(props: any) {
    super(props);
    this.state = { collapsed: !this.props.current.types[this.props.group] };
  }

  clickItem(key: ReportId): () => void {
    return (): void => {
      this.props.current.reports[key] = !this.props.current.reports[key];
      this.forceUpdate();
    };
  }

  changeItem(): void {
    return;
  }

  changeGroup(event: React.ChangeEvent<HTMLInputElement>): void {
    const updateLater =
      this.props.current.types[this.props.group] !== this.state.collapsed;
    this.props.current.types[this.props.group] = event.target.checked;
    if (updateLater) {
      this.setState({
        collapsed: !event.target.checked
      });
    }
    this.forceUpdate();
  }

  collapseGroup(): void {
    this.setState({
      collapsed: !this.state.collapsed
    });
    this.forceUpdate();
  }

  render(): JSX.Element {
    let twistButton = null;
    const items = this.props.items.map(el => {
      const key = 'config-report-' + el.key;
      return (
        <tr key={key} onClick={this.clickItem(el.key)}>
          <td>
            <input
              type="checkbox"
              onChange={this.changeItem}
              checked={this.props.current.reports[el.key]}
            />
          </td>
          <td>{el.key}</td>
          <td>{el.item.label('<T1>', '<T2>', '<T3>', '<T4>', '<T5>')}</td>
          <td>{el.item.suggestion}</td>
        </tr>
      );
    });

    let notice = null;
    if (!this.props.current.types[this.props.group]) {
      notice = (
        <span>
          This category is disabled. The individual options in the following
          table will have no effect.
        </span>
      );
    }

    let children = (
      <div>
        {notice}
        <table>
          <thead>
            <tr>
              <th>Use</th>
              <th>Code</th>
              <th>Template</th>
              <th>Suggestion</th>
            </tr>
          </thead>
          <tbody>{items}</tbody>
        </table>
      </div>
    );
    if (this.state.collapsed) {
      children = null;
      twistButton = (
        <div className="julynter-collapse-button">
          <div className="julynter-twist-placeholder">placeholder</div>
          <div className="julynter-rightarrow-img julynter-arrow-img" />
        </div>
      );
    } else {
      twistButton = (
        <div className="julynter-collapse-button">
          <div className="julynter-twist-placeholder">placeholder</div>
          <div className="julynter-downarrow-img julynter-arrow-img" />
        </div>
      );
    }
    const errorType = ERROR_TYPES_MAP[this.props.group];
    return (
      <div className="julynter-config-group">
        <h2>
          <div
            className="julynter-config-group-head"
            onClick={this.collapseGroup.bind(this)}
          >
            {twistButton}
            <span>{errorType.label}</span>
          </div>
          <input
            type="checkbox"
            onChange={this.changeGroup.bind(this)}
            checked={this.props.current.types[this.props.group]}
          />
        </h2>
        {children}
      </div>
    );
  }
}

export class JulynterConfigContent extends Widget {
  private _current: IJulynterLintOptions;
  private _key: number;

  constructor(checks: IJulynterLintOptions) {
    super();
    this.addClass('julynter-config');
    this._key = 0;
    this._current = checks;
    this.display();
  }

  externalUpdate(): void {
    this._key += 1;
    this.display();
  }

  selectMode(event: React.FormEvent<HTMLSelectElement>): void {
    this._current.mode = event.currentTarget.value as ViewMode;
  }

  writeRequirements(event: React.FormEvent<HTMLInputElement>): void {
    this._current.requirements = event.currentTarget.value;
  }

  display(): void {
    let renderedJSX: JSX.Element = null;
    const groups: { [id in ErrorTypeKey]?: IErrorMessageId[] } = {};
    for (const key of ReportIds) {
      const error = ERRORS[key as ReportId];
      if (error.type in groups) {
        groups[error.type].push({
          key: key as ReportId,
          item: error
        });
      } else {
        groups[error.type] = [
          {
            key: key as ReportId,
            item: error
          }
        ];
      }
    }

    const reportGroups = ErrorTypeKeys.map(el => {
      const key = 'config-' + el + '-' + this._key;
      return (
        <ReportGroup
          current={this._current}
          key={key}
          group={el}
          items={groups[el]}
        />
      );
    });

    renderedJSX = (
      <div className="julynter-config-inner">
        <h1> Configure Julynter </h1>
        <div className="julynter-config-notice">
          Do not forget to click the "Save" button when you are done
        </div>
        <label key={'mode-' + this._key}>
          Mode:
          <HTMLSelect
            className="julynter-config-select"
            defaultValue={this._current.mode}
            onChange={this.selectMode.bind(this)}
            options={ViewModes.map(el => {
              return { label: MODES[el], value: el };
            })}
          />
        </label>
        <label>
          Requirements file:
          <div className="julynter-config-input" key={'req-' + this._key}>
            <input
              type="text"
              onChange={this.writeRequirements.bind(this)}
              defaultValue={this._current.requirements}
            />
          </div>
        </label>
        {reportGroups}
      </div>
    );

    ReactDOM.render(renderedJSX, this.node);
  }
}

export class ContextSwitcher extends ReactWidget {
  private _tracker: INotebookTracker;
  private _content: JulynterConfigContent;
  public selected: string;

  constructor(
    tracker: INotebookTracker,
    selected: string,
    content: JulynterConfigContent
  ) {
    super();
    this._tracker = tracker;
    this._content = content;
    this.selected = selected;
    this.update();
    tracker.widgetAdded.connect((sender, nbPanel) => {
      this.update();
    });
  }

  getSelected(): NotebookPanel | string {
    let result: NotebookPanel | string = this.selected;
    this._tracker.forEach(notebook => {
      if (notebook.id === this.selected) {
        result = notebook;
      }
    });
    return result;
  }

  /**
   * Handle `change` events for the HTMLSelect component.
   */
  handleChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    this.selected = event.target.value;
  }

  /**
   * Handle `keydown` events for the HTMLSelect component.
   */
  handleKeyDown(event: React.KeyboardEvent): void {
    if (event.keyCode === 13) {
      this._content.activate();
    }
  }

  render(): JSX.Element {
    const value = this.selected;
    let i = 0;
    const result: JSX.Element[] = [];
    this._tracker.forEach(notebook => {
      const key = 'notebook-save-' + i++;
      result.push(
        <option key={key} value={notebook.id}>
          {notebook.title.label} Settings
        </option>
      );
    });

    return (
      <HTMLSelect
        onChange={this.handleChange.bind(this)}
        onKeyDown={this.handleKeyDown.bind(this)}
        defaultValue={value}
        aria-label="Cell type"
      >
        <option value="user">User Settings</option>
        <option value="project">Project Settings</option>
        {result}
      </HTMLSelect>
    );
  }
}

export class SaveButton extends ReactWidget {
  private _props: ToolbarButtonComponent.IProps;
  private _checks: IJulynterLintOptions;
  private _switcher: ContextSwitcher;
  private _handlers: { [id: string]: Promise<NotebookHandler> };
  private _config: Config;

  constructor(
    switcher: ContextSwitcher,
    handlers: { [id: string]: Promise<NotebookHandler> },
    config: Config,
    checks: IJulynterLintOptions
  ) {
    super();
    this._switcher = switcher;
    this._checks = checks;
    this._handlers = handlers;
    this._config = config;
    this._props = {
      className: 'julynter-save',
      tooltip: 'Save configuration',
      label: 'Save',
      onClick: this.onClick.bind(this)
    };
    this.addClass('jp-ToolbarButton');
  }

  onClick(): void {
    const selected = this._switcher.selected;
    if (selected === 'user') {
      this._config
        .saveUser(this._checks)
        .then(() => {
          showDialog({
            title: 'Success',
            body: (
              <div>
                <div>Stored settings for user.</div>
                <div>
                  It will not change existing notebooks that have their own
                  settings.
                </div>
              </div>
            ),
            buttons: [Dialog.okButton({ label: 'Ok' })]
          });
        })
        .catch(reason => {
          showErrorMessage('Failed', reason);
        });
    } else if (selected === 'project') {
      this._config
        .saveProject(this._checks)
        .then(() => {
          showDialog({
            title: 'Success',
            body: (
              <div>
                <div>Stored settings for project.</div>
                <div>
                  It will not change existing notebooks that have their own
                  settings.
                </div>
              </div>
            ),
            buttons: [Dialog.okButton({ label: 'Ok' })]
          });
        })
        .catch(reason => {
          showErrorMessage('Failed', reason);
        });
    } else if (selected in this._handlers) {
      this._handlers[selected].then(handler => {
        handler.options.initializeOptions(this._checks);
        handler.options.saveOptions();
        showDialog({
          title: 'Success',
          body: (
            <div>
              <div>Stored settings for {handler.name}.</div>
            </div>
          ),
          buttons: [Dialog.okButton({ label: 'Ok' })]
        });
      });
    } else {
      showErrorMessage('Failed', 'Target not found!');
    }
  }

  render(): JSX.Element {
    return <ToolbarButtonComponent {...this._props} />;
  }
}

export class LoadButton extends ReactWidget {
  private _props: ToolbarButtonComponent.IProps;
  private _checks: IJulynterLintOptions;
  private _switcher: ContextSwitcher;
  private _handlers: { [id: string]: Promise<NotebookHandler> };
  private _config: Config;
  private _content: JulynterConfigContent;

  constructor(
    switcher: ContextSwitcher,
    handlers: { [id: string]: Promise<NotebookHandler> },
    config: Config,
    checks: IJulynterLintOptions,
    content: JulynterConfigContent
  ) {
    super();
    this._switcher = switcher;
    this._checks = checks;
    this._handlers = handlers;
    this._config = config;
    this._content = content;
    this._props = {
      className: 'julynter-load',
      tooltip: 'Load configuration',
      label: 'Load',
      onClick: this.onClick.bind(this)
    };
    this.addClass('jp-ToolbarButton');
  }

  onClick(): void {
    const selected = this._switcher.selected;
    if (selected === 'user') {
      this._config
        .loadUser()
        .then(config => {
          this._config.merge(this._checks, config);
          this._content.externalUpdate();
        })
        .catch(reason => {
          showErrorMessage('Failed', reason);
        });
    } else if (selected === 'project') {
      this._config
        .loadProject()
        .then(config => {
          this._config.merge(this._checks, config);
          this._content.externalUpdate();
        })
        .catch(reason => {
          showErrorMessage('Failed', reason);
        });
    } else if (selected in this._handlers) {
      this._handlers[selected].then(handler => {
        handler.options.reloadOptions();
        this._config.merge(this._checks, handler.options.checks);
        this._content.externalUpdate();
      });
    } else {
      showErrorMessage('Failed', 'Target not found!');
    }
  }

  render(): JSX.Element {
    return <ToolbarButtonComponent {...this._props} />;
  }
}

export class ResetButton extends ReactWidget {
  private _props: ToolbarButtonComponent.IProps;
  private _checks: IJulynterLintOptions;
  private _config: Config;
  private _content: JulynterConfigContent;

  constructor(
    config: Config,
    checks: IJulynterLintOptions,
    content: JulynterConfigContent
  ) {
    super();
    this._checks = checks;
    this._config = config;
    this._content = content;
    this._props = {
      className: 'julynter-reset',
      tooltip: 'Reset configuration',
      label: 'Reset',
      onClick: this.onClick.bind(this)
    };
    this.addClass('jp-ToolbarButton');
  }

  onClick(): void {
    this._config.merge(this._checks, this._config.createDefault());
    this._content.externalUpdate();
  }

  render(): JSX.Element {
    return <ToolbarButtonComponent {...this._props} />;
  }
}

export function createJulynterConfigWidget(
  tracker: INotebookTracker,
  handlers: { [id: string]: Promise<NotebookHandler> },
  config: Config,
  notebook: NotebookHandler
): MainAreaWidget<JulynterConfigContent> {
  const checks = { ...notebook.options.checks };
  checks.reports = { ...checks.reports };
  const content = new JulynterConfigContent(checks);
  const saveSwitcher = new ContextSwitcher(tracker, notebook.id, content);
  const saveButton = new SaveButton(saveSwitcher, handlers, config, checks);
  const loadButton = new LoadButton(
    saveSwitcher,
    handlers,
    config,
    checks,
    content
  );
  const resetButton = new ResetButton(config, checks, content);

  const toolbar = new Toolbar();
  toolbar.addItem('julynter-reset', resetButton);
  toolbar.addItem('julynter-context', saveSwitcher);
  toolbar.addItem('julynter-load', loadButton);
  toolbar.addItem('julynter-save', saveButton);

  const conf = new MainAreaWidget({ content, toolbar });
  conf.title.iconClass = 'julynter-main-icon';
  conf.title.caption = 'Julynter Config';
  conf.title.label = 'Julynter Config';
  conf.title.closable = true;
  conf.id = 'julynter-config';
  return conf;
}
