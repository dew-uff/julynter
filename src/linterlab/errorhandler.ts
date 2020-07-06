import { requestAPI } from '../server';

export class ErrorHandler {
  private _id: number;
  private _errorStack: string[];

  constructor() {
    this._id = 0;
    this._errorStack = [];

    if (!('toJSON' in Error.prototype)) {
      Object.defineProperty(Error.prototype, 'toJSON', {
        value: function () {
          const alt = {};

          Object.getOwnPropertyNames(this).forEach((key) => {
            (alt as any)[key] = (this as any)[key];
          }, this);

          return alt;
        },
        configurable: true,
        writable: true,
      });
    }
  }

  clear(): void {
    this._errorStack = [];
  }

  get errorStack(): string[] {
    return this._errorStack;
  }

  report(error: any, func: string, params: any): any {
    /* eslint @typescript-eslint/explicit-module-boundary-types: 0 */

    if ({}.hasOwnProperty.call(this, 'julynterId')) {
      error.JulynterParent = error.julynterId;
    }
    if (typeof error === 'object') {
      error.julynterId = this._id++;
    } else {
      error = {
        julynterId: this._id++,
        message: error,
        otype: typeof error,
      };
    }
    const date = new Date();
    const result = {
      error: error,
      func: func,
      params: params,
      date: date,
    };
    this._errorStack.push(
      `${date} - ${func}:\n  ${error.toString()}\n  ${JSON.stringify(
        params.toString()
      )}`
    );
    requestAPI<any>('error', {
      body: JSON.stringify(result),
      method: 'POST',
    }).catch((reason) => {
      console.error(
        `The julynter server extension appears to be missing.\n${reason}`
      );
      return reason;
    });
    console.error('Found error:', func, error, params);
    return error;
  }
}
