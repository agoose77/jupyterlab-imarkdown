import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { plugin } from './plugin';
import { NotebookPanel } from '@jupyterlab/notebook';
import { IEditorServices } from '@jupyterlab/codeeditor';
import { MarkdownCell } from '@jupyterlab/cells';
import { StaticNotebook } from '@jupyterlab/notebook/lib/widget';
import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { JUPYTER_IMARKDOWN_EXPR_CLASS } from './tokenize';

class IMarkdownCell extends MarkdownCell {
  private _d = 'null';
  /**
   * Construct a Markdown cell widget.
   */
  constructor(options: MarkdownCell.IOptions) {
    super(options);
    console.log(this._d);
  }

  /**
   * Handle `after-attach` messages.
   */
  protected onAfterAttach(msg: Message): void {
    console.log('Before onAfterAttach');
    super.onAfterAttach(msg);
    console.log('After onAfterAttach');
  }

  protected renderInput(widget: Widget) {
    super.renderInput(widget);
    const exprNodes = widget.node.querySelectorAll(
      `.${JUPYTER_IMARKDOWN_EXPR_CLASS}`
    );
    console.log(exprNodes);
  }
}

class IMarkdownContentFactory extends NotebookPanel.ContentFactory {
  /**
   * Create a new markdown cell widget.
   *
   * #### Notes
   * If no cell content factory is passed in with the options, the one on the
   * notebook content factory is used.
   */
  createMarkdownCell(
    options: MarkdownCell.IOptions,
    parent: StaticNotebook
  ): MarkdownCell {
    if (!options.contentFactory) {
      options.contentFactory = this;
    }
    return new IMarkdownCell(options).initializeState();
  }
}

/**
 * The notebook cell factory provider.
 */
const factory: JupyterFrontEndPlugin<NotebookPanel.IContentFactory> = {
  id: '@agoose77/jupyterlab-imarkdown:factory',
  provides: NotebookPanel.IContentFactory,
  requires: [IEditorServices],
  autoStart: true,
  activate: (app: JupyterFrontEnd, editorServices: IEditorServices) => {
    console.log('Using jupyterlab-imarkdown');
    const editorFactory = editorServices.factoryService.newInlineEditor;
    return new IMarkdownContentFactory({ editorFactory });
  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [factory, plugin];
export default plugins;
