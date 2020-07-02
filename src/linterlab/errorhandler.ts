export class ErrorHandler {
  private _id: number;

  constructor() {
    this._id = 0;
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

    console.error('Found error:', func, error, params);
    return error;
  }
}
