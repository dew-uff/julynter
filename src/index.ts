import {
  JupyterFrontEnd, JupyterFrontEndPlugin
} from '@jupyterlab/application';


/**
 * Initialization data for the julint extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'julint',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension julint is activated!');
  }
};

export default extension;
