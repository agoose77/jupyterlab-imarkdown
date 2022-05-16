import { PartialJSONObject } from '@lumino/coreutils';
import { IExpressionResult } from './user_expressions';

export const metadataSection = 'user_expressions';

export interface IUserExpressionMetadata extends PartialJSONObject {
  expression: string;
  result: IExpressionResult;
}

export interface IUserExpressionsMetadata extends PartialJSONObject {
  [metadataSection]: IUserExpressionMetadata[];
}
