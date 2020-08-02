import { requestAPI } from '../server';
import {
  ErrorTypeKeys,
  IJulynterLintOptions,
  ReportIds,
} from '../linter/interfaces';
import {
  IExperimentConfig,
  IExperimentConfigAttributes,
} from './experimentmanager';
import { IJulynterStatus } from './view/statusrenderer';
import { ErrorHandler } from './errorhandler';

export class Config {
  public defaultOptions: IJulynterLintOptions;
  public experimentConfig: IExperimentConfig;
  public status: IJulynterStatus;
  private _eh: ErrorHandler;

  constructor(
    experimentConfig: IExperimentConfig,
    status: IJulynterStatus,
    eh: ErrorHandler
  ) {
    this._eh = eh;
    this.defaultOptions = this.createDefault();
    this.experimentConfig = experimentConfig;
    this.status = status;
    this.load();
  }

  createDefault(): IJulynterLintOptions {
    return {
      mode: 'type',
      view: true,
      restart: true,
      requirements: 'requirements.txt',
      types: {
        invalidtitle: true,
        hiddenstate: true,
        confusenotebook: true,
        import: true,
        absolutepath: true,
      },
      reports: {
        c1: true,
        c2: true,
        c3: true,
        c4: true,
        c5: true,
        h1: true,
        h2: true,
        h3: true,
        h4: true,
        h5: true,
        h6: true,
        i1: true,
        i2: true,
        p1: true,
        t1: true,
        t2: true,
        t3: true,
        t4: true,
        t5: true,
        t6: true,
        t7: true,
      },
    };
  }

  loadData(
    options: IJulynterLintOptions,
    experiment: IExperimentConfig,
    data: any
  ): void {
    /* eslint @typescript-eslint/explicit-module-boundary-types: 0 */
    try {
      if (options) {
        this.merge(options, data.options);
      }

      if (experiment) {
        const dataExperiment: IExperimentConfig = data.experiment;
        if (dataExperiment) {
          for (const key of IExperimentConfigAttributes) {
            const value = dataExperiment[key];
            if (value !== undefined && value !== null) {
              experiment[key] = value;
            }
          }
        } else {
          experiment.enabled = false;
        }
        this.status.experiment = experiment.enabled as boolean;
      } else {
        this.status.experiment = false;
      }
    } catch (error) {
      throw this._eh.report(error, 'Config:loadData', [
        options,
        experiment,
        data,
      ]);
    }
  }

  load(onSuccess?: (data: any) => void, onError?: (reason: any) => void): void {
    try {
      requestAPI<any>('config')
        .then((data) => {
          this.loadData(
            this.defaultOptions,
            this.experimentConfig as any,
            data
          );
          if (onSuccess) {
            onSuccess(data);
          }
        })
        .catch((reason) => {
          this.status.serverSide = false;
          this._eh.report(
            `The julynter server extension appears to be missing.\n${reason}`,
            'Config:loadData',
            []
          );
          if (onError) {
            onError(reason);
          }
        });
    } catch (error) {
      throw this._eh.report(error, 'Config:load', []);
    }
  }

  loadUser(): Promise<IJulynterLintOptions> {
    try {
      return requestAPI<any>('userconfig').then((data) => {
        const config = this.createDefault();
        this.loadData(config, null, data);
        return config;
      });
    } catch (error) {
      throw this._eh.report(error, 'Config:loadUser', []);
    }
  }

  loadProject(): Promise<IJulynterLintOptions> {
    try {
      return requestAPI<any>('config').then((data) => {
        const config = this.createDefault();
        this.loadData(config, null, data);
        this.loadData(this.defaultOptions, this.experimentConfig as any, data);
        return config;
      });
    } catch (error) {
      throw this._eh.report(error, 'Config:loadProject', []);
    }
  }

  saveProject(options: IJulynterLintOptions): Promise<any> {
    try {
      this.defaultOptions = options;
      return requestAPI<any>('config', {
        body: JSON.stringify({ options: options }),
        method: 'POST',
      });
    } catch (error) {
      throw this._eh.report(error, 'Config:saveProject', [options]);
    }
  }

  saveUser(options: IJulynterLintOptions): Promise<any> {
    try {
      return requestAPI<any>('userconfig', {
        body: JSON.stringify({ options: options }),
        method: 'POST',
      }).then((data) => {
        this.load();
        return data;
      });
    } catch (error) {
      throw this._eh.report(error, 'Config:saveUser', [options]);
    }
  }

  merge(
    original: IJulynterLintOptions,
    newOptions: IJulynterLintOptions
  ): void {
    try {
      if (!newOptions) {
        return;
      }
      if (newOptions.mode !== undefined) {
        original.mode = newOptions.mode;
      }
      if (newOptions.requirements !== undefined) {
        original.requirements = newOptions.requirements;
      }
      if (newOptions.types !== undefined) {
        for (const key of ErrorTypeKeys) {
          const value = newOptions.types[key];
          if (value !== undefined) {
            original.types[key] = value;
          }
        }
      }
      if (newOptions.reports !== undefined) {
        for (const key of ReportIds) {
          const value = newOptions.reports[key];
          if (value !== undefined) {
            original.reports[key] = value;
          }
        }
      }
    } catch (error) {
      throw this._eh.report(error, 'Config:merge', [original, newOptions]);
    }
  }
}
