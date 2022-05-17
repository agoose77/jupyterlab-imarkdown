import { SingletonLayout, Widget } from '@lumino/widgets';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { IExpressionResult, isOutput } from './user_expressions';

export interface IRenderedExpressionOptions {
  expression: string;
  trusted: boolean;
  rendermime: IRenderMimeRegistry;
  safe?: 'ensure' | 'prefer' | 'any';
}

export class RenderedExpressionError extends Widget {
  constructor() {
    super();
    this.addClass('im-RenderedExpressionError');
  }
}

export class RenderedExpression extends Widget {
  readonly expression: string;
  readonly trusted: boolean;
  readonly rendermime: IRenderMimeRegistry;
  readonly safe?: 'ensure' | 'prefer' | 'any';

  constructor(options: IRenderedExpressionOptions) {
    super();

    this.trusted = options.trusted;
    this.expression = options.expression;
    this.rendermime = options.rendermime;
    this.safe = options.safe;

    this.addClass('im-RenderedExpression');

    // We can only hold one renderer at a time
    const layout = (this.layout = new SingletonLayout());
    layout.widget = new RenderedExpressionError();
  }

  renderExpression(payload: IExpressionResult): Promise<void> {
    const layout = this.layout as SingletonLayout;

    let options: any;
    if (isOutput(payload)) {
      // Output results are simple to reinterpret
      options = {
        trusted: this.trusted,
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

    // Invoke MIME renderer
    const model = this.rendermime.createModel(options);

    // Select preferred mimetype for bundle
    const mimeType = this.rendermime.preferredMimeType(model.data, this.safe);
    if (mimeType === undefined) {
      console.error("Couldn't find mimetype for ", model);

      // Create error
      layout.widget = new RenderedExpressionError();
      return Promise.resolve();
    }

    // Create renderer
    const renderer = this.rendermime.createRenderer(mimeType);
    layout.widget = renderer;
    console.assert(renderer.isAttached, 'renderer was not attached!', renderer);
    // Render model
    return renderer.renderModel(model);
  }
}
