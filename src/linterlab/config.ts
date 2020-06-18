import { requestAPI } from '../server';
import { IJulynterLintOptions } from "../linter/interfaces"
import { OptionsManager } from './optionsmanager';

export class Config {

  public optionsManager: OptionsManager | null;
  public defaultOptions: IJulynterLintOptions;

  constructor() {
    this.defaultOptions = {
      "invalid-title": true,
      "hidden-state": true,
      "confuse-notebook": true,
      "import": true,
      "absolute-path": true,
      "mode": "type",
      "requirements": "requirements.txt"
    };
    this.optionsManager = null;
    this.load();
  }

  loadData(data:any) {
    if ({}.hasOwnProperty.call(data, 'options')) {
      for (let key in data.options) {
        (this.defaultOptions as any)[key] = data.options[key];
      }
      if (this.optionsManager !== null) {
        this.optionsManager.reloadOptions();
      }
    }
  }

  load() {
    requestAPI<any>('config')
    .then(data => {
      this.loadData(data);
    })
    .catch(reason => {
      console.error(
        `The julynter server extension appears to be missing.\n${reason}`
      );
    });
  }


}