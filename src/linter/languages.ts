export namespace Languages {
  export type LanguageModel = {
    initScript: string;
    name: string;
  };
}

export abstract class Languages {
  /**
   * Init and query script for supported languages.
   */

  static PYTHON: Languages.LanguageModel = {
    initScript: 'import julynter.kernel; julynter.kernel.init()',
    name: 'python',
  };

  static GENERIC: Languages.LanguageModel = {
    initScript: null,
    name: 'generic',
  };

  static scripts: { [index: string]: Languages.LanguageModel } = {
    python3: Languages.PYTHON,
    python2: Languages.PYTHON,
    python: Languages.PYTHON,
    generic: Languages.GENERIC,
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
