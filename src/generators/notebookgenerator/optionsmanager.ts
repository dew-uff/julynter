import { ISanitizer } from '@jupyterlab/apputils';

import { INotebookTracker } from '@jupyterlab/notebook';

import { JulynterRegistry } from '../../registry';

import { Julynter } from '../../julynter';


export class NotebookGeneratorOptionsManager extends JulynterRegistry.IGeneratorOptionsManager {
  constructor(
    widget: Julynter,
    notebook: INotebookTracker,
    options: {
      checkTitle: boolean;
    }
  ) {
    super();
    this._checkTitle = options.checkTitle;
    this._widget = widget;
    this._notebook = notebook;
  }

  readonly sanitizer: ISanitizer;

  set notebookMetadata(value: [string, any]) {
    if (this._notebook.currentWidget != null) {
      this._notebook.currentWidget.model.metadata.set(value[0], value[1]);
    }
  }

  set checkTitle(value: boolean) {
    this._checkTitle = value;
    this._widget.update();
    this.notebookMetadata = ['julynter-checktitle', this._checkTitle];
  }

  get checkTitle() {
    return this._checkTitle;
  }

  set preRenderedToolbar(value: any) {
    this._preRenderedToolbar = value;
  }

  get preRenderedToolbar() {
    return this._preRenderedToolbar;
  }

  updateWidget() {
    this._widget.update();
  }


  // initialize options, will NOT change notebook metadata
  initializeOptions(
    checkTitle: boolean,
  ) {
    this._checkTitle = checkTitle;
    this._widget.update();
  }

  private _preRenderedToolbar: any = null;
  private _checkTitle: boolean = true;
  private _notebook: INotebookTracker;
  private _widget: Julynter;
  public storeTags: string[];
}