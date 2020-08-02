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
  ToolbarButtonComponent,
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
  ViewModes,
} from '../../linter/interfaces';
import { Config } from '../config';
import { NotebookHandler } from '../notebookhandler';
import { ErrorHandler } from '../errorhandler';
import { julynterIcon } from '../../iconimports';

const MODES: { [id in ViewMode]: string } = {
  list: 'View as list',
  cell: 'Group by cell',
  type: 'Group by lint type',
};

interface IErrorMessageId {
  key: ReportId;
  item: IErrorMessage;
}

interface IReportGroup {
  group: ErrorTypeKey;
  items: IErrorMessageId[];
  current: IJulynterLintOptions;
  errorHandler: ErrorHandler;
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
      try {
        this.props.current.reports[key] = !this.props.current.reports[key];
        this.forceUpdate();
      } catch (error) {
        throw this.props.errorHandler.report(error, 'ReportGroup:clickItem', [
          key,
        ]);
      }
    };
  }

  changeItem(): void {
    return;
  }

  changeGroup(event: React.ChangeEvent<HTMLInputElement>): void {
    try {
      const updateLater =
        this.props.current.types[this.props.group] !== this.state.collapsed;
      this.props.current.types[this.props.group] = event.target.checked;
      if (updateLater) {
        this.setState({
          collapsed: !event.target.checked,
        });
      }
      this.forceUpdate();
    } catch (error) {
      throw this.props.errorHandler.report(error, 'ReportGroup:changeGroup', [
        this.props.group,
        event.target.checked,
      ]);
    }
  }

  collapseGroup(): void {
    try {
      this.setState({
        collapsed: !this.state.collapsed,
      });
      this.forceUpdate();
    } catch (error) {
      throw this.props.errorHandler.report(error, 'ReportGroup:collapseGroup', [
        this.props.group,
      ]);
    }
  }

  render(): JSX.Element {
    try {
      let twistButton = null;
      const items = this.props.items.map((el) => {
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
    } catch (error) {
      throw this.props.errorHandler.report(error, 'ReportGroup:render', [
        this.props.group,
      ]);
    }
  }
}

export class JulynterConfigContent extends Widget {
  private _current: IJulynterLintOptions;
  private _key: number;
  private _eh: ErrorHandler;

  constructor(checks: IJulynterLintOptions, eh: ErrorHandler) {
    super();
    this._eh = eh;
    this.addClass('julynter-config');
    this._key = 0;
    this._current = checks;
    this.display();
  }

  externalUpdate(): void {
    try {
      this._key += 1;
      this.display();
    } catch (error) {
      throw this._eh.report(error, 'JulynterConfigContent:externalUpdade', []);
    }
  }

  selectMode(event: React.FormEvent<HTMLSelectElement>): void {
    try {
      this._current.mode = event.currentTarget.value as ViewMode;
    } catch (error) {
      throw this._eh.report(error, 'JulynterConfigContent:selectMode', [
        event.currentTarget.value,
      ]);
    }
  }

  writeRequirements(event: React.FormEvent<HTMLInputElement>): void {
    try {
      this._current.requirements = event.currentTarget.value;
    } catch (error) {
      throw this._eh.report(error, 'JulynterConfigContent:writeRequirements', [
        event.currentTarget.value,
      ]);
    }
  }

  changeView(event: React.ChangeEvent<HTMLInputElement>): void {
    try {
      this._current.view = event.target.checked;
    } catch (error) {
      throw this._eh.report(error, 'JulynterConfigContent:changeView', [
        event.currentTarget.value,
      ]);
    }
  }

  changeRestart(event: React.ChangeEvent<HTMLInputElement>): void {
    try {
      this._current.restart = event.target.checked;
    } catch (error) {
      throw this._eh.report(error, 'JulynterConfigContent:changeRestart', [
        event.currentTarget.value,
      ]);
    }
  }


  display(): void {
    try {
      let renderedJSX: JSX.Element = null;
      const groups: { [id in ErrorTypeKey]?: IErrorMessageId[] } = {};
      for (const key of ReportIds) {
        const error = ERRORS[key as ReportId];
        if (error.type in groups) {
          groups[error.type].push({
            key: key as ReportId,
            item: error,
          });
        } else {
          groups[error.type] = [
            {
              key: key as ReportId,
              item: error,
            },
          ];
        }
      }

      const reportGroups = ErrorTypeKeys.map((el) => {
        const key = 'config-' + el + '-' + this._key;
        return (
          <ReportGroup
            current={this._current}
            key={key}
            group={el}
            items={groups[el]}
            errorHandler={this._eh}
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
              options={ViewModes.map((el) => {
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
          <label>
            <input
              type="checkbox"
              onChange={this.changeView.bind(this)}
              defaultChecked={this._current.view}
            />
            Show lints on cells
          </label>
          <label>
            <input
              type="checkbox"
              onChange={this.changeRestart.bind(this)}
              defaultChecked={this._current.restart}
            />
            Show lints that require a kernel restart
          </label>
          {reportGroups}
        </div>
      );

      ReactDOM.render(renderedJSX, this.node);
    } catch (error) {
      throw this._eh.report(error, 'JulynterConfigContent:display', []);
    }
  }
}

export class ContextSwitcher extends ReactWidget {
  private _tracker: INotebookTracker;
  private _content: JulynterConfigContent;
  private _eh: ErrorHandler;
  public selected: string;

  constructor(
    tracker: INotebookTracker,
    selected: string,
    content: JulynterConfigContent,
    eh: ErrorHandler
  ) {
    super();
    this._eh = eh;
    this._tracker = tracker;
    this._content = content;
    this.selected = selected;
    this.update();
    tracker.widgetAdded.connect((sender, nbPanel) => {
      this.update();
    });
  }

  getSelected(): NotebookPanel | string {
    try {
      let result: NotebookPanel | string = this.selected;
      this._tracker.forEach((notebook) => {
        if (notebook.id === this.selected) {
          result = notebook;
        }
      });
      return result;
    } catch (error) {
      throw this._eh.report(error, 'ContextSwitcher:getSelected', []);
    }
  }

  /**
   * Handle `change` events for the HTMLSelect component.
   */
  handleChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    try {
      this.selected = event.target.value;
    } catch (error) {
      throw this._eh.report(error, 'ContextSwitcher:handleChange', [
        event.target.value,
      ]);
    }
  }

  /**
   * Handle `keydown` events for the HTMLSelect component.
   */
  handleKeyDown(event: React.KeyboardEvent): void {
    try {
      if (event.keyCode === 13) {
        this._content.activate();
      }
    } catch (error) {
      throw this._eh.report(error, 'ContextSwitcher:handleKeyDown', [
        event.keyCode,
      ]);
    }
  }

  render(): JSX.Element {
    try {
      const value = this.selected;
      let i = 0;
      const result: JSX.Element[] = [];
      this._tracker.forEach((notebook) => {
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
    } catch (error) {
      throw this._eh.report(error, 'ContextSwitcher:render', []);
    }
  }
}

export class SaveButton extends ReactWidget {
  private _props: ToolbarButtonComponent.IProps;
  private _checks: IJulynterLintOptions;
  private _switcher: ContextSwitcher;
  private _handlers: { [id: string]: Promise<NotebookHandler> };
  private _config: Config;
  private _eh: ErrorHandler;

  constructor(
    switcher: ContextSwitcher,
    handlers: { [id: string]: Promise<NotebookHandler> },
    config: Config,
    checks: IJulynterLintOptions,
    eh: ErrorHandler
  ) {
    super();
    this._eh = eh;
    this._switcher = switcher;
    this._checks = checks;
    this._handlers = handlers;
    this._config = config;
    this._props = {
      className: 'julynter-save',
      tooltip: 'Save configuration',
      label: 'Save',
      onClick: this.onClick.bind(this),
    };
    this.addClass('jp-ToolbarButton');
  }

  onClick(): void {
    try {
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
              buttons: [Dialog.okButton({ label: 'Ok' })],
            });
          })
          .catch((reason) => {
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
              buttons: [Dialog.okButton({ label: 'Ok' })],
            });
          })
          .catch((reason) => {
            showErrorMessage('Failed', reason);
          });
      } else if (selected in this._handlers) {
        this._handlers[selected].then((handler) => {
          handler.options.initializeOptions(this._checks);
          handler.options.saveOptions();
          showDialog({
            title: 'Success',
            body: (
              <div>
                <div>Stored settings for {handler.name}.</div>
              </div>
            ),
            buttons: [Dialog.okButton({ label: 'Ok' })],
          });
        });
      } else {
        showErrorMessage('Failed', 'Target not found!');
      }
    } catch (error) {
      throw this._eh.report(error, 'SaveButton:onClick', []);
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
  private _eh: ErrorHandler;

  constructor(
    switcher: ContextSwitcher,
    handlers: { [id: string]: Promise<NotebookHandler> },
    config: Config,
    checks: IJulynterLintOptions,
    content: JulynterConfigContent,
    eh: ErrorHandler
  ) {
    super();
    this._eh = eh;
    this._switcher = switcher;
    this._checks = checks;
    this._handlers = handlers;
    this._config = config;
    this._content = content;
    this._props = {
      className: 'julynter-load',
      tooltip: 'Load configuration',
      label: 'Load',
      onClick: this.onClick.bind(this),
    };
    this.addClass('jp-ToolbarButton');
  }

  onClick(): void {
    try {
      const selected = this._switcher.selected;
      if (selected === 'user') {
        this._config
          .loadUser()
          .then((config) => {
            this._config.merge(this._checks, config);
            this._content.externalUpdate();
          })
          .catch((reason) => {
            showErrorMessage('Failed', reason);
          });
      } else if (selected === 'project') {
        this._config
          .loadProject()
          .then((config) => {
            this._config.merge(this._checks, config);
            this._content.externalUpdate();
          })
          .catch((reason) => {
            showErrorMessage('Failed', reason);
          });
      } else if (selected in this._handlers) {
        this._handlers[selected].then((handler) => {
          handler.options.reloadOptions();
          this._config.merge(this._checks, handler.options.checks);
          this._content.externalUpdate();
        });
      } else {
        showErrorMessage('Failed', 'Target not found!');
      }
    } catch (error) {
      throw this._eh.report(error, 'LoadButton:onClick', []);
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
  private _eh: ErrorHandler;

  constructor(
    config: Config,
    checks: IJulynterLintOptions,
    content: JulynterConfigContent,
    eh: ErrorHandler
  ) {
    super();
    this._checks = checks;
    this._config = config;
    this._content = content;
    this._eh = eh;
    this._props = {
      className: 'julynter-reset',
      tooltip: 'Reset configuration',
      label: 'Reset',
      onClick: this.onClick.bind(this),
    };
    this.addClass('jp-ToolbarButton');
  }

  onClick(): void {
    try {
      this._config.merge(this._checks, this._config.createDefault());
      this._content.externalUpdate();
    } catch (error) {
      throw this._eh.report(error, 'ResetButton:onClick', []);
    }
  }

  render(): JSX.Element {
    return <ToolbarButtonComponent {...this._props} />;
  }
}

export function createJulynterConfigWidget(
  tracker: INotebookTracker,
  handlers: { [id: string]: Promise<NotebookHandler> },
  config: Config,
  notebook: NotebookHandler,
  eh: ErrorHandler
): MainAreaWidget<JulynterConfigContent> {
  try {
    const checks = { ...notebook.options.checks };
    checks.reports = { ...checks.reports };
    const content = new JulynterConfigContent(checks, eh);
    const saveSwitcher = new ContextSwitcher(tracker, notebook.id, content, eh);
    const saveButton = new SaveButton(
      saveSwitcher,
      handlers,
      config,
      checks,
      eh
    );
    const loadButton = new LoadButton(
      saveSwitcher,
      handlers,
      config,
      checks,
      content,
      eh
    );
    const resetButton = new ResetButton(config, checks, content, eh);

    const toolbar = new Toolbar();
    toolbar.addItem('julynter-reset', resetButton);
    toolbar.addItem('julynter-context', saveSwitcher);
    toolbar.addItem('julynter-load', loadButton);
    toolbar.addItem('julynter-save', saveButton);

    const conf = new MainAreaWidget({ content, toolbar });
    conf.title.icon = julynterIcon.bindprops({ stylesheet: 'mainAreaTab' });
    conf.title.caption = 'Julynter Config';
    conf.title.label = 'Julynter Config';
    conf.title.closable = true;
    conf.id = 'julynter-config';
    return conf;
  } catch (error) {
    throw eh.report(error, 'createJulynterConfigWidget', []);
  }
}
