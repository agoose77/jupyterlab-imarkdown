import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { plugin } from './plugin';
import {
  Notebook,
  INotebookTracker,
  NotebookActions,
  NotebookPanel
} from '@jupyterlab/notebook';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { MarkdownCell, IMarkdownCellModel, Cell } from '@jupyterlab/cells';
import { StaticNotebook } from '@jupyterlab/notebook/lib/widget';
import {
  IXMarkdownCellMetadata,
  JUPYTER_IMARKDOWN_METADATA_NAME,
  XMarkdownCell
} from './cell';
import { ISessionContext } from '@jupyterlab/apputils';
import { KernelMessage } from '@jupyterlab/services';
import { PartialJSONObject } from '@lumino/coreutils/src/json';

class IXMarkdownContentFactory extends NotebookPanel.ContentFactory {
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
    return new IXMarkdownContentFactory({ editorFactory });
  }
};

async function loadUserExpressions(
  cell: XMarkdownCell,
  sessionContext: ISessionContext
) {
  const model = cell.model as IMarkdownCellModel;
  const cellId = { cellId: model.id };

  // Remove existing metadata
  const existingMetadata = cell.model.metadata.get(
    JUPYTER_IMARKDOWN_METADATA_NAME
  ) as IXMarkdownCellMetadata;
  if (existingMetadata !== undefined) {
    existingMetadata.attachments.forEach(model.attachments.remove);
  }

  // Populate request data
  console.log('Building expressions');
  const content: KernelMessage.IExecuteRequestMsg['content'] = {
    code: '',
    user_expressions: cell.expressions
  };

  // Perform request
  console.log('Performing request', cell.expressions);
  const kernel = sessionContext.session?.kernel;
  if (!kernel) {
    throw new Error('Session has no kernel.');
  }
  const future = kernel.requestExecute(content, false, {
    ...model.metadata.toJSON(),
    ...cellId
  });
  future.onReply = (msg: KernelMessage.IExecuteReplyMsg) => {
    const content = msg.content;
    if (content.status !== 'ok') {
      return;
    }

    console.log('Handling response');

    // Set new metadata
    const newMetadata: IXMarkdownCellMetadata = {
      attachments: []
    };
    const userExpressionsResponse = content.user_expressions;
    console.log(userExpressionsResponse);
    for (const key in userExpressionsResponse) {
      const result = userExpressionsResponse[key]! as PartialJSONObject;
      const data = result['data'];
      console.log({ key, data });
      if (data === undefined) {
        continue;
      }

      // Generate UUID per-result
      const model = result['data'] as any;
      cell.model.attachments.set(key, model);
      console.log('Writing attachment', { key, model });
      newMetadata.attachments.push(key);
    }
    cell.model.metadata.set(JUPYTER_IMARKDOWN_METADATA_NAME, newMetadata);
  };
  await future.done;
  // await new Promise<void>();

  // cell.rendered = false;
  // cell.rendered = true;
}

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
        console.log(`Execution of ${cell.id} in ${ctx.session?.id}`);
        if (!isMarkdownCell(cell)) {
          return;
        }
        console.log('Waiting for cell to render!');

        cell.doneRendering.then(() => {
          console.log('Loading expressions from kernel');
          loadUserExpressions(cell, ctx).then(() => {
            console.log('Re-rendering!');
            cell.renderExpressions();
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
