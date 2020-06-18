import { IJulynterKernelUpdate } from './kernel/interfaces';
import { IJulynterKernelHandler } from "./kernel/interfaces";
import { IQueryResult } from '../linter/interfaces';
/**
 * A class that stores the current notebook handler
 */
export class JulynterNotebook {
  private _handler: IJulynterKernelHandler | null;
  public update : IQueryResult | null;
  public hasKernel: boolean;
 
  constructor() {
    this._handler = null;
    this.update = {};
    this.hasKernel = false;
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
    this.update = {};
    this.hasKernel = false;
    //Subscribe to new object
    if ( this._handler ) {
        this._handler.inspected.connect( this.onInspectorUpdate, this );
        this._handler.disposed.connect( this.onSourceDisposed, this );
        this._handler.performQuery();
    }
  }

  /**
   * Handle kernel signals.
   */
  protected onInspectorUpdate( sender: any, update: IJulynterKernelUpdate): void {
    if (update.status != ""){
      this.update = {};
      this.hasKernel = false;
    } else {
      this.hasKernel = true;
      this.update = update.result;
    }
  }

  /**
   * Handle disposed signals.
   */
  protected onSourceDisposed( sender: any, args: void ): void {
      this.handler = null;
  }
    
}