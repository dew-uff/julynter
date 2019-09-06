import { NotebookGeneratorOptionsManager } from './optionsmanager';

import { INotebookHeading } from './heading';

import * as React from 'react';

export function notebookItemRenderer(
  options: NotebookGeneratorOptionsManager,
  item: INotebookHeading
) {
  return (
    <div className="julynter-report-div">
      <div className="julynter-report-prompt">{item.text}</div>
    </div>
  );
}