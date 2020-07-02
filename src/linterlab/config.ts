import { requestAPI } from '../server';
import {
  ErrorTypeKeys,
  IJulynterLintOptions,
  ReportIds
} from '../linter/interfaces';
import {
  IExperimentConfig,
  IExperimentConfigAttributes
} from './experimentmanager';
import { IJulynterStatus } from './view/statusrenderer';

export class Config {
  public defaultOptions: IJulynterLintOptions;
  public experimentConfig: IExperimentConfig;
  public status: IJulynterStatus;

  constructor(experimentConfig: IExperimentConfig, status: IJulynterStatus) {
    this.defaultOptions = this.createDefault();
    this.experimentConfig = experimentConfig;
    this.status = status;
    this.load();
  }

  createDefault(): IJulynterLintOptions {
    return {
      mode: 'type',
      requirements: 'requirements.txt',
      types: {
        invalidtitle: true,
        hiddenstate: true,
        confusenotebook: true,
        import: true,
        absolutepath: true
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
        t7: true
      }
    };
  }

  loadData(
    options: IJulynterLintOptions,
    experiment: IExperimentConfig,
    data: any
  ): void {
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
  }

  load(onSuccess?: (data: any) => void, onError?: (reason: any) => void): void {
    requestAPI<any>('config')
      .then(data => {
        this.loadData(this.defaultOptions, this.experimentConfig as any, data);
        if (onSuccess) {
          onSuccess(data);
        }
      })
      .catch(reason => {
        this.status.serverSide = false;
        this.status.overrideMessage = `The julynter server extension appears to be missing.\n${reason}`;
        console.error(
          `The julynter server extension appears to be missing.\n${reason}`
        );
        if (onError) {
          onError(reason);
        }
      });
  }

  loadUser(): Promise<IJulynterLintOptions> {
    return requestAPI<any>('userconfig').then(data => {
      const config = this.createDefault();
      this.loadData(config, null, data);
      return config;
    });
  }

  loadProject(): Promise<IJulynterLintOptions> {
    return requestAPI<any>('config').then(data => {
      const config = this.createDefault();
      this.loadData(config, null, data);
      this.loadData(this.defaultOptions, this.experimentConfig as any, data);
      return config;
    });
  }

  saveProject(options: IJulynterLintOptions): Promise<any> {
    this.defaultOptions = options;
    return requestAPI<any>('config', {
      body: JSON.stringify({ options: options }),
      method: 'POST'
    });
  }

  saveUser(options: IJulynterLintOptions): Promise<any> {
    return requestAPI<any>('userconfig', {
      body: JSON.stringify({ options: options }),
      method: 'POST'
    }).then(data => {
      this.load();
      return data;
    });
  }

  merge(
    original: IJulynterLintOptions,
    newOptions: IJulynterLintOptions
  ): void {
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
  }
}
