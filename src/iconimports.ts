import { LabIcon } from '@jupyterlab/ui-components';

import julynterSvgstr from '../style/img/julynter.svg';
import julynterNewSvgstr from '../style/img/julynter_new.svg';
import configSvgstr from '../style/img/config.svg';
import requirermentsSvgstr from '../style/img/rename.svg';
import listSvgstr from '../style/img/list.svg';
import typeSvgstr from '../style/img/type.svg';
import cellSvgstr from '../style/img/cell.svg';
import pathSvgstr from '../style/img/absolute_path.svg';
import importSvgstr from '../style/img/import.svg';
import confuseSvgstr from '../style/img/confuse_notebook.svg';
import hiddenstateSvgstr from '../style/img/hidden_state.svg';
import titleSvgstr from '../style/img/title.svg';
import minusSvgstr from '../style/img/minus.svg';
import plusSvgstr from '../style/img/plus.svg';
import feedbackSvgstr from '../style/img/feedback.svg';
import kernelonSvgstr from '../style/img/kernelon.svg';
import kerneloffSvgstr from '../style/img/kerneloff.svg';
import disconnectedSvgstr from '../style/img/disconnected.svg';
import neverconnectedSvgstr from '../style/img/neverconnected.svg';
import toggledownSvgstr from '../style/img/toggle_down.svg';
import togglerightSvgstr from '../style/img/toggle_right.svg';
import eyeSvgstr from '../style/img/eye.svg';
import filterSvgstr from '../style/img/filter.svg';

export const julynterIcon = new LabIcon({
  name: 'julynter:icon',
  svgstr: julynterSvgstr
});
export const julynterNewIcon = new LabIcon({
  name: 'julynter:newicon',
  svgstr: julynterNewSvgstr
});
export const configIcon = new LabIcon({
  name: 'julynter:config',
  svgstr: configSvgstr
});
export const requirermentsIcon = new LabIcon({
  name: 'julynter:requirements',
  svgstr: requirermentsSvgstr
});
export const listIcon = new LabIcon({
  name: 'julynter:list',
  svgstr: listSvgstr
});
export const typeIcon = new LabIcon({
  name: 'julynter:type',
  svgstr: typeSvgstr
});
export const cellIcon = new LabIcon({
  name: 'julynter:cell',
  svgstr: cellSvgstr
});
export const pathIcon = new LabIcon({
  name: 'julynter:path',
  svgstr: pathSvgstr
});
export const importIcon = new LabIcon({
  name: 'julynter:import',
  svgstr: importSvgstr
});
export const confuseIcon = new LabIcon({
  name: 'julynter:confuse',
  svgstr: confuseSvgstr
});
export const hiddenStateIcon = new LabIcon({
  name: 'julynter:hiddenstate',
  svgstr: hiddenstateSvgstr
});
export const titleIcon = new LabIcon({
  name: 'julynter:title',
  svgstr: titleSvgstr
});
export const minusIcon = new LabIcon({
  name: 'julynter:minus',
  svgstr: minusSvgstr
});
export const plusIcon = new LabIcon({
  name: 'julynter:plus',
  svgstr: plusSvgstr
});
export const feedbackIcon = new LabIcon({
  name: 'julynter:feedback',
  svgstr: feedbackSvgstr
});
export const kernelonIcon = new LabIcon({
  name: 'julynter:kernelon',
  svgstr: kernelonSvgstr
});
export const kerneloffIcon = new LabIcon({
  name: 'julynter:kerneloff',
  svgstr: kerneloffSvgstr
});
export const disconnectedIcon = new LabIcon({
  name: 'julynter:disconnected',
  svgstr: disconnectedSvgstr
});
export const neverconnectedIcon = new LabIcon({
  name: 'julynter:neverconnected',
  svgstr: neverconnectedSvgstr
});
export const toggleDownIcon = new LabIcon({
  name: 'julynter:toggledown',
  svgstr: toggledownSvgstr
});
export const toggleRightIcon = new LabIcon({
  name: 'julynter:toggleright',
  svgstr: togglerightSvgstr
});
export const eyeIcon = new LabIcon({ name: 'julynter:eye', svgstr: eyeSvgstr });
export const filterIcon = new LabIcon({
  name: 'julynter:filter',
  svgstr: filterSvgstr
});

export const iconMap = {
  absolutepath: pathIcon,
  import: importIcon,
  confusenotebook: confuseIcon,
  hiddenstate: hiddenStateIcon,
  invalidtitle: titleIcon
};
