import { requestAPI } from '../server';

export class ErrorHandler {
  private _id: number;

  constructor() {
    this._id = 0;

    if (!('toJSON' in Error.prototype)) {
      Object.defineProperty(Error.prototype, 'toJSON', {
        value: function() {
          const alt = {};

          Object.getOwnPropertyNames(this).forEach(key => {
            (alt as any)[key] = (this as any)[key];
          }, this);

          return alt;
        },
        configurable: true,
        writable: true
      });
    }
  }

  report(error: any, func: string, params: any): any {
    if ({}.hasOwnProperty.call(this, 'julynterId')) {
      error.JulynterParent = error.julynterId;
    }
    if (typeof error === 'object') {
      error.julynterId = this._id++;
    } else {
      error = {
        julynterId: this._id++,
        message: error,
        otype: typeof error
      };
    }
    const result = {
      error: error,
      func: func,
      params: params,
      date: new Date()
    };
    requestAPI<any>('error', {
      body: JSON.stringify(result),
      method: 'POST'
    }).catch(reason => {
      console.error(
        `The julynter server extension appears to be missing.\n${reason}`
      );
      return reason;
    });
    console.error('Found error:', func, error, params);
    return error;
  }
}
