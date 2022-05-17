import { MarkdownCell } from '@jupyterlab/cells';
import { Widget } from '@lumino/widgets';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { PromiseDelegate } from '@lumino/coreutils';
import { IUserExpressionMetadata, metadataSection } from './metadata';
import { textRendererFactory } from './renderers';
import { RenderedExpression } from './expression';

// CSS class for expression nodes
export const EXPR_CLASS = 'eval-expr';

export class IMarkdownCell extends MarkdownCell {
  constructor(options: MarkdownCell.IOptions) {
    super(options);

    this.__rendermime = options.rendermime.clone();
    this.__rendermime.addFactory(textRendererFactory);
    this._expressions = [];

    // Dispose of existing expressions
    this._triageElement = document.createElement('div');
    this._triageElement.setAttribute('visibility', 'hidden');
    this.node.appendChild(this._triageElement);
  }

  private __rendermime: IRenderMimeRegistry;
  private __lastContent = '';
  private _triageElement: HTMLElement;
  private _expressions: RenderedExpression[] = [];
  private _doneRendering = new PromiseDelegate<void>();

  /**
   * Get an array of names to kernel expressions.
   */
  get expressions(): string[] {
    return this._expressions.map(node => node.expression);
  }

  /**
   * Whether the Markdown renderer has finished rendering.
   */
  get doneRendering(): Promise<void> {
    return this._doneRendering.promise;
  }

  /**
   * Update rendered expressions from current attachment MIME-bundles
   */
  public renderExpressionsFromMetadata(): Promise<void> {
    console.debug('Rendering expressions', this.expressions);
    const expressionsMetadata = this.model.metadata.get(metadataSection) as
      | IUserExpressionMetadata[]
      | undefined;

    if (expressionsMetadata === undefined) {
      console.debug(
        'Aborting rendering of expressions: no metadata',
        this.expressions
      );
      return Promise.reject();
    }

    // Check we have enough keys
    if (expressionsMetadata.length !== this._expressions.length) {
      console.error(
        'Aborting rendering of expressions: expressions mismatch',
        this.expressions,
        expressionsMetadata
      );
      return Promise.reject();
    }
    // Loop over expressions and render them from the cell attachments
    const promises: Promise<void>[] = [];
    this._expressions.forEach((node, index) => {
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
      console.debug(`Rendering ${metadata.expression}`);

      // Update the placeholder once rendered
      promises.push(node.renderExpression(metadata.result));
    });
    return Promise.all(promises).then();
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
    // Therefore, this is sometimes executed before the DOM is updated.
    super.renderInput(widget);

    const currentContent = this.model.value.text;
    // If the content has changed
    if (
      this.__lastContent !== undefined && // Not sure why this happens, but run with it.
      this.__lastContent !== currentContent
    ) {
      this._doneRendering = new PromiseDelegate<void>();
      // Wait for rendering to complete
      this._waitForRender(widget, 2)
        .then(() => {
          this._clearExpressions();
          // Identify markup expressions by placeholders
          this._identifyExpressions(widget);
          // Replace placeholders with content from attachments
          return this.renderExpressionsFromMetadata();
        })
        .catch(console.error)
        .then(() => {
          this._doneRendering.resolve();
        });
      this.__lastContent = currentContent;
    }
  }

  /**
   * Dispose of the rendered expressions
   */
  protected _clearExpressions(): void {
    console.debug('Clearing expressions');
    if (this._expressions !== undefined && this._triageElement !== undefined) {
      this._expressions.forEach(expr => {
        if (!document.body.contains(expr.node)) {
          this._triageElement.appendChild(expr.node);
        }
        expr.dispose();
      });
    }

    this._expressions = [];
  }

  /**
   * Parse the rendered markdown, and store placeholder and expression mappings
   */
  private _identifyExpressions(widget: Widget): void {
    const exprInputNodes = widget.node.querySelectorAll(`input.${EXPR_CLASS}`);

    // Store expressions & their current placeholders
    this._expressions = [...exprInputNodes].map((elem: Element) => {
      const element = elem as HTMLInputElement;
      // Create expression
      const expression = new RenderedExpression({
        expression: element.value,
        trusted: this.model.trusted,
        rendermime: this.__rendermime,
        safe: 'any'
      });
      // Inject widget into DOM
      Widget.attach(expression, element.parentElement || widget.node, element);
      console.assert(
        expression.isAttached,
        'expr should be attached',
        expression
      );
      element.remove();
      // Return expression node
      return expression;
    });
    console.debug('Found expressions', this._expressions);
  }
}
