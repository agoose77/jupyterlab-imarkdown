import { MarkdownCell } from '@jupyterlab/cells';
import { Widget } from '@lumino/widgets';
import { JUPYTER_IMARKDOWN_EXPR_CLASS } from './tokenize';
import { IRenderMimeRegistry, IRenderMime } from '@jupyterlab/rendermime';
import { PromiseDelegate } from '@lumino/coreutils';

export const JUPYTER_IMARKDOWN_EXPRESSION_PREFIX = 'jupyterlab-imarkdown';

interface IExpressionMap {
  [name: string]: string;
}

interface IElementMap {
  [name: string]: Element;
}

export class XMarkdownCell extends MarkdownCell {
  constructor(options: MarkdownCell.IOptions) {
    super(options);

    this.__rendermime = options.rendermime;
  }

  private __rendermime: IRenderMimeRegistry;
  private __expressions: IExpressionMap = {};
  private __placeholders: IElementMap = {};
  private __lastContent = '';
  private __doneRendering = new PromiseDelegate<void>();

  /**
   * Get a mapping of names to kernel expressions.
   */
  get expressions(): IExpressionMap {
    return this.__expressions;
  }

  /**
   * Whether the Markdown renderer has finished rendering.
   */
  get doneRendering(): Promise<void> {
    return this.__doneRendering.promise;
  }

  private _updatePlaceholder(
    name: string,
    renderer: IRenderMime.IRenderer
  ): void {
    const placeholder = this.__placeholders[name];
    placeholder.parentNode?.replaceChild(renderer.node, placeholder);
    this.__placeholders[name] = renderer.node;
  }

  private _postProcessRenderer(renderer: IRenderMime.IRenderer): void {
    // FIXME: [HACK] Force inline
    renderer.node.style.display = 'inline';
    renderer.node.style.paddingRight = '0';
  }

  public renderExpressions() {
    // Loop over expressions and render them from the cell attachments
    for (const name in this.__expressions) {
      const attachment = this.model.attachments.get(name);
      // We need an attachment!
      if (attachment === undefined) {
        console.log(`Couldn't find attachment ${name}`);
        continue;
      }

      // FIXME: choose appropriate value for `safe`
      // Select preferred mimetype for bundle
      const mimeType = this.__rendermime.preferredMimeType(
        attachment.data,
        'any'
      );
      if (mimeType === undefined) {
        console.log(`Couldn't find mimetype for ${name}`);
        continue;
      }

      // Create renderer
      const renderer = this.__rendermime.createRenderer(mimeType);
      const model = this.__rendermime.createModel({ data: attachment.data });

      renderer.renderModel(model).then(() => {
        this._postProcessRenderer(renderer);
      });

      // Replace existing node
      this._updatePlaceholder(name, renderer);
    }
  }

  /**
   * Wait for Markdown rendering to complete.
   * Assume that rendered container will have at least one child.
   */
  private _waitForRender(widget: Widget, timeout: number): Promise<void> {
    // FIXME: this is a HACK
    return new Promise(resolve => {
      function waitReady() {
        const firstChild = widget.node.querySelector('.jp-RenderedMarkdown *');
        if (firstChild !== null) {
          return resolve();
        }
        setTimeout(waitReady, timeout);
      }
      waitReady();
    });
  }

  protected renderInput(widget: Widget) {
    // FIXME: `renderInput` is called without waiting for render future to finish
    // Therefore, this is sometimes executed before the DOM is updated.
    super.renderInput(widget);

    const currentContent = this.model.value.text;
    // If the content has changed
    if (this.__lastContent !== currentContent) {
      this.__doneRendering = new PromiseDelegate<void>();
      // Store parsed expressions
      this._waitForRender(widget, 10).then(() => {
        this._identifyExpressions(widget);
        this.renderExpressions();
        console.log('Rendering done!');
        this.__doneRendering!.resolve();
      });
      this.__lastContent = currentContent;
    }
  }

  /**
   * Parse the rendered markdown, and store placeholder and expression mappings
   */
  private _identifyExpressions(widget: Widget): void {
    const exprInputNodes = widget.node.querySelectorAll(
      `input.${JUPYTER_IMARKDOWN_EXPR_CLASS}`
    );

    // Store expressions & placeholders
    this.__expressions = {};
    this.__placeholders = {};
    exprInputNodes.forEach((node: Element, index: number) => {
      let inode = node as HTMLInputElement;
      const name = `${JUPYTER_IMARKDOWN_EXPRESSION_PREFIX}-${index}`;
      this.__expressions[name] = inode.value;
      this.__placeholders[name] = inode;
    });
    console.log('Found expressions', this.__expressions, this.__placeholders);
  }
}
