import { config } from '../config';

/**
 * Simple Graylog API client for querying logs
 */
export class GraylogApiService {
  private graylogUrl: string;
  private auth: { username: string; password: string };

  constructor() {
    this.graylogUrl = config.graylogApiUrl;
    this.auth = {
      username: config.graylogUsername,
      password: config.graylogPassword,
    };
  }

  /**
   * Make a POST request to Graylog API
   */
  private async post<T>(endpoint: string, body: any): Promise<T> {
    const url = `${this.graylogUrl}${endpoint}`;
    const authHeader = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-By': 'client',
        'Authorization': `Basic ${authHeader}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Graylog API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make a GET request to Graylog API
   */
  private async get<T>(endpoint: string): Promise<T> {
    const url = `${this.graylogUrl}${endpoint}`;
    const authHeader = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString('base64');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Requested-By': 'client',
        'Authorization': `Basic ${authHeader}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Graylog API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Execute a count query in Graylog filtered by stream IDs
   * @param query The search query string
   * @param from Start time (ISO string or epoch milliseconds)
   * @param to End time (ISO string or epoch milliseconds)
   * @param streamIds Optional array of stream IDs to filter by
   * @returns Search execution result
   */
  async executeCountQueryByStreamIds(query: string, from: string | number, to: string | number, streamIds?: string[]): Promise<any> {
    const fromStr = typeof from === 'number' ? new Date(from).toISOString() : from;
    const toStr = typeof to === 'number' ? new Date(to).toISOString() : to;

    // Build filter if streamIds are provided
    let filter: any = null;
    if (streamIds && streamIds.length > 0) {
      filter = {
        type: 'or',
        filters: streamIds.map(streamId => ({
          type: 'stream',
          id: streamId,
        })),
      };
    }

    const body = {
      queries: [
        {
          query: { type: 'elasticsearch', query_string: query },
          timerange: {
            type: 'absolute',
            from: fromStr,
            to: toStr,
          },
          filter: filter,
          filters: [],
          search_types: [
            {
              name: 'count_only',
              type: 'pivot',
              rollup: true,
              series: [
                { id: 'count()', type: 'count' }
              ],
              row_groups: [],
              column_groups: [],
              filters: [],
              sort: [],
            },
          ],
        },
      ],
      parameters: [],
    };
    

    // First, create the search
    const searchResponse = await this.post<any>('/views/search', body);
    
    // Then execute it
    const executeResponse = await this.post<any>(`/views/search/${searchResponse.id}/execute`, {});
    
    return executeResponse;
  }

  /**
   * Get search result status
   * @param executingNode The node executing the search
   * @param executingId The execution ID
   * @returns Search result status
   */
  async getSearchResult(executingNode: string, executingId: string): Promise<any> {
    return this.get<any>(`/views/searchjobs/${executingNode}/${executingId}/status`);
  }

  /**
   * Wait for search to complete and get results
   * Polls the status endpoint until the query is done
   * @param executingNode The node executing the search
   * @param executingId The execution ID
   * @param maxWaitTime Maximum time to wait in milliseconds (default: 5 minutes)
   * @param pollInterval Polling interval in milliseconds (default: 2 seconds)
   * @returns Search result when complete
   */
  async waitForSearchResult(
    executingNode: string,
    executingId: string,
    maxWaitTime: number = 5 * 60 * 1000,
    pollInterval: number = 2000
  ): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getSearchResult(executingNode, executingId);
      
      // Check if search is complete based on execution.done
      if (status.execution?.done === true) {
        // Check for errors
        if (status.execution.cancelled === true) {
          throw new Error('Search was cancelled');
        }
        
        if (status.execution.completed_exceptionally === true) {
          console.log(status);
          throw new Error('Search completed exceptionally');
        }
        
        // Results are already in the status response when done
        return status;
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`Search timed out after ${maxWaitTime}ms`);
  }

  /**
   * Execute a count query grouped by 1 column in Graylog filtered by stream IDs
   * @param query The search query string
   * @param from Start time (ISO string or epoch milliseconds)
   * @param to End time (ISO string or epoch milliseconds)
   * @param groupByColumn The column name to group by
   * @param streamIds Optional array of stream IDs to filter by
   * @returns Search execution result
   */
  async executeCountAndGroupBy1ColumnQueryByStreamIds(
    query: string,
    from: string | number,
    to: string | number,
    groupByColumn: string,
    streamIds?: string[]
  ): Promise<any> {
    const fromStr = typeof from === 'number' ? new Date(from).toISOString() : from;
    const toStr = typeof to === 'number' ? new Date(to).toISOString() : to;

    // Build filter if streamIds are provided
    let filter: any = null;
    if (streamIds && streamIds.length > 0) {
      filter = {
        type: 'or',
        filters: streamIds.map(streamId => ({
          type: 'stream',
          id: streamId,
        })),
      };
    }

    const body = {
      queries: [
        {
          query: { type: 'elasticsearch', query_string: query },
          timerange: {
            type: 'absolute',
            from: fromStr,
            to: toStr,
          },
          filter: filter,
          filters: [],
          search_types: [
            {
              name: 'grouped_count',
              type: 'pivot',
              rollup: true,
              series: [
                { id: 'count()', type: 'count' }
              ],
              row_groups: [
                {
                  type: 'values',
                  fields: [groupByColumn],
                  limit: 10000,
                }
              ],
              column_groups: [],
              filters: [],
              sort: [],
            },
          ],
        },
      ],
      parameters: [],
    };

    // First, create the search
    const searchResponse = await this.post<any>('/views/search', body);
    
    // Then execute it
    const executeResponse = await this.post<any>(`/views/search/${searchResponse.id}/execute`, {});
    
    return executeResponse;
  }

  /**
   * Generic function to execute a query and wait for results, then extract data using a callback
   * @param executeResponse The response from executing a search query
   * @param extractCallback Function to extract data from the final result
   * @returns Object containing the full result and extracted data
   */
  private async executeQueryAndWait<T>(
    executeResponse: any,
    extractCallback: (result: any) => T
  ): Promise<{ result: any; data: T }> {
    let finalResult: any;
    
    // If there's an executing node, wait for the result
    if (executeResponse.executing_node && executeResponse.id) {
      finalResult = await this.waitForSearchResult(executeResponse.executing_node, executeResponse.id);
    } else {
      // If no executing node, use the response directly
      finalResult = executeResponse;
    }
    
    // Extract data from the result using the callback
    const data = extractCallback(finalResult);
    
    return {
      result: finalResult,
      data: data,
    };
  }

  /**
   * Extract count from Graylog search result
   * @param result The search result object
   * @returns The total count or null if not found
   */
  extractCount(result: any): number | null {
    if (!result?.results) return null;
    
    const queryIds = Object.keys(result.results);
    if (queryIds.length === 0) return null;
    
    const queryResult = result.results[queryIds[0]];
    const searchTypeIds = Object.keys(queryResult.search_types);
    if (searchTypeIds.length === 0) return null;
    
    const searchType = queryResult.search_types[searchTypeIds[0]];
    return searchType.total ?? null;
  }

  /**
   * Extract grouped data from Graylog search result
   * @param result The search result object
   * @param groupByColumn The column name used for grouping
   * @returns Array of grouped data with column value and count
   */
  extractGroupedData(result: any, groupByColumn: string): any[] {
    if (!result?.results) return [];

    // Extract the dynamic query ID
    const queryId = Object.keys(result.results)[0];
    const queryResult = result.results[queryId];

    if (!queryResult?.search_types) return [];

    // Extract the dynamic search type ID
    const searchTypeId = Object.keys(queryResult.search_types)[0];
    const searchType = queryResult.search_types[searchTypeId];

    if (!searchType?.rows) return [];

    const rows = searchType.rows as any[];

    const output: any[] = [];

    for (const row of rows) {
      // Skip the global total row: it has no key (empty array) and is "non-leaf"
      if (row.source !== "leaf") continue;

      const key = row.key?.[0] ?? "(Unknown)";
      const value = row.values?.[0]?.value ?? 0;

      output.push({
        [groupByColumn]: key,
        count: value,
      });
    }

    return output;
  }

  /**
   * Execute a count query by stream IDs and wait for results
   * @param query The search query string
   * @param from Start time (ISO string or epoch milliseconds)
   * @param to End time (ISO string or epoch milliseconds)
   * @param streamIds Optional array of stream IDs to filter by
   * @returns Object containing the full result and extracted count
   */
  async executeCountQueryByStreamIdsAndWait(query: string, from: string | number, to: string | number, streamIds?: string[]): Promise<{ result: any; count: number | null }> {
    const executeResponse = await this.executeCountQueryByStreamIds(query, from, to, streamIds);
    const { result, data: count } = await this.executeQueryAndWait(executeResponse, this.extractCount.bind(this));
    
    return {
      result: result,
      count: count,
    };
  }

  /**
   * Execute a count query grouped by 1 column and wait for results
   * @param query The search query string
   * @param from Start time (ISO string or epoch milliseconds)
   * @param to End time (ISO string or epoch milliseconds)
   * @param groupByColumn The column name to group by
   * @param streamIds Optional array of stream IDs to filter by
   * @returns Object containing the full result and grouped data
   */
  async executeCountAndGroupBy1ColumnQueryByStreamIdsAndWait(
    query: string,
    from: string | number,
    to: string | number,
    groupByColumn: string,
    streamIds?: string[]
  ): Promise<{ result: any; groupedData: any[] }> {
    const executeResponse = await this.executeCountAndGroupBy1ColumnQueryByStreamIds(
      query,
      from,
      to,
      groupByColumn,
      streamIds
    );
    
    // Create a bound extractor function with the groupByColumn parameter
    const extractor = (result: any) => this.extractGroupedData(result, groupByColumn);
    const { result, data: groupedData } = await this.executeQueryAndWait(executeResponse, extractor);
    
    return {
      result: result,
      groupedData: groupedData,
    };
  }

  /**
   * Execute a count query grouped by 2 columns in Graylog filtered by stream IDs
   * @param query The search query string
   * @param from Start time (ISO string or epoch milliseconds)
   * @param to End time (ISO string or epoch milliseconds)
   * @param groupByColumn1 The first column name to group by
   * @param groupByColumn2 The second column name to group by
   * @param streamIds Optional array of stream IDs to filter by
   * @returns Search execution result
   */
  async executeCountAndGroupBy2ColumnQueryByStreamIds(
    query: string,
    from: string | number,
    to: string | number,
    groupByColumn1: string,
    groupByColumn2: string,
    streamIds?: string[]
  ): Promise<any> {
    const fromStr = typeof from === 'number' ? new Date(from).toISOString() : from;
    const toStr = typeof to === 'number' ? new Date(to).toISOString() : to;

    // Build filter if streamIds are provided
    let filter: any = null;
    if (streamIds && streamIds.length > 0) {
      filter = {
        type: 'or',
        filters: streamIds.map(streamId => ({
          type: 'stream',
          id: streamId,
        })),
      };
    }

    const body = {
      queries: [
        {
          query: { type: 'elasticsearch', query_string: query },
          timerange: {
            type: 'absolute',
            from: fromStr,
            to: toStr,
          },
          filter: filter,
          filters: [],
          search_types: [
            {
              name: 'grouped_count_2columns',
              type: 'pivot',
              rollup: true,
              series: [
                { id: 'count()', type: 'count' }
              ],
              row_groups: [
                {
                  type: 'values',
                  fields: [groupByColumn1],
                  limit: 10000,
                },
                {
                  type: 'values',
                  fields: [groupByColumn2],
                  limit: 10000,
                }
              ],
              column_groups: [],
              filters: [],
              sort: [],
            },
          ],
        },
      ],
      parameters: [],
    };

    // First, create the search
    const searchResponse = await this.post<any>('/views/search', body);
    
    // Then execute it
    const executeResponse = await this.post<any>(`/views/search/${searchResponse.id}/execute`, {});
    
    return executeResponse;
  }

  /**
   * Extract grouped data from Graylog search result for 2 columns
   * @param result The search result object
   * @param groupByColumn1 The first column name used for grouping
   * @param groupByColumn2 The second column name used for grouping
   * @returns Array of grouped data with both column values and count
   */
  extractGroupedData2Columns(result: any, groupByColumn1: string, groupByColumn2: string): any[] {
    console.log(`extractGroupedData2Columns result: ${JSON.stringify(result, null, 2)}`);
    if (!result?.results) return [];

    // Extract the dynamic query ID
    const queryId = Object.keys(result.results)[0];
    const queryResult = result.results[queryId];

    if (!queryResult?.search_types) return [];

    // Extract the dynamic search type ID
    const searchTypeId = Object.keys(queryResult.search_types)[0];
    const searchType = queryResult.search_types[searchTypeId];

    if (!searchType?.rows) return [];

    const rows = searchType.rows as any[];

    const output: any[] = [];

    for (const row of rows) {
      // Skip the global total row: it has no key (empty array) and is "non-leaf"
      if (row.source !== "leaf") continue;

      // For 2 columns, key is an array with 2 values: [column1Value, column2Value]
      const key = row.key || [];
      const column1Value = key[0] ?? "(Unknown)";
      const column2Value = key[1] ?? "(Unknown)";
      const value = row.values?.[0]?.value ?? 0;

      output.push({
        [groupByColumn1]: column1Value,
        [groupByColumn2]: column2Value,
        count: value,
      });
    }

    return output;
  }

  /**
   * Execute a count query grouped by 2 columns and wait for results
   * @param query The search query string
   * @param from Start time (ISO string or epoch milliseconds)
   * @param to End time (ISO string or epoch milliseconds)
   * @param groupByColumn1 The first column name to group by
   * @param groupByColumn2 The second column name to group by
   * @param streamIds Optional array of stream IDs to filter by
   * @returns Object containing the full result and grouped data
   */
  async executeCountAndGroupBy2ColumnQueryByStreamIdsAndWait(
    query: string,
    from: string | number,
    to: string | number,
    groupByColumn1: string,
    groupByColumn2: string,
    streamIds?: string[]
  ): Promise<{ result: any; groupedData: any[] }> {
    const executeResponse = await this.executeCountAndGroupBy2ColumnQueryByStreamIds(
      query,
      from,
      to,
      groupByColumn1,
      groupByColumn2,
      streamIds
    );
    
    // Create a bound extractor function with the groupByColumn parameters
    const extractor = (result: any) => this.extractGroupedData2Columns(result, groupByColumn1, groupByColumn2);
    const { result, data: groupedData } = await this.executeQueryAndWait(executeResponse, extractor);
    
    return {
      result: result,
      groupedData: groupedData,
    };
  }

  /**
   * Execute a count query grouped by 3 columns in Graylog filtered by stream IDs
   * @param query The search query string
   * @param from Start time (ISO string or epoch milliseconds)
   * @param to End time (ISO string or epoch milliseconds)
   * @param groupByColumn1 The first column name to group by
   * @param groupByColumn2 The second column name to group by
   * @param groupByColumn3 The third column name to group by
   * @param streamIds Optional array of stream IDs to filter by
   * @returns Search execution result
   */
  async executeCountAndGroupBy3ColumnQueryByStreamIds(
    query: string,
    from: string | number,
    to: string | number,
    groupByColumn1: string,
    groupByColumn2: string,
    groupByColumn3: string,
    streamIds?: string[]
  ): Promise<any> {
    const fromStr = typeof from === 'number' ? new Date(from).toISOString() : from;
    const toStr = typeof to === 'number' ? new Date(to).toISOString() : to;

    // Build filter if streamIds are provided
    let filter: any = null;
    if (streamIds && streamIds.length > 0) {
      filter = {
        type: 'or',
        filters: streamIds.map(streamId => ({
          type: 'stream',
          id: streamId,
        })),
      };
    }

    const body = {
      queries: [
        {
          query: { type: 'elasticsearch', query_string: query },
          timerange: {
            type: 'absolute',
            from: fromStr,
            to: toStr,
          },
          filter: filter,
          filters: [],
          search_types: [
            {
              name: 'grouped_count_3columns',
              type: 'pivot',
              rollup: true,
              series: [
                { id: 'count()', type: 'count' }
              ],
              row_groups: [
                {
                  type: 'values',
                  fields: [groupByColumn1],
                  limit: 10000,
                },
                {
                  type: 'values',
                  fields: [groupByColumn2],
                  limit: 10000,
                },
                {
                  type: 'values',
                  fields: [groupByColumn3],
                  limit: 10000,
                }
              ],
              column_groups: [],
              filters: [],
              sort: [],
            },
          ],
        },
      ],
      parameters: [],
    };

    // First, create the search
    const searchResponse = await this.post<any>('/views/search', body);
    
    // Then execute it
    const executeResponse = await this.post<any>(`/views/search/${searchResponse.id}/execute`, {});
    
    return executeResponse;
  }

  /**
   * Extract grouped data from Graylog search result for 3 columns
   * @param result The search result object
   * @param groupByColumn1 The first column name used for grouping
   * @param groupByColumn2 The second column name used for grouping
   * @param groupByColumn3 The third column name used for grouping
   * @returns Array of grouped data with all three column values and count
   */
  extractGroupedData3Columns(result: any, groupByColumn1: string, groupByColumn2: string, groupByColumn3: string): any[] {
    if (!result?.results) return [];

    // Extract the dynamic query ID
    const queryId = Object.keys(result.results)[0];
    const queryResult = result.results[queryId];

    if (!queryResult?.search_types) return [];

    // Extract the dynamic search type ID
    const searchTypeId = Object.keys(queryResult.search_types)[0];
    const searchType = queryResult.search_types[searchTypeId];

    if (!searchType?.rows) return [];

    const rows = searchType.rows as any[];

    const output: any[] = [];

    for (const row of rows) {
      // Skip the global total row: it has no key (empty array) and is "non-leaf"
      if (row.source !== "leaf") continue;

      // For 3 columns, key is an array with 3 values: [column1Value, column2Value, column3Value]
      const key = row.key || [];
      const column1Value = key[0] ?? "(Unknown)";
      const column2Value = key[1] ?? "(Unknown)";
      const column3Value = key[2] ?? "(Unknown)";
      const value = row.values?.[0]?.value ?? 0;

      output.push({
        [groupByColumn1]: column1Value,
        [groupByColumn2]: column2Value,
        [groupByColumn3]: column3Value,
        count: value,
      });
    }

    return output;
  }

  /**
   * Execute a count query grouped by 3 columns and wait for results
   * @param query The search query string
   * @param from Start time (ISO string or epoch milliseconds)
   * @param to End time (ISO string or epoch milliseconds)
   * @param groupByColumn1 The first column name to group by
   * @param groupByColumn2 The second column name to group by
   * @param groupByColumn3 The third column name to group by
   * @param streamIds Optional array of stream IDs to filter by
   * @returns Object containing the full result and grouped data
   */
  async executeCountAndGroupBy3ColumnQueryByStreamIdsAndWait(
    query: string,
    from: string | number,
    to: string | number,
    groupByColumn1: string,
    groupByColumn2: string,
    groupByColumn3: string,
    streamIds?: string[]
  ): Promise<{ result: any; groupedData: any[] }> {
    const executeResponse = await this.executeCountAndGroupBy3ColumnQueryByStreamIds(
      query,
      from,
      to,
      groupByColumn1,
      groupByColumn2,
      groupByColumn3,
      streamIds
    );
    
    // Create a bound extractor function with the groupByColumn parameters
    const extractor = (result: any) => this.extractGroupedData3Columns(result, groupByColumn1, groupByColumn2, groupByColumn3);
    const { result, data: groupedData } = await this.executeQueryAndWait(executeResponse, extractor);
    
    return {
      result: result,
      groupedData: groupedData,
    };
  }

  /**
   * Execute a count query grouped by 4 columns in Graylog filtered by stream IDs
   * @param query The search query string
   * @param from Start time (ISO string or epoch milliseconds)
   * @param to End time (ISO string or epoch milliseconds)
   * @param groupByColumn1 The first column name to group by
   * @param groupByColumn2 The second column name to group by
   * @param groupByColumn3 The third column name to group by
   * @param groupByColumn4 The fourth column name to group by
   * @param streamIds Optional array of stream IDs to filter by
   * @returns Search execution result
   */
  async executeCountAndGroupBy4ColumnQueryByStreamIds(
    query: string,
    from: string | number,
    to: string | number,
    groupByColumn1: string,
    groupByColumn2: string,
    groupByColumn3: string,
    groupByColumn4: string,
    streamIds?: string[]
  ): Promise<any> {
    const fromStr = typeof from === 'number' ? new Date(from).toISOString() : from;
    const toStr = typeof to === 'number' ? new Date(to).toISOString() : to;

    // Build filter if streamIds are provided
    let filter: any = null;
    if (streamIds && streamIds.length > 0) {
      filter = {
        type: 'or',
        filters: streamIds.map(streamId => ({
          type: 'stream',
          id: streamId,
        })),
      };
    }

    const body = {
      queries: [
        {
          query: { type: 'elasticsearch', query_string: query },
          timerange: {
            type: 'absolute',
            from: fromStr,
            to: toStr,
          },
          filter: filter,
          filters: [],
          search_types: [
            {
              name: 'grouped_count_4columns',
              type: 'pivot',
              rollup: true,
              series: [
                { id: 'count()', type: 'count' }
              ],
              row_groups: [
                {
                  type: 'values',
                  fields: [groupByColumn1],
                  limit: 10000,
                },
                {
                  type: 'values',
                  fields: [groupByColumn2],
                  limit: 10000,
                },
                {
                  type: 'values',
                  fields: [groupByColumn3],
                  limit: 10000,
                },
                {
                  type: 'values',
                  fields: [groupByColumn4],
                  limit: 10000,
                }
              ],
              column_groups: [],
              filters: [],
              sort: [],
            },
          ],
        },
      ],
      parameters: [],
    };

    // First, create the search
    const searchResponse = await this.post<any>('/views/search', body);
    
    // Then execute it
    const executeResponse = await this.post<any>(`/views/search/${searchResponse.id}/execute`, {});
    
    return executeResponse;
  }

  /**
   * Extract grouped data from Graylog search result for 4 columns
   * @param result The search result object
   * @param groupByColumn1 The first column name used for grouping
   * @param groupByColumn2 The second column name used for grouping
   * @param groupByColumn3 The third column name used for grouping
   * @param groupByColumn4 The fourth column name used for grouping
   * @returns Array of grouped data with all four column values and count
   */
  extractGroupedData4Columns(result: any, groupByColumn1: string, groupByColumn2: string, groupByColumn3: string, groupByColumn4: string): any[] {
    if (!result?.results) return [];

    // Extract the dynamic query ID
    const queryId = Object.keys(result.results)[0];
    const queryResult = result.results[queryId];

    if (!queryResult?.search_types) return [];

    // Extract the dynamic search type ID
    const searchTypeId = Object.keys(queryResult.search_types)[0];
    const searchType = queryResult.search_types[searchTypeId];

    if (!searchType?.rows) return [];

    const rows = searchType.rows as any[];

    const output: any[] = [];

    for (const row of rows) {
      // Skip the global total row: it has no key (empty array) and is "non-leaf"
      if (row.source !== "leaf") continue;

      // For 4 columns, key is an array with 4 values: [column1Value, column2Value, column3Value, column4Value]
      const key = row.key || [];
      const column1Value = key[0] ?? "(Unknown)";
      const column2Value = key[1] ?? "(Unknown)";
      const column3Value = key[2] ?? "(Unknown)";
      const column4Value = key[3] ?? "(Unknown)";
      const value = row.values?.[0]?.value ?? 0;

      output.push({
        [groupByColumn1]: column1Value,
        [groupByColumn2]: column2Value,
        [groupByColumn3]: column3Value,
        [groupByColumn4]: column4Value,
        count: value,
      });
    }

    return output;
  }

  /**
   * Execute a count query grouped by 4 columns and wait for results
   * @param query The search query string
   * @param from Start time (ISO string or epoch milliseconds)
   * @param to End time (ISO string or epoch milliseconds)
   * @param groupByColumn1 The first column name to group by
   * @param groupByColumn2 The second column name to group by
   * @param groupByColumn3 The third column name to group by
   * @param groupByColumn4 The fourth column name to group by
   * @param streamIds Optional array of stream IDs to filter by
   * @returns Object containing the full result and grouped data
   */
  async executeCountAndGroupBy4ColumnQueryByStreamIdsAndWait(
    query: string,
    from: string | number,
    to: string | number,
    groupByColumn1: string,
    groupByColumn2: string,
    groupByColumn3: string,
    groupByColumn4: string,
    streamIds?: string[]
  ): Promise<{ result: any; groupedData: any[] }> {
    const executeResponse = await this.executeCountAndGroupBy4ColumnQueryByStreamIds(
      query,
      from,
      to,
      groupByColumn1,
      groupByColumn2,
      groupByColumn3,
      groupByColumn4,
      streamIds
    );
    
    // Create a bound extractor function with the groupByColumn parameters
    const extractor = (result: any) => this.extractGroupedData4Columns(result, groupByColumn1, groupByColumn2, groupByColumn3, groupByColumn4);
    const { result, data: groupedData } = await this.executeQueryAndWait(executeResponse, extractor);
    
    return {
      result: result,
      groupedData: groupedData,
    };
  }
}

