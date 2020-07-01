export namespace Languages {
  export type LanguageModel = {
    initScript: string;
    queryCommand: (requirements: string) => string;
    addModuleCommand: (module: string, requirements: string) => string;
    disableQuery: (code: string) => boolean;
    name: string;
  };
}

export abstract class Languages {
  /**
   * Init and query script for supported languages.
   */

  static PYTHON: Languages.LanguageModel = {
    initScript: 'import julynter.kernel',
    queryCommand: (requirements: string) =>
      "julynter.kernel._jupyterlab_julynter_query('" + requirements + "')",
    addModuleCommand: (module: string, requirements: string) =>
      "julynter.kernel._jupyterlab_julynter_add_package_to_requirements('" +
      module +
      "','" +
      requirements +
      "')",
    disableQuery: (code: string) => {
      return code.startsWith('julynter.kernel._jupyterlab_julynter');
    },
    name: 'python'
  };

  static scripts: { [index: string]: Languages.LanguageModel } = {
    python3: Languages.PYTHON,
    python2: Languages.PYTHON,
    python: Languages.PYTHON
  };

  public static getScript(lang: string): Promise<Languages.LanguageModel> {
    return new Promise((resolve, reject) => {
      if (lang in Languages.scripts) {
        resolve(Languages.scripts[lang]);
      } else {
        reject(`Language ${lang} not supported yet!`);
      }
    });
  }
}
