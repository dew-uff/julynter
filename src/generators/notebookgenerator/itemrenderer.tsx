import { NotebookGeneratorOptionsManager } from './optionsmanager';

import * as React from 'react';
import { IReport } from '../../julynter';

export function notebookItemRenderer(
{ options, item }: { options: NotebookGeneratorOptionsManager; item: IReport; }) {
  return (
    <div className="julynter-report-div">
      <div className="julynter-report-prompt">{item.text}</div>
    </div>
  );
}