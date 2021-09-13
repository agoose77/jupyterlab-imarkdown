import { MarkdownCell } from '@jupyterlab/cells';
import { Widget } from '@lumino/widgets';
import { JUPYTER_IMARKDOWN_EXPR_CLASS } from './tokenize';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

export const JUPYTER_IMARKDOWN_METADATA_NAME = 'jupyterlab-imarkdown';

export class IMarkdownCell extends MarkdownCell {
  private _renderMime: IRenderMimeRegistry;

  constructor(options: MarkdownCell.IOptions) {
    super(options);
    this._renderMime = options.rendermime;
  }

  private _replaceExpressions(widget: Widget): void {
    // Load active attachments
    const metadata = {
      ...(this.model.metadata.get(JUPYTER_IMARKDOWN_METADATA_NAME) as any)
    };
    if (metadata.attachments === undefined) {
      console.log('No metadat present!');
      return;
    }
    const exprNodes = widget.node.querySelectorAll(
      `.${JUPYTER_IMARKDOWN_EXPR_CLASS}`
    );
    // Not enough attachments
    if (exprNodes.length !== metadata.attachments.length) {
      console.log(
        `Difference between identified and available expressions`,
        exprNodes,
        metadata.attachments
      );
      return;
    }

    // Loop over placeholders + eval results to template
    for (let i = 0; i < exprNodes.length; i++) {
      // placeholder attachment for this index
      const key = metadata.attachments[i];
      const attachment = this.model.attachments.get(key);
      if (attachment === undefined) {
        console.log(`Couldn't find attachment ${key}`);
        continue;
      }

      // Select preferred mimetype for bundle
      const mimeType = this._renderMime.preferredMimeType(
        attachment.data,
        'any'
      );
      if (mimeType === undefined) {
        console.log(`Couldn't find mimetype for ${key}`);
        continue;
      }

      // Create renderer
      const renderer = this._renderMime.createRenderer(mimeType);
      const model = this._renderMime.createModel({ data: attachment.data });

      // Replace existing node
      const placeholder = exprNodes[i];
      placeholder.parentNode?.replaceChild(renderer.node, placeholder);

      // FIXME: [HACK] Force inline
      renderer.renderModel(model).then(() => {
        renderer.node.style.display = 'inline';
        renderer.node.style.paddingRight = '0';
      });
    }
  }

  protected renderInput(widget: Widget) {
    super.renderInput(widget);
    this._replaceExpressions(widget);
  }
}
