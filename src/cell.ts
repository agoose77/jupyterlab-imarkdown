import { MarkdownCell } from '@jupyterlab/cells';
import { Widget } from '@lumino/widgets';
import { EXPR_CLASS } from './tokenize';
import { IRenderMime, IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { PromiseDelegate } from '@lumino/coreutils';
import {
  ERROR_MIMETYPE,
  IExpressionResult,
  isOutput,
  OUTPUT_MIMETYPE
} from './attachment';

// Name prefix for cell attachments
export const ATTACHMENT_PREFIX = 'jupyterlab-imarkdown';
// Base CSS class for jupyterlab-imarkdown outputs
export const RENDERED_CLASS = 'im-rendered';
// CSS class for execution-result outputs
export const RESULT_CLASS = 'im-result';
// CSS class for missing outputs
export const ERROR_CLASS = 'im-error';

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

  /**
   * Create an IRenderMime.IMimeModel for a given IExpressionResult
   */
  protected _createExpressionResultModel(
    payload: IExpressionResult
  ): IRenderMime.IMimeModel {
    let options: any;

    if (isOutput(payload)) {
      // Output results are simple to re-intepret
      options = {
        trusted: this.model.trusted,
        data: payload.data,
        metadata: payload.metadata
      };
    } else {
      // Errors need to be formatted as stderr objects
      options = {
        data: {
          'application/vnd.jupyter.stderr':
            payload.traceback.join('\n') ||
            `${payload.ename}: ${payload.evalue}`
        }
      };
    }
    return this.__rendermime.createModel(options);
  }

  /**
   * Render the IExpressionResult produced by the kernel
   */
  protected _renderExpressionResult(payload: IExpressionResult): Element {
    const model = this._createExpressionResultModel(payload);

    // Select preferred mimetype for bundle
    // FIXME: choose appropriate value for `safe`
    const mimeType = this.__rendermime.preferredMimeType(model.data, 'any');
    if (mimeType === undefined) {
      console.error("Couldn't find mimetype");
      return this._renderError();
    }

    // Create renderer
    const renderer = this.__rendermime.createRenderer(mimeType);
    renderer.addClass(RENDERED_CLASS);
    renderer.addClass(RESULT_CLASS);

    // Render model
    renderer.renderModel(model);

    return renderer.node;
  }

  /**
   * Render a generic error in-line
   */
  protected _renderError(): Element {
    const node = document.createElement('span');
    node.classList.add(RENDERED_CLASS);
    node.classList.add(ERROR_CLASS);
    return node;
  }

  /**
   * Render the given expression from an existing cell attachment MIME bundle.
   * Render an in-line error if no data are available.
   */
  protected _renderExpression(name: string): Element {
    const attachment = this.model.attachments.get(name);
    // We need an attachment!
    if (attachment === undefined) {
      console.error(`Couldn't find attachment ${name}`);
      return this._renderError();
    }

    // Try and render the output from cell attachments
    const payload = (attachment.data[OUTPUT_MIMETYPE] ??
      attachment.data[ERROR_MIMETYPE]) as IExpressionResult;
    if (payload !== undefined) {
      return this._renderExpressionResult(payload);
    }

    // Couldn't find valid MIME bundle, so we need to handle that!
    console.error(`Couldn't find valid MIME bundle for attachment ${name}`);
    return this._renderError();
  }

  /**
   * Update rendered expressions from current attachment MIME-bundles
   */
  public renderExpressions(): void {
    console.log('Rendering expressions');
    // Loop over expressions and render them from the cell attachments
    for (const name in this.__expressions) {
      const node = this._renderExpression(name);
      this._replaceRenderedExpression(name, node);
    }
  }

  /**
   * Update an expression DOM node (result or placeholder) with a new result
   */
  protected _replaceRenderedExpression(name: string, node: Element): void {
    const placeholder = this.__placeholders[name];
    placeholder.parentNode?.replaceChild(node, placeholder);
    this.__placeholders[name] = node;
  }

  /**
   * Wait for Markdown rendering to complete.
   * Assume that rendered container will have at least one child.
   */
  protected _waitForRender(widget: Widget, timeout: number): Promise<void> {
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

  protected renderInput(widget: Widget): void {
    // FIXME: `renderInput` is called without waiting for render future to finish
    // Therefore, this is sometimes executed before the DOM is updated.
    super.renderInput(widget);

    const currentContent = this.model.value.text;
    // If the content has changed
    if (
      this.__lastContent !== undefined &&
      this.__lastContent !== currentContent
    ) {
      this.__doneRendering = new PromiseDelegate<void>();
      // Store parsed expressions
      this._waitForRender(widget, 10).then(() => {
        this._identifyExpressions(widget);
        this.renderExpressions();
        this.__doneRendering.resolve();
      });
      this.__lastContent = currentContent;
    }
  }

  /**
   * Parse the rendered markdown, and store placeholder and expression mappings
   */
  private _identifyExpressions(widget: Widget): void {
    const exprInputNodes = widget.node.querySelectorAll(`input.${EXPR_CLASS}`);

    // Store expressions & placeholders
    this.__expressions = {};
    this.__placeholders = {};
    exprInputNodes.forEach((node: Element, index: number) => {
      const name = `${ATTACHMENT_PREFIX}-${index}`;
      this.__expressions[name] = (node as HTMLInputElement).value;
      this.__placeholders[name] = node;
    });
    console.log('Found expressions', this.__expressions, this.__placeholders);
  }
}
