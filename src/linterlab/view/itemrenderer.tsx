import * as React from 'react';

import { IReport } from '../../linter/interfaces';

export function notebookItemRenderer(item: IReport) {
  if (!item.visible || item.filtered_out) {
    return null;
  }
  let twistButton = null;
  let fontSize = "julynter-normal-size";
  let report_div_class = item.has_parent ? "julynter-report-div julynter-has-parent" : "julynter-report-div";

  if (item.collapsed) {
    fontSize = "julynter-title-size"
    twistButton = (
      <div className="julynter-collapse-button">
        <div className="julynter-twist-placeholder">placeholder</div>
        <div className="julynter-rightarrow-img julynter-arrow-img" />
      </div>
    )
  } else if (item.collapsed === false) {
    fontSize = "julynter-title-size"
    twistButton = (
      <div className="julynter-collapse-button">
        <div className="julynter-twist-placeholder">placeholder</div>
        <div className="julynter-downarrow-img julynter-arrow-img" />
      </div>
    )
  }
  let report_prompt_class = "julynter-report-prompt " + fontSize;
  let jsx = (
    <div className={report_div_class}>
      <div className={report_prompt_class}>{item.text}</div>
    </div>
  );
  jsx = (
    <div className="julynter-entry-holder">
      {twistButton}
      {jsx}
    </div>
  )

  return jsx;
}