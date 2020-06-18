import * as React from 'react';

import { JulynterNotebook } from '../julynternotebook';

interface IKernelProps {
  notebook: JulynterNotebook;
}

export class KernelRenderer extends React.Component<IKernelProps> {

  constructor(props: IKernelProps) {
    super(props);
  }

  render(): JSX.Element | null {
    let message = "Kernel not found";
    let icon = "jp-julynter-kernel-off-icon julynter-icon";
    if (this.props.notebook.hasKernel) {
      message = "Kernel connected";
      icon = "jp-julynter-kernel-on-icon julynter-icon";
    }

    return (
        <div className="jp-Julynter-kernel">
            <div
                role="text"
                aria-label={message}
                title={message}
                className={icon}
            />
        </div>
    );
  
  }
}
