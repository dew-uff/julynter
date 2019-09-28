import { ISanitizer } from '@jupyterlab/apputils';

import { INotebookTracker } from '@jupyterlab/notebook';

import { JulynterRegistry } from '../registry';

import { Julynter } from '../julynter';


export class NotebookGeneratorOptionsManager extends JulynterRegistry.IGeneratorOptionsManager {
  private _preRenderedToolbar: any = null;
  private _notebook: INotebookTracker;
  private _widget: Julynter;
  private _checks: { [id: string]: boolean};
  
  constructor(widget: Julynter, notebook: INotebookTracker) {
    super();
    this._checks = {};
    this._widget = widget;
    this._notebook = notebook;
  }

  readonly sanitizer: ISanitizer;

  set notebookMetadata(value: [string, any]) {
    if (this._notebook.currentWidget != null) {
      this._notebook.currentWidget.model.metadata.set(value[0], value[1]);
    }
  }

  setCheck(key: string, value: boolean){
    key = key.replace(' ', '-').toLowerCase();
    this._checks[key] = value;
    this.notebookMetadata = ['julynter-check-' + key, value];
    this._widget.update();

  }

  check(key: string) {
    key = key.replace(' ', '-').toLowerCase();
    return this._checks[key];
  }

  get checks() {
    return this._checks;
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
    checks: { [id: string]: boolean},
  ) {
    this._checks = checks;
    this._widget.update();
  }

  
}