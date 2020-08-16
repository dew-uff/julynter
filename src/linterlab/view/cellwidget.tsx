import { ReactWidget } from "@jupyterlab/apputils";
import React from "react";
import { julynterNewIcon, iconMap } from "../../iconimports";
import { Cell } from "@jupyterlab/cells";
import { LintAction } from "./lintaction";
import { CommandRegistry } from "@lumino/commands";
import { ContextMenu } from "@lumino/widgets";
import { ERROR_TYPES_MAP } from "../../linter/reports";
import { NotebookHandler } from "../notebookhandler";


export class CellWidget extends ReactWidget {
  cell: Cell;
  notebook: NotebookHandler;
  lints: LintAction[];

  constructor(notebook: NotebookHandler, cell: Cell) {
    super();
    this.notebook = notebook;
    this.cell = cell;
    this.lints = [];
    this.addClass("julynter-cell-mod")
  }

  add(action: LintAction) {
    this.lints.push(action.clone("cell"));
    this.update();
  }

  click(event: React.MouseEvent<HTMLDivElement>) {
    const commands = new CommandRegistry();
    const contextMenu = new ContextMenu({ commands: commands });
    for (let i = 0; i < this.lints.length; i++) {
      let lint = this.lints[i];
      const icon = iconMap[lint.item.reportType];
      const rtype = ERROR_TYPES_MAP[lint.item.reportType];
      commands.addCommand('info' + i, {
        label: rtype.label + ' - ' + lint.item.text,
        icon: icon.bindprops({
          stylesheet: 'menuItem'
        }),
        caption: 'Why is this lint showing?',
        className: 'julynter-context-info',
        execute: lint.why.bind(lint),
      });
      contextMenu.addItem({
        command: 'info' + i,
        selector: '*',
      });
      contextMenu.addItem({
        type: 'separator',
        selector: '*',
      });
      lint.populateMenu(commands, contextMenu, i + "");
      if (i != this.lints.length - 1) {
        contextMenu.addItem({
          type: 'separator',
          selector: '*',
        });
        contextMenu.addItem({
          type: 'separator',
          selector: '*',
        });
      }
    }
    contextMenu.open(event as any);
    event.preventDefault();
    event.stopPropagation();
  }

  protected render(): JSX.Element {
    if (this.notebook.options.checkView() && this.lints.length > 0) {
      return <div onClick={this.click.bind(this)}> <julynterNewIcon.react tag="span"/> </div>;
    } else {
      return <div></div>;
    }
  }

  dispose() {
    super.dispose();
  }
    
}
