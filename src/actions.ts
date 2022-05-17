import { ISessionContext } from '@jupyterlab/apputils';
import { Cell, IMarkdownCellModel } from '@jupyterlab/cells';
import { KernelMessage } from '@jupyterlab/services';
import { JSONObject } from '@lumino/coreutils';
import { IMarkdownCell } from './cell';
import { IExpressionResult } from './user_expressions';
import { IUserExpressionMetadata, metadataSection } from './metadata';
import {
  Notebook,
  NotebookPanel,
  INotebookTracker
} from '@jupyterlab/notebook';

function isMarkdownCell(cell: Cell): cell is IMarkdownCell {
  return cell.model.type === 'markdown';
}

/**
 * Load user expressions for given XMarkdown cell from kernel.
 * Store results in cell attachments.
 */
export async function executeUserExpressions(
  cell: IMarkdownCell,
  sessionContext: ISessionContext
): Promise<void> {
  // Check we have a kernel
  const kernel = sessionContext.session?.kernel;
  if (!kernel) {
    throw new Error('Session has no kernel.');
  }

  const model = cell.model as IMarkdownCellModel;
  const cellId = { cellId: model.id };

  // Build ordered map from string index to node
  const namedExpressions = new Map(
    cell.expressions.map((expr, index) => [`${index}`, expr])
  );

  // Extract expression values
  const userExpressions: JSONObject = {};
  namedExpressions.forEach((expr, key) => {
    userExpressions[key] = expr;
  });

  // Populate request data
  const content: KernelMessage.IExecuteRequestMsg['content'] = {
    code: '',
    user_expressions: userExpressions
  };

  // Perform request
  console.debug('Performing kernel request', content);
  const future = kernel.requestExecute(content, false, {
    ...model.metadata.toJSON(),
    ...cellId
  });

  // Set response handler
  future.onReply = (msg: KernelMessage.IExecuteReplyMsg) => {
    console.debug('Handling kernel response', msg);
    // Only work with `ok` results
    const content = msg.content;
    if (content.status !== 'ok') {
      console.error('Kernel response was not OK', msg);
      return;
    }

    console.debug('Clear existing metadata');
    // Clear metadata if present
    cell.model.metadata.delete(metadataSection);

    // Store results as metadata
    const expressions: IUserExpressionMetadata[] = [];
    for (const key in content.user_expressions) {
      const expr = namedExpressions.get(key);

      if (expr === undefined) {
        console.error(
          "namedExpressions doesn't have key. This should never happen"
        );
        continue;
      }
      const result = content.user_expressions[key] as IExpressionResult;

      const expressionMetadata: IUserExpressionMetadata = {
        expression: expr,
        result: result
      };
      expressions.push(expressionMetadata);

      console.debug(`Saving ${expr} to cell attachments`, expressionMetadata);
    }

    // Update cell metadata
    cell.model.metadata.set(metadataSection, expressions);
  };

  await future.done;
}

export function notebookExecuted(
  notebook: Notebook,
  cell: Cell,
  tracker: INotebookTracker
): void {
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

  cell.doneRendering
    .then(() => executeUserExpressions(cell, ctx))
    .catch(console.error)
    .then(() => cell.renderExpressionsFromMetadata())
    .catch(console.error);
}
