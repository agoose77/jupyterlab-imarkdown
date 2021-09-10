import {JupyterFrontEnd, JupyterFrontEndPlugin} from '@jupyterlab/application';
import {plugin} from "./plugin"
import {NotebookPanel} from '@jupyterlab/notebook';
import {IEditorServices} from '@jupyterlab/codeeditor';


class IMarkdownContentFactory extends NotebookPanel.ContentFactory {

}


/**
 * The notebook cell factory provider.
 */
const factory: JupyterFrontEndPlugin<NotebookPanel.IContentFactory> = {
  id: '@agoose77/jupyterlab-imarkdown:factory',
  provides: NotebookPanel.IContentFactory,
  requires: [IEditorServices],
  autoStart: true,
  activate: (app: JupyterFrontEnd, editorServices: IEditorServices) => {
    console.log("Using jupyterlab-imarkdown")
    const editorFactory = editorServices.factoryService.newInlineEditor;
    return new IMarkdownContentFactory({ editorFactory });
  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [factory, plugin];
export default plugins;
