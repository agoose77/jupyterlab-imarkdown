import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { plugin } from './plugin';
import {
  INotebookTracker,
  Notebook,
  NotebookActions,
  NotebookPanel,
  StaticNotebook
} from '@jupyterlab/notebook';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { Cell, MarkdownCell } from '@jupyterlab/cells';
import { XMarkdownCell } from './cell';
import { executeUserExpressions } from './kernel';

class XMarkdownContentFactory extends NotebookPanel.ContentFactory {
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
    return new XMarkdownCell(options).initializeState();
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
    return new XMarkdownContentFactory({ editorFactory });
  }
};

function isMarkdownCell(cell: Cell): cell is XMarkdownCell {
  return cell.model.type === 'markdown';
}

/**
 * The notebook cell executor.
 */
const executor: JupyterFrontEndPlugin<void> = {
  id: '@agoose77/jupyterlab-imarkdown:executor',
  requires: [INotebookTracker],
  autoStart: true,
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('Using jupyterlab-imarkdown:executor');

    const executed = NotebookActions.executed;
    executed.connect(
      (sender: any, value: { notebook: Notebook; cell: Cell }) => {
        const { notebook, cell } = value;
        // Find the Notebook panel
        const panel = tracker.find((w: NotebookPanel) => {
          return w.content === notebook;
        });
        // Retrieve the kernel context
        const ctx = panel?.sessionContext;
        if (ctx === undefined) {
          return;
        }
        // Load the user expressions for the given cell.
        if (!isMarkdownCell(cell)) {
          return;
        }
        console.debug(
          `Markdown cell ${cell.model.id} was executed, waiting for render to complete ...`
        );

        cell.doneRendering.then(() => {
          console.debug(
            `Loading results from kernel for cell ${cell.model.id}`
          );
          executeUserExpressions(cell, ctx).then(() => {
            console.debug(`Re-rendering cell ${cell.model.id}`);
            cell.renderExpressionsFromMetadata();
          });
        });
      }
    );

    return;
  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [factory, executor, plugin];
export default plugins;
