# jupyterlab_imarkdown

[![binder-badge][]][binder] [![pypi-badge][]][pypi]

[binder-badge]: https://mybinder.org/badge_logo.svg
[binder]: https://mybinder.org/v2/gh/agoose77/jupyterlab-imarkdown.git/master?urlpath=lab
[pypi-badge]: https://img.shields.io/pypi/v/jupyterlab-imarkdown
[pypi]: https://pypi.org/project/jupyterlab-imarkdown

> **Warning**
> This extension is effectively in maintenance mode; [`jupyterlab-myst`](https://github.com/executablebooks/jupyterlab-myst) provides this feature (and more!) under a single extension. Feel free to check it out!

A JupyterLab extension to embed rich output in Markdown cells.

This extension implements only the machinery required to embed rich outputs. Parsing Markdown into expressions is performed with a separate plugin `jupyterlab-markup-exp` that must be installed:
```markdown
The current value of x is {{ x }}
```

![preview](https://user-images.githubusercontent.com/1248413/133160417-95dfd03f-c0d5-43a3-8e1c-f3ae75949a8b.gif)

## Technical Details

`jupyterlab-imarkdown` has to do some pretty unpleasant things in order to provide interactive Markdown. 
In particular, we implement our own `NotebookPanel.ContentFactory` in order to inject our own `IMarkdownCell`. 
This custom class implements routines to detect when the Markdown cell has been rendered, keep track of special `eval-expr` DOM nodes, 
and update these DOM nodes with the result of kernel execution.


## Requirements

- JupyterLab >= 3.0
- `jupyterlab-markup-expr` for `{{ expr }}` parsing (optional)

## Install

To install the extension, execute:

```bash
pip install jupyterlab_imarkdown
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyterlab_imarkdown
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyterlab_imarkdown directory
# Install package in development mode
pip install -e .
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm run build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
`jlpm run watch`
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall jupyterlab_imarkdown
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `jupyterlab-imarkdown` within that folder.

### Packaging the extension

See [RELEASE](RELEASE.md)
