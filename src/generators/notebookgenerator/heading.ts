import { IReport } from '../../julynter';

/**
 * A heading for a notebook cell.
 */
export interface INotebookHeading extends IReport {
  type?: 'header' | 'markdown' | 'code' | 'title';
}