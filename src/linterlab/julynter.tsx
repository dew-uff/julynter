
import { ActivityMonitor, PathExt } from '@jupyterlab/coreutils';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { Message } from '@phosphor/messaging';

import { Widget } from '@phosphor/widgets';

import { JulynterRegistry } from './registry';

import { IReport } from '../linter/interfaces';


import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { IJulynterKernelUpdate, IJulynterKernelHandler } from './kernel/interfaces';
import { INotebookTracker } from '@jupyterlab/notebook';

/**
 * Timeout for throttling Julynter rendering.
 */
const RENDER_TIMEOUT = 1000;



/**
 * A widget for hosting a notebook julynter.
 */
export class Julynter extends Widget {

  private _toolbar: any;
  private _docmanager: IDocumentManager;
  private _current: Julynter.ICurrentWidget | null;
  private _monitor: ActivityMonitor<any, any> | null;
  private _handler: IJulynterKernelHandler | null;
  private _tracker: INotebookTracker | null;

  /**
   * Create a new table of contents.
   */
  constructor(docmanager: IDocumentManager, tracker: INotebookTracker) {
    super();
    this._handler = null;
    this._docmanager = docmanager;
    this._tracker = tracker;
  }

  /**
   * The current widget-generator tuple for the Julynter.
   */
  get current(): Julynter.ICurrentWidget | null {
    return this._current;
  }
  set current(value: Julynter.ICurrentWidget | null) {
    // If they are the same as previously, do nothing.
    if (
      value &&
      this._current &&
      this._current.widget === value.widget &&
      this._current.generator === value.generator
    ) {
      return;
    }
    this._current = value;

    if (this.generator && this.generator.toolbarGenerator) {
      this._toolbar = this.generator.toolbarGenerator();
    }

    // Dispose an old activity monitor if it existsd
    if (this._monitor) {
      this._monitor.dispose();
      this._monitor = null;
    }
    // If we are wiping the Julynter, update and return.
    if (!this._current) {
      this.updateJulynter();
      return;
    }

    // Find the document model associated with the widget.
    const context = this._docmanager.contextForWidget(this._current.widget);
    if (!context || !context.model) {
      throw Error('Could not find a context for Julynter');
    }

    // Throttle the rendering rate of julynter.
    this._monitor = new ActivityMonitor({
      signal: context.model.contentChanged,
      timeout: RENDER_TIMEOUT
    });
    this._monitor.activityStopped.connect(this.update, this);
    this.updateJulynter();
  }

  /**
   * Handle an update request.
   */
  protected onUpdateRequest(msg: Message): void {
    // Don't bother if the Julynter is not visible
    /* if (!this.isVisible) {
      return;
    } */
    this.updateJulynter();
  }

  updateJulynter() {
    let julynter: IReport[] = [];
    let title = 'Julynter';
    if (this._current) {
      julynter = this._current.generator.generate(this._current.widget);
      const context = this._docmanager.contextForWidget(this._current.widget);
      if (context) {
        title = PathExt.basename(context.localPath);
      }
    }
    let itemRenderer: (item: IReport) => JSX.Element | null = (
      item: IReport
    ) => {
      return <span>{item.text}</span>;
    };
    if (this._current && this._current.generator.itemRenderer) {
      itemRenderer = this._current.generator.itemRenderer!;
    }
    let renderedJSX = (
      <div className="jp-Julynter">
        <header>{title}</header>
      </div>
    );
    if (this._current && this._current.generator) {
      renderedJSX = (
        <JulynterTree
          title={title}
          julynter={julynter}
          generator={this.generator}
          itemRenderer={itemRenderer}
          toolbar={this._toolbar}
        />
      );
    }
    ReactDOM.render(renderedJSX, this.node, () => {
      
    });
  }

  get generator() {
    if (this._current) {
      return this._current.generator;
    }
    return null;
  }

  get docManager() {
    return this._docmanager;
  }

  get tracker() {
    return this._tracker;
  }

  /**
   * Rerender after showing.
   */
  protected onAfterShow(msg: Message): void {
    this.update();
  }

  get handler(): IJulynterKernelHandler | null {
    return this._handler;
  }

  set handler(handler: IJulynterKernelHandler | null) {
    if (this._handler === handler) {
      return;
    }
    //Remove old subscriptions
    if (this._handler) {
      this._handler.inspected.disconnect( this.onInspectorUpdate, this );
      this._handler.disposed.disconnect( this.onSourceDisposed, this );
    }
    this._handler = handler;
    //Subscribe to new object
    if ( this._handler ) {
        this._handler.inspected.connect( this.onInspectorUpdate, this );
        this._handler.disposed.connect( this.onSourceDisposed, this );
        this._handler.performQuery();
    }

  }

  dispose(): void {
    if ( this.isDisposed ) {
        return;
    }
    this.handler = null;
    super.dispose();
  }

  protected onInspectorUpdate( sender: any, allArgs: IJulynterKernelUpdate): void {
    let generator = this.generator;
    if (generator !== null) {
      generator.processKernelMessage(allArgs);
    }
  }

  /**
   * Handle disposed signals.
   */
  protected onSourceDisposed( sender: any, args: void ): void {
      this.handler = null;
  }



  
}


/**
 * A namespace for Julynter statics.
 */
export namespace Julynter {

  /**
   * A type representing a tuple of a widget,
   * and a generator that knows how to generate
   * heading information from that widget.
   */
  export interface ICurrentWidget<W extends Widget = Widget> {
    widget: W;
    generator: JulynterRegistry.IGenerator<W>;
  }
}

/**
 * Props for the JulynterItem component.
 */
export interface IJulynterItemProps extends React.Props<JulynterItem> {
  /**
   * An IHeading to render.
   */
  heading: IReport;
  itemRenderer: (item: IReport) => JSX.Element | null;
}

export interface IJulynterItemStates {}

/**
 * A React component for a table of contents entry.
 */
export class JulynterItem extends React.Component<IJulynterItemProps, IJulynterItemStates> {
  /**
   * Render the item.
   */
  render() {
    const { heading } = this.props;

    // Create an onClick handler for the Julynter item
    // that scrolls the anchor into view.
    const handleClick = (event: React.SyntheticEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
      heading.onClick();
    };

    let content = this.props.itemRenderer(heading);
    return content && <li onClick={handleClick}>{content}</li>;
  }
}

export interface IJulynterTreeStates {}

/**
 * Props for the JulynterTree component.
 */
export interface IJulynterTreeProps extends React.Props<JulynterTree> {
  /**
   * A title to display.
   */
  title: string;

  /**
   * A list of IHeadings to render.
   */
  julynter: IReport[];
  toolbar: any;
  generator: JulynterRegistry.IGenerator<Widget> | null;
  itemRenderer: (item: IReport) => JSX.Element | null;
}

/**
 * A React component for julynter tree
 */
export class JulynterTree extends React.Component<IJulynterTreeProps, IJulynterTreeStates> {
  /**
   * Render the JulynterTree.
   */

  render() {
    // Map the heading objects onto a list of JSX elements.
    let i = 0;
    const Toolbar = this.props.toolbar;
    let listing: JSX.Element[] = this.props.julynter.map(el => {
      console.log(el)
      return (
        <JulynterItem
          heading={el}
          itemRenderer={this.props.itemRenderer}
          key={`${el.text}-${i++}`}
        />
      );
    });
    return (
      <div className="jp-Julynter">
        <header>{this.props.title}</header>
        {Toolbar && <Toolbar />}
        <ul className="jp-Julynter-content">{listing}</ul>
      </div>
    );
  }
}