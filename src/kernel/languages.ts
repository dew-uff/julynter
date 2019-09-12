export namespace Languages {
    export type LanguageModel = {
        initScript: string;
        queryCommand: string;
    }
}

export
    abstract class Languages {
    /**
     * Init and query script for supported languages.
     */

    static py_script: string = `import json
def _jupyterlab_julynter_query():
    ip = get_ipython()
    executed_code = {}
    history_manager = ip.history_manager
    hist = history_manager.get_range(raw=True, output=False)
    for session, lineno, inline in hist:
        executed_code[lineno] = inline
    result = {"executed_code": executed_code}
    return json.dumps(result, ensure_ascii=False)
print("ok-initialized")
`;

    
    static scripts: { [index: string]: Languages.LanguageModel } = {
        "python3": {
            initScript: Languages.py_script,
            queryCommand: "_jupyterlab_julynter_query()",
        },
        "python2": {
            initScript: Languages.py_script,
            queryCommand: "_jupyterlab_julynter_query()",
        },
        "python": {
            initScript: Languages.py_script,
            queryCommand: "_jupyterlab_julynter_query()",
        },
    };

    public static getScript( lang: string ): Promise<Languages.LanguageModel> {
        return new Promise( function( resolve, reject ) {
            if ( lang in Languages.scripts ) {
                resolve( Languages.scripts[lang] );
            } else {
                reject( "Language " + lang + " not supported yet!" );
            }
        } );

    }

}

