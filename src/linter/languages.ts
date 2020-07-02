export namespace Languages {
  export type LanguageModel = {
    initScript: string | (() => string);
    queryCommand: string | ((requirements: string) => string);
    addModuleCommand: string | ((module: string, requirements: string) => string);
    julynterCode: (code: string) => boolean;
    name: string;
  };

  export type ExecutableCode = 'initScript' | 'queryCommand' | 'addModuleCommand';
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
    julynterCode: (code: string) => {
      return code.startsWith('julynter.kernel._jupyterlab_julynter');
    },
    name: 'python'
  };

  static GENERIC: Languages.LanguageModel = {
    initScript: null,
    queryCommand: null,
    addModuleCommand: null,
    julynterCode: (code: string) => false,
    name: 'generic'
  }

  static scripts: { [index: string]: Languages.LanguageModel } = {
    python3: Languages.PYTHON,
    python2: Languages.PYTHON,
    python: Languages.PYTHON,
    generic: Languages.GENERIC
  };

  public static getScript(lang: string): Promise<Languages.LanguageModel> {
    return new Promise((resolve, reject) => {
      if (lang in Languages.scripts) {
        resolve(Languages.scripts[lang]);
      } else {
        resolve(Languages.scripts.generic);
      }
    });
  }
}
