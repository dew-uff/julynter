import { requestAPI } from '../server';
import { IJulynterLintOptions } from "../linter/interfaces"
import { IExperimentConfig } from './experimentmanager';

export class Config {

  public defaultOptions: IJulynterLintOptions;
  public experimentConfig: IExperimentConfig;

  constructor(experimentConfig: IExperimentConfig) {
    this.defaultOptions = {
      "invalid-title": true,
      "hidden-state": true,
      "confuse-notebook": true,
      "import": true,
      "absolute-path": true,
      "mode": "type",
      "requirements": "requirements.txt"
    };
    this.experimentConfig = experimentConfig;
    this.load();
  }

  loadData(data:any) {
    if ({}.hasOwnProperty.call(data, 'options')) {
      for (let key in data.options) {
        (this.defaultOptions as any)[key] = data.options[key];
      }
    }
    if ({}.hasOwnProperty.call(data, 'experiment')) {
      for (let key in data.experiment) {
        (this.experimentConfig as any)[key] = data.experiment[key];
      }
    } else {
      this.experimentConfig.enabled = false;
    }
  }

  load(onSuccess?: (data:any) => void, onError?: (reason:any) => void) {
    requestAPI<any>('config')
    .then(data => {
      this.loadData(data);
      if (onSuccess) {
        onSuccess(data);
      }
    })
    .catch(reason => {
      console.error(
        `The julynter server extension appears to be missing.\n${reason}`
      );
      if (onError) {
        onError(reason);
      }
    });
  }


}