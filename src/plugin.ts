import { expressionPlugin } from './tokenize';
import { simpleMarkdownItPlugin } from '@agoose77/jupyterlab-markup';

const PACKAGE_NS = '@agoose77/jupyterlab-imarkdown';
/**
 * Captures expressions as data-attributes
 */
export const plugin = simpleMarkdownItPlugin(PACKAGE_NS, {
  id: 'markdown-it-expression',
  title: 'Create spans with stored expressions from Markdown',
  description: 'Embed Markdown text in a data attribute in rendered spans',
  documentationUrls: {
    Plugin: '...'
  },
  plugin: async () => {
    return [expressionPlugin];
  }
});
