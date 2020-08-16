/* eslint @typescript-eslint/no-unused-vars: 0 */
import { Message } from '@lumino/messaging';
import { Widget, Panel, PanelLayout } from '@lumino/widgets';

import { ILabShell } from '@jupyterlab/application';
import { ActivityMonitor } from '@jupyterlab/coreutils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { NotebookPanel, INotebookTracker } from '@jupyterlab/notebook';

import { IKernelMatcher, ILintingResult } from '../linter/interfaces';
import { Config } from './config';
import { NotebookHandler } from './notebookhandler';
import { ExperimentManager } from './experimentmanager';
import { EmptyListWidget, ListWidget } from './view/listwidget';
import { IJulynterStatus } from './view/statusrenderer';
import { ToolbarWidget } from './view/toolbarwidget';
import { ErrorHandler } from './errorhandler';
import { HeaderWidget } from './view/headerwidget';
import { CellWidget } from './view/cellwidget';
import { julynterNewIcon, julynterIcon } from '../iconimports';

/**
 * Timeout for throttling Julynter rendering.
 */
const RENDER_TIMEOUT = 1000;

/**
 * A widget for hosting a notebook julynter.
 */
export class Julynter extends Panel {
  private _docmanager: IDocumentManager;
  private _labShell: ILabShell;
  private _currentWidget: Widget | null;
  private _visibleWidget: Widget | null;
  private _currentHandler: NotebookHandler | null;
  private _monitor: ActivityMonitor<any, any> | null;
  private _tracker: INotebookTracker | null;
  private _config: Config;
  private _experimentManager: ExperimentManager;
  private _status: IJulynterStatus;
  private _eh: ErrorHandler;
  private _mainWidget: Panel;
  public handlers: { [id: string]: Promise<NotebookHandler> };

  /**
   * Create a new table of contents.
   */
  constructor(
    docmanager: IDocumentManager,
    tracker: INotebookTracker,
    labShell: ILabShell,
    eh: ErrorHandler
  ) {
    super();
    this._mainWidget = null;
    this._docmanager = docmanager;
    this._labShell = labShell;
    this._tracker = tracker;
    this._eh = eh;
    this.handlers = {};

    this._status = {
      connectedOnce: false,
      connectedNow: false,
      serverSide: false,
      hasKernel: false,
      experiment: false,
    };
    this._currentHandler = null;
    this._visibleWidget = null;
    this._experimentManager = new ExperimentManager(docmanager);
    this._config = new Config(this._experimentManager.config, this._status, eh);
  }

  addNewNotebook(nbPanel: NotebookPanel): void {
    //A promise that resolves after the initialization of the handler is done.
    try {
      const handlers = this.handlers;
      const update = this.update.bind(this);
      const experimentmanager = this._experimentManager;
      const config = this._config;
      const docManager = this._docmanager;
      const status = this._status;
      const errorhandler = this._eh;
      this.handlers[nbPanel.id] = new Promise((resolve, reject) => {
        const session = nbPanel.sessionContext;
        const handler = new NotebookHandler(
          docManager,
          session,
          nbPanel,
          config,
          experimentmanager,
          errorhandler,
          update
        );
        const scripts = session.ready.then(
          handler.getKernelLanguage.bind(handler)
        );
        scripts.then((language: IKernelMatcher) => {
          status.connectedOnce = true;
          handler.configureHandler(language);
        });
        scripts.catch((result: string) => {
          this._eh.report(result, 'Julynter:addNewNotebook.session', [
            nbPanel.title.label,
            session.kernelDisplayName,
          ]);
          reject(result);
        });

        nbPanel.disposed.connect(() => {
          delete handlers[nbPanel.id];
          handler.dispose();
        });
        experimentmanager.reportNotebookCode(handler);
        resolve(handler);
      });
    } catch (error) {
      throw this._eh.report(error, 'Julynter:addNewNotebook', [
        nbPanel.title.label,
      ]);
    }
  }

  changeActiveWidget(widget: Widget): void {
    try {
      this._currentWidget = widget;
      const future = this.handlers[widget.id];
      if (future !== undefined) {
        future.then((source: NotebookHandler) => {
          this.currentHandler = source;
        });
      } else if (this._currentHandler !== null) {
        this.currentHandler = null;
      }
    } catch (error) {
      throw this._eh.report(error, 'Julynter:changeActiveWidget', [
        widget.title.label,
      ]);
    }
  }

  updateJulynter(): void {
    try {
      if (this._mainWidget !== null && this.contains(this._mainWidget)) {
        this._mainWidget.dispose();
        this._mainWidget = null;
      }
      let title = 'Julynter';
      let listWidget: Widget = null;
      let toolbarWidget: Widget = null;
      this.title.icon = julynterIcon.bindprops({ stylesheet: 'sideBar' });
      this._status.connectedNow = false;
      this._status.hasKernel = false;

      if (this.currentHandler) {
        for (const cellLint of Object.values(this._currentHandler.cellLints)) {
          cellLint.dispose();
        }
        this._currentHandler.cellLints = {};
        this._status.connectedNow = true;
        this._status.hasKernel = this.currentHandler.hasKernel;
        const lintResult: ILintingResult = this.currentHandler.lint();
        const reports = lintResult.visible;
        this._visibleWidget = this.currentHandler.nbPanel;
        if (reports.length > 0) {
          this.title.icon = julynterNewIcon.bindprops({
            stylesheet: 'sideBar',
          });
        }
        reports.forEach((report) => {
          if (typeof report.cellId === 'number') {
            const cell = this._currentHandler.nbPanel.content.widgets[
              report.cellId
            ];
            this._currentHandler.cellLints[report.cellId] = new CellWidget(
              this._currentHandler,
              cell
            );
            (cell.layout as PanelLayout).insertWidget(
              0,
              this._currentHandler.cellLints[report.cellId]
            );
          }
        });

        title = this._currentHandler.name;
        const listOptions = {
          reports: reports,
          notebook: this.currentHandler,
          errorHandler: this._eh,
          cellLints: this._currentHandler.cellLints,
        };
        listWidget = new ListWidget(listOptions);
        toolbarWidget = new ToolbarWidget({
          tracker: this._tracker,
          handlers: this.handlers,
          config: this._config,
          notebook: this.currentHandler,
          labShell: this._labShell,
          errorHandler: this._eh,
          filtered: lintResult.filteredIndividual,
        });
      } else {
        listWidget = new EmptyListWidget();
      }
      const headerWidget = new HeaderWidget(
        title,
        this._status,
        this._eh,
        this.updateJulynter.bind(this)
      );
      this._mainWidget = new Panel();
      this._mainWidget.addClass('jp-Julynter');
      this._mainWidget.addWidget(headerWidget);
      if (toolbarWidget) {
        this._mainWidget.addWidget(toolbarWidget);
      }
      this._mainWidget.addWidget(listWidget);
      this.addWidget(this._mainWidget);
    } catch (error) {
      throw this._eh.report(error, 'Julynter:updateJulynter', []);
    }
  }

  /**
   * Rerender after showing.
   */
  protected onAfterShow(msg: Message): void {
    try {
      this._experimentManager.reportVisibility(this._currentHandler, true);
      this.update();
    } catch (error) {
      throw this._eh.report(error, 'Julynter:onAfterShow', []);
    }
  }

  /**
   * Notify after hide.
   */
  protected onAfterHide(msg: Message): void {
    try {
      this._experimentManager.reportVisibility(this._currentHandler, false);
    } catch (error) {
      throw this._eh.report(error, 'Julynter:onAfterHide', []);
    }
  }

  /**
   * Handle an update request.
   */
  protected onUpdateRequest(msg: Message): void {
    try {
      this.updateJulynter();
    } catch (error) {
      throw this._eh.report(error, 'Julynter:onUpdateRequest', []);
    }
  }

  dispose(): void {
    try {
      if (this.isDisposed) {
        return;
      }
      this._currentHandler.disconnectHandler();
      this._currentHandler = null;
      super.dispose();
    } catch (error) {
      throw this._eh.report(error, 'Julynter:dispose', []);
    }
  }

  get currentHandler(): NotebookHandler {
    return this._currentHandler;
  }

  set currentHandler(newHandler: NotebookHandler) {
    try {
      const widget = this._currentWidget;
      if (this._currentHandler !== newHandler) {
        if (this._currentHandler !== null) {
          this._currentHandler.disconnectHandler();
        }
        this._currentHandler = newHandler;
        if (this._currentHandler !== null) {
          this._currentHandler.connectHandler();
        }
      }
      if (!newHandler || widget !== newHandler.nbPanel) {
        this.updateJulynter();
        return;
      }
      if (this._tracker.has(widget) && widget !== this._visibleWidget) {
        // Dispose an old activity monitor if it existsd
        if (this._monitor) {
          this._monitor.dispose();
          this._monitor = null;
        }

        // Find the document model associated with the widget.
        const context = this._docmanager.contextForWidget(widget);
        if (!context || !context.model) {
          throw Error('Could not find a context for Julynter');
        }

        // Throttle the rendering rate of julynter.
        this._monitor = new ActivityMonitor({
          signal: context.model.contentChanged,
          timeout: RENDER_TIMEOUT,
        });
        this._monitor.activityStopped.connect(this.update, this);
        this._experimentManager.reportVisibility(this._currentHandler, true);
      }
      this.updateJulynter();
    } catch (error) {
      throw this._eh.report(error, 'Julynter:set currentHandler', [
        newHandler.name,
      ]);
    }
  }
}
