import { XMarkdownCell } from './cell';
import { ISessionContext } from '@jupyterlab/apputils';
import { IMarkdownCellModel } from '@jupyterlab/cells';
import { KernelMessage } from '@jupyterlab/services';
import { PartialJSONObject } from '@lumino/coreutils/src/json';

export async function loadUserExpressions(
  cell: XMarkdownCell,
  sessionContext: ISessionContext
): Promise<void> {
  const model = cell.model as IMarkdownCellModel;
  const cellId = { cellId: model.id };

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

  // Set response handler
  future.onReply = (msg: KernelMessage.IExecuteReplyMsg) => {
    const content = msg.content;
    if (content.status !== 'ok') {
      return;
    }

    console.log('Handling response');

    // Store results as attachments
    for (const key in content.user_expressions) {
      const result = content.user_expressions[key] as PartialJSONObject;
      console.log({ key, result });

      const data = result['data'];
      if (data === undefined) {
        continue;
      }

      // Generate UUID per-result
      const model = result['data'] as any;
      cell.model.attachments.set(key, model);
    }
  };

  await future.done;
}
