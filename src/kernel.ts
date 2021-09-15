import { XMarkdownCell } from './cell';
import { ISessionContext } from '@jupyterlab/apputils';
import { IMarkdownCellModel } from '@jupyterlab/cells';
import { KernelMessage } from '@jupyterlab/services';
import { PartialJSONObject } from '@lumino/coreutils';
import {
  ERROR_MIMETYPE,
  IExpressionResult,
  isError,
  OUTPUT_MIMETYPE
} from './attachment';

/**
 * Load user expressions for given XMarkdown cell from kernel.
 * Store results in cell attachments.
 */
export async function loadUserExpressions(
  cell: XMarkdownCell,
  sessionContext: ISessionContext
): Promise<void> {
  const model = cell.model as IMarkdownCellModel;
  const cellId = { cellId: model.id };

  // Populate request data
  const content: KernelMessage.IExecuteRequestMsg['content'] = {
    code: '',
    user_expressions: cell.expressions
  };

  // Perform request
  console.log('Performing kernel request', cell.expressions);
  const kernel = sessionContext.session?.kernel;
  if (!kernel) {
    throw new Error('Session has no kernel.');
  }
  const future = kernel.requestExecute(content, false, {
    ...model.metadata.toJSON(),
    ...cellId
  });

  // Set response handler
  future.onReply = (msg: KernelMessage.IExecuteReplyMsg) => {
    const content = msg.content;
    if (content.status !== 'ok') {
      return;
    }

    console.log('Handling kernel response', msg);

    // Store results as attachments
    for (const key in content.user_expressions) {
      const result = content.user_expressions[key] as IExpressionResult;

      // Determine MIME type to store
      const mimeType = isError(result) ? ERROR_MIMETYPE : OUTPUT_MIMETYPE;

      // Construct payload from kernel response
      // We don't do any type validation here
      const payload: PartialJSONObject = {};
      payload[mimeType] = result;

      cell.model.attachments.set(key, payload as any);
      console.log(`Saving ${key} to cell attachments`);
    }
  };

  await future.done;
}
