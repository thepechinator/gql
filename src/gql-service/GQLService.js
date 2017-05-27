/* @flow */
import GQLSchemaService from 'gql-schema-service';
import GQLQueryService from 'gql-query-service';
import GQLConfig from 'gql-config';
import GQLWatcher from 'gql-watcher';
import GQLBaseService from 'gql-shared/GQLBaseService';
import GQLSchema from 'gql-shared/GQLSchema';
import log from 'gql-shared/log';

const logger = log.getLogger('gql');

import {
  type GQLHint,
  type GQLInfo,
  type GQLLocation,
  type GQLPosition,
} from 'gql-shared/types';

import { type GQLError } from 'gql-shared/GQLError';

type Options = $ReadOnly<{|
  configDir?: string,

  // watch
  watchman?: boolean,
  watch?: boolean,
|}>;

type CommandParams = $ReadOnly<{|
  sourcePath: string,
  sourceText: string,
  position: GQLPosition,
|}>;

export type { Options as GQLServiceOptions };

export default class GQLService extends GQLBaseService {
  _schemaService: GQLSchemaService;
  _queryService: ?GQLQueryService;

  _config: GQLConfig;
  _watcher: GQLWatcher;

  constructor(_options: ?Options) {
    super();
    const options = _options || {};

    this._config = new GQLConfig({
      configDir: options.configDir || process.cwd(),
    });
    this._watcher = new GQLWatcher({
      watchman: options.watchman,
      watch: options.watch,
    });

    // setup schema service
    this._schemaService = new GQLSchemaService({
      config: this._config,
      watcher: this._watcher,
    });
    this._schemaService.onChange(this._triggerChange);
    this._schemaService.onError(this._triggerError);

    // setup query service
    if (this._config.getQueryConfig()) {
      const queryService = new GQLQueryService({
        config: this._config,
        schemaService: this._schemaService,
        watcher: this._watcher,
      });
      queryService.onChange(this._triggerChange);
      queryService.onError(this._triggerError);
      this._queryService = queryService;
    }
  }

  onLog(listener) {
    return log.onLog(listener);
  }

  async _handleStart() {
    // start schema service
    await this._schemaService.start();
    if (this._queryService) {
      await this._queryService.start();
    }
  }

  async _handleStop() {
    await this._schemaService.stop();
    if (this._queryService) {
      await this._queryService.stop();
    }
  }

  getSchema(): GQLSchema {
    return this._schemaService.getSchema();
  }

  getConfig(): GQLConfig {
    return this._config;
  }

  status(): Array<GQLError> {
    if (!this._isRunning) {
      return [];
    }
    try {
      const schemaErrors = this._schemaService.getSchemaErrors();
      const queryErrors = this._queryService
        ? this._queryService.getErrors()
        : [];
      return schemaErrors.concat(queryErrors.filter(err => Boolean(err)));
    } catch (err) {
      this._triggerError(err);
      return [];
    }
  }

  autocomplete(params: CommandParams): Array<GQLHint> {
    return this._catchThrownErrors(() => {
      logger.debug('autocomplete request');
      logger.time('autocomplete response');
      if (!this._isRunning) {
        return [];
      }

      // codemirror instance
      let results = [];
      logger.time('getFileConfig');
      const fileConfig = this._config.getFileConfig(params.sourcePath);
      logger.timeEnd('getFileConfig');
      logger.debug('FileType detected:', fileConfig && fileConfig.type);

      logger.time('getHintsAtPosition');
      if (fileConfig && fileConfig.type === 'schema') {
        results = this._schemaService.getHintsAtPosition({
          fileContent: params.sourceText,
          fileOptions: fileConfig.opts,
          position: params.position,
        });
      }
      if (this._queryService && fileConfig && fileConfig.type === 'query') {
        results = this._queryService.getHintsAtPosition({
          fileContent: params.sourceText,
          filePath: params.sourcePath,
          fileOptions: fileConfig.opts,
          position: params.position,
        });
      }
      logger.timeEnd('getHintsAtPosition');
      logger.timeEnd('autocomplete response');
      return results;
    }, []);
  }

  getDef(params: CommandParams): ?GQLLocation {
    return this._catchThrownErrors(() => {
      logger.debug('getDef request');
      logger.time('getDef response');
      if (!this._isRunning) {
        return null;
      }

      let defLocation = null;
      logger.time('getFileConfig');
      const fileConfig = this._config.getFileConfig(params.sourcePath);
      logger.timeEnd('getFileConfig');
      logger.debug('FileType detected:', fileConfig && fileConfig.type);

      logger.time('getDef');
      if (fileConfig && fileConfig.type === 'schema') {
        defLocation = this._schemaService.getDefinitionAtPosition({
          fileContent: params.sourceText,
          fileOptions: fileConfig.opts,
          position: params.position,
        });
      }

      if (this._queryService && fileConfig && fileConfig.type === 'query') {
        defLocation = this._queryService.getDefinitionAtPosition({
          fileContent: params.sourceText,
          filePath: params.sourcePath,
          fileOptions: fileConfig.opts,
          position: params.position,
        });
      }
      logger.timeEnd('getDef');
      logger.timeEnd('getDef response');
      return defLocation;
    }, null);
  }

  findRefs(params: CommandParams): Array<GQLLocation> {
    return this._catchThrownErrors(() => {
      logger.debug('findRefs request');
      logger.time('findRefs response');
      if (!this._isRunning) {
        return [];
      }

      let refLocations = [];
      logger.time('getFileConfig');
      const fileConfig = this._config.getFileConfig(params.sourcePath);
      logger.timeEnd('getFileConfig');
      logger.debug('FileType detected:', fileConfig && fileConfig.type);

      logger.time('findRefs');
      if (fileConfig && fileConfig.type === 'schema') {
        refLocations = this._schemaService.findRefsOfTokenAtPosition({
          fileContent: params.sourceText,
          fileOptions: fileConfig.opts,
          position: params.position,
        });
      }
      // if (this._queryService && fileConfig && fileConfig.type === 'query') {
      //   refLocations = this._queryService.findRefsOfTokenAtPosition({
      //     fileContent: params.sourceText,
      //     filePath: params.sourcePath,
      //     fileOptions: fileConfig.opts,
      //     position: params.position,
      //   });
      // }
      logger.timeEnd('findRefs');
      logger.timeEnd('findRefs response');
      // @TODO query not implemented
      return refLocations;
    }, []);
  }

  getInfo(params: CommandParams): ?GQLInfo {
    return this._catchThrownErrors(() => {
      logger.debug('getInfo request');
      logger.time('getInfo response');
      if (!this._isRunning) {
        return null;
      }

      let info = null;
      logger.time('getFileConfig');
      const fileConfig = this._config.getFileConfig(params.sourcePath);
      logger.timeEnd('getFileConfig');
      logger.debug('FileType detected:', fileConfig && fileConfig.type);

      logger.time('getInfoAtToken');
      if (fileConfig && fileConfig.type === 'schema') {
        info = this._schemaService.getInfoOfTokenAtPosition({
          fileContent: params.sourceText,
          fileOptions: fileConfig.opts,
          position: params.position,
        });
      }

      if (this._queryService && fileConfig && fileConfig.type === 'query') {
        info = this._queryService.getInfoOfTokenAtPosition({
          fileContent: params.sourceText,
          fileOptions: fileConfig.opts,
          filePath: params.sourcePath,
          position: params.position,
        });
      }
      logger.timeEnd('getInfoAtToken');
      logger.timeEnd('getInfo response');
      return info;
    }, null);
  }
}
