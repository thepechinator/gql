/* @flow */
import { type FragmentDefinitionNode } from 'graphql';
import { ParsedQueryDocument } from 'gql-shared/GQLQueryFile';

export default class GQLFragment {
  _ast: FragmentDefinitionNode;
  _queryDocument: ParsedQueryDocument;
  _cache: Map<any, any>;

  constructor(ast: FragmentDefinitionNode, queryDocument: ParsedQueryDocument) {
    this._ast = ast;
    this._queryDocument = queryDocument;
  }

  getName() {
    return this._ast.name.value;
  }

  getNode() {
    return this._ast;
  }

  getScopes() {
    return this._queryDocument.getConfig().fragmentScopes;
  }

  getFilePath() {
    return this._queryDocument.getFilePath();
  }

  getCacheItem(key) {
    if (!this._cache) {
      return null;
    }
    return this._cache.get(key);
  }

  hasCacheItem(key) {
    if (!this._cache) {
      return false;
    }
    return this._cache.has(key);
  }

  setCacheItem(key: any, value: any) {
    // Lazily create cache
    if (!this._cache) {
      this._cache = new Map();
    }
    this._cache.set(key, value);
  }
}
