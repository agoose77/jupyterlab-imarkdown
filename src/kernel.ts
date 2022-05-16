import { XMarkdownCell } from './cell';
import { ISessionContext } from '@jupyterlab/apputils';
import { IMarkdownCellModel } from '@jupyterlab/cells';
import { KernelMessage } from '@jupyterlab/services';
import { JSONObject } from '@lumino/coreutils';
import { IExpressionResult } from './user_expressions';
import { IUserExpressionMetadata, metadataSection } from './metadata';
/**
 * Load user expressions for given XMarkdown cell from kernel.
 * Store results in cell attachments.
 */
export async function executeUserExpressions(
  cell: XMarkdownCell,
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
  console.log(namedExpressions, cell.expressions);

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
  console.log('Performing kernel request', content);
  const future = kernel.requestExecute(content, false, {
    ...model.metadata.toJSON(),
    ...cellId
  });

  // Set response handler
  future.onReply = (msg: KernelMessage.IExecuteReplyMsg) => {
    console.log('Handling kernel response', msg);
    // Only work with `ok` results
    const content = msg.content;
    if (content.status !== 'ok') {
      console.error('Kernel response was not OK', msg);
      return;
    }

    console.log('Clear existing metadata');
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
      console.log(content.user_expressions[key]);

      const expressionMetadata: IUserExpressionMetadata = {
        expression: expr,
        result: result
      };
      expressions.push(expressionMetadata);

      console.log(`Saving ${expr} to cell attachments`, expressionMetadata);
    }

    // Update cell metadata
    cell.model.metadata.set(metadataSection, expressions);
  };

  await future.done;
}
