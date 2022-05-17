import { IRenderMime, RenderedCommon } from '@jupyterlab/rendermime';
import { ISanitizer } from '@jupyterlab/apputils';

export interface IRenderedTextOptions {
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
  const span = document.createElement('span');
  span.innerHTML = content;
  host.appendChild(span);

  // Return the rendered promise.
  return Promise.resolve(undefined);
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
