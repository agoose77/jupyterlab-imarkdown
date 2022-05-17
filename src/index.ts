import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import {
  INotebookTracker,
  Notebook,
  NotebookActions,
  NotebookPanel,
  StaticNotebook
} from '@jupyterlab/notebook';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { Cell, MarkdownCell } from '@jupyterlab/cells';
import { IMarkdownCell } from './cell';
import { notebookExecuted } from './actions';

class IMarkdownContentFactory extends NotebookPanel.ContentFactory {
  /**
   * Create a new markdown cell widget.
   *
   * #### Notes
   * If no cell content factory is passed in with the options, the one on the
   * notebook content factory is used.
   */
  createMarkdownCell(
    options: MarkdownCell.IOptions,
    parent: StaticNotebook
  ): MarkdownCell {
    if (!options.contentFactory) {
      options.contentFactory = this;
    }
    return new IMarkdownCell(options).initializeState();
  }
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
    console.log('Using jupyterlab-imarkdown:editor');
    const editorFactory = editorServices.factoryService.newInlineEditor;
    return new IMarkdownContentFactory({ editorFactory });
  }
};

/**
 * The notebook cell executor.
 */
const executor: JupyterFrontEndPlugin<void> = {
  id: '@agoose77/jupyterlab-imarkdown:executor',
  requires: [INotebookTracker],
  autoStart: true,
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('Using jupyterlab-imarkdown:executor');

    NotebookActions.executed.connect(
      (sender: any, value: { notebook: Notebook; cell: Cell }) => {
        const { notebook, cell } = value;
        notebookExecuted(notebook, cell, tracker);
      }
    );

    return;
  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [factory, executor];
export default plugins;
