import { MarkdownCell } from '@jupyterlab/cells';
import { Widget } from '@lumino/widgets';
import { IRenderMime, RenderedCommon, IRenderMimeRegistry } from "@jupyterlab/rendermime";
import { PromiseDelegate } from '@lumino/coreutils';
import { IUserExpressionMetadata, metadataSection } from './metadata';
import { IExpressionResult, isOutput } from './user_expressions';
import { ISanitizer } from "@jupyterlab/apputils";

interface IExpressionNode {
  expression: string;
  element: Element;
}

// Base CSS class for jupyterlab-imarkdown outputs
export const RENDERED_CLASS = 'im-rendered';
// CSS class for execution-result outputs
export const RESULT_CLASS = 'im-result';
// CSS class for missing outputs
export const ERROR_CLASS = 'im-error';
// CSS class for expression nodes
export const EXPR_CLASS = 'eval-expr';

interface IRenderedTextOptions {
  /**
   * The host node for the text content.
   */
  host: HTMLElement;
  /**
   * The html sanitizer for untrusted source.
   */
  sanitizer: ISanitizer;
  /**
   * The source text to render.
   */
  source: string;

  /**
   * Remove quotes from rendered text.
   */
  strip_quotes: boolean;
}

/**
 * Render text into a host node.
 *
 * @param options - The options for rendering.
 *
 * @returns A promise which resolves when rendering is complete.
 */
export function renderText(options: IRenderedTextOptions): Promise<void> {
  // Unpack the options.
  const { host, sanitizer, source } = options;

  // Create the raw text content.
  let content: string;
  content = sanitizer.sanitize(source, {
    allowedTags: []
  });
  // Remove quotes if required
  if (options.strip_quotes) {
    content = content.replace(/^(["'])(.*)\1$/, '$2');
  }
  // Set the sanitized content for the host node.
  const a = document.createElement('a');
  a.innerHTML = content;

  host.appendChild(a);

  // Return the rendered promise.
  return Promise.resolve(undefined);
}


class PlaceholderRenderer extends RenderedCommon {
  /**
   * Construct a new placeholder renderer widget.
   *
   * @param options - The options for initializing the widget.
   */
  constructor(options: IRenderMime.IRendererOptions) {
    super(options);
    this.addClass('im-PlaceholderRenderer');
  }

  /**
   * Render a mime model.
   *
   * @param model - The mime model to render.
   *
   * @returns A promise which resolves when rendering is complete.
   */
  render(model: IRenderMime.IMimeModel): Promise<void> {
    const node = document.createElement('span');
    this.node.appendChild(node);
    node.classList.add(RENDERED_CLASS);
    node.classList.add(ERROR_CLASS);
    return Promise.resolve();
  }
}

/**
 * A widget for displaying plain text.
 */
export class RenderedText extends RenderedCommon {
  /**
   * Construct a new rendered text widget.
   *
   * @param options - The options for initializing the widget.
   */
  constructor(options: IRenderMime.IRendererOptions) {
    super(options);
    this.addClass('im-RenderedText');
  }

  /**
   * Render a mime model.
   *
   * @param model - The mime model to render.
   *
   * @returns A promise which resolves when rendering is complete.
   */
  render(model: IRenderMime.IMimeModel): Promise<void> {
    return renderText({
      host: this.node,
      sanitizer: this.sanitizer,
      source: String(model.data[this.mimeType]),
      strip_quotes: true
    });
  }
}

/**
 * A mime renderer factory for plain and jupyter console text data.
 */
export const textRendererFactory: IRenderMime.IRendererFactory = {
  safe: true,
  mimeTypes: ['text/plain'],
  defaultRank: 100,
  createRenderer: options => new RenderedText(options)
};

export class XMarkdownCell extends MarkdownCell {
  constructor(options: MarkdownCell.IOptions) {
    super(options);

    this.__rendermime = options.rendermime.clone();
    this.__rendermime.addFactory(textRendererFactory);
  }

  private __rendermime: IRenderMimeRegistry;
  private __expressions: IExpressionNode[] = [];
  private __lastContent = '';
  private __doneRendering = new PromiseDelegate<void>();

  /**
   * Render the given IExpressionResult to a DOM Element
   */
  public renderExpressionResultModel(
    payload: IExpressionResult,
    // Element: placeholder,
  ): Promise<Element> {
    let options: any;

    if (isOutput(payload)) {
      // Output results are simple to reinterpret
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
    console.log("renderermime", this.__rendermime);

    // Invoke MIME renderer
    const model = this.__rendermime.createModel(options);

    // Select preferred mimetype for bundle
    // FIXME: choose appropriate value for `safe`
    const mimeType = this.__rendermime.preferredMimeType(model.data, 'any');
    if (mimeType === undefined) {
      console.error("Couldn't find mimetype for ", model);

      // Return error result
      const node = document.createElement('span');
      node.classList.add(RENDERED_CLASS);
      node.classList.add(ERROR_CLASS);
      return Promise.resolve(node);
    }

    // Create renderer
    const renderer = this.__rendermime.createRenderer(mimeType);
    console.log("renderer", renderer);
    renderer.addClass(RENDERED_CLASS);
    renderer.addClass(RESULT_CLASS);
    // Render model
    return renderer.renderModel(model).then(() => {
      Widget.attach(renderer, this.node);
      return renderer.node;
    });
  }

  /**
   * Get an array of names to kernel expressions.
   */
  get expressions(): string[] {
    return this.__expressions.map(node => node.expression);
  }

  /**
   * Whether the Markdown renderer has finished rendering.
   */
  get doneRendering(): Promise<void> {
    return this.__doneRendering.promise;
  }

  /**
   * Update rendered expressions from current attachment MIME-bundles
   */
  public renderExpressionsFromMetadata(): void {
    console.debug('Rendering expressions', this.expressions);
    const expressionsMetadata = this.model.metadata.get(metadataSection) as
      | IUserExpressionMetadata[]
      | undefined;

    if (expressionsMetadata === undefined) {
      console.debug(
        'Aborting rendering of expressions: no metadata',
        this.expressions
      );
      return;
    }

    // Check we have enough keys
    if (expressionsMetadata.length !== this.__expressions.length) {
      console.error(
        'Aborting rendering of expressions: expressions mismatch',
        this.expressions,
        expressionsMetadata
      );
      return;
    }
    // Loop over expressions and render them from the cell attachments
    this.__expressions.forEach((node, index) => {
      const metadata = expressionsMetadata[index];
      // Can't render the remaining keys. Should we have aborted earlier?
      if (metadata.expression !== node.expression) {
        console.error(
          `Metadata expression does not match Markdown expression at index ${index}`
        );
        return;
      }
      if (metadata.result === undefined) {
        console.error(`Metadata has no result at index ${index}`);
        return;
      }
      // Create element and replace it in the parent's DOM tree
      console.debug(`Rendering ${metadata.expression} into ${node.element}`);

      // Update the placeholder once rendered
      this.renderExpressionResultModel(metadata.result).then(element => {
        node.element.parentNode?.replaceChild(element, node.element);
        node.element = element;
      });
    });
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
      this.__lastContent !== undefined && // Not sure why this happens, but run with it.
      this.__lastContent !== currentContent
    ) {
      this.__doneRendering = new PromiseDelegate<void>();
      // Wait for rendering to complete
      this._waitForRender(widget, 2).then(() => {
        // Identify markup expressions by placeholders
        this._identifyExpressions(widget);
        // Replace placeholders with content from attachments
        this.renderExpressionsFromMetadata();
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

    // Store expressions & their current placeholders
    this.__expressions = [...exprInputNodes].map(
      (elem: Element, index: number) => ({
        expression: (elem as HTMLInputElement).value,
        element: elem
      })
    );
    console.debug('Found expressions', this.__expressions);
  }
}
