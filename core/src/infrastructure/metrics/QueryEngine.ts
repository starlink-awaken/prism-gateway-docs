/**
 * PRISM-Gateway Metrics Query Engine
 *
 * @module infrastructure/metrics/QueryEngine
 */

import { MetricsStorage } from './MetricsStorage.js';
import { MetricsAggregator } from './MetricsAggregator.js';
import type {
  MetricDataPoint,
  AggregatedMetricPoint,
  MetricsQueryFilter,
  MetricsQueryResult,
  TimeSeriesGranularity,
  AggregationFunction
} from './types.js';

/**
 * Query engine for flexible metric queries
 */
export class QueryEngine {
  private storage: MetricsStorage;
  private aggregator: MetricsAggregator;

  constructor(storage: MetricsStorage, aggregator: MetricsAggregator) {
    this.storage = storage;
    this.aggregator = aggregator;
  }

  /**
   * Query metrics with filters
   */
  async query(filter: MetricsQueryFilter): Promise<MetricsQueryResult[]> {
    const startTime = Date.now();

    // Default values
    const endTime = filter.endTime || Date.now();
    const queryStartTime = filter.startTime || endTime - 60 * 60 * 1000; // Default: 1 hour
    const granularity = filter.granularity || this.selectGranularity(queryStartTime, endTime);
    const metricNames = filter.names || await this.storage.listMetrics(granularity);

    const results: MetricsQueryResult[] = [];

    for (const name of metricNames) {
      const dataPoints = await this.storage.read(granularity, name, queryStartTime, endTime);

      // Filter by labels if specified
      let filteredPoints = dataPoints;
      if (filter.labels && Object.keys(filter.labels).length > 0) {
        filteredPoints = this.filterByLabels(dataPoints, filter.labels);
      }

      // Apply aggregation if specified and data is raw
      if (filter.aggregation && granularity === 'raw') {
        filteredPoints = await this.applyAggregation(
          filteredPoints as MetricDataPoint[],
          filter.aggregation
        );
      }

      // Apply limit if specified
      if (filter.limit && filteredPoints.length > filter.limit) {
        filteredPoints = filteredPoints.slice(-filter.limit);
      }

      const queryDuration = Date.now() - startTime;

      results.push({
        name,
        dataPoints: filteredPoints as MetricDataPoint[],
        metadata: {
          totalPoints: filteredPoints.length,
          startTime: queryStartTime,
          endTime,
          granularity,
          queryDuration
        }
      });
    }

    return results;
  }

  /**
   * Query with time range
   */
  async timeRangeQuery(
    metricNames: string[],
    startTime: number,
    endTime: number,
    granularity?: TimeSeriesGranularity
  ): Promise<Map<string, MetricDataPoint[]>> {
    const selectedGranularity = granularity || this.selectGranularity(startTime, endTime);
    const results = new Map<string, MetricDataPoint[]>();

    for (const name of metricNames) {
      const dataPoints = await this.storage.read(selectedGranularity, name, startTime, endTime);
      results.set(name, dataPoints as MetricDataPoint[]);
    }

    return results;
  }

  /**
   * Apply aggregation to raw data points
   */
  async applyAggregation(
    dataPoints: MetricDataPoint[],
    aggregation: AggregationFunction
  ): Promise<MetricDataPoint[]> {
    // Aggregate by 1 minute by default
    const aggregated = this.aggregator.aggregate1m(dataPoints);

    // Filter to requested aggregation function
    const filtered = aggregated.filter(p => p.aggregation === aggregation);

    // Convert back to MetricDataPoint format
    return filtered.map(p => ({
      name: p.name,
      value: p.value,
      timestamp: p.timestamp,
      labels: p.labels,
      metadata: { aggregation: p.aggregation, count: p.count }
    }));
  }

  /**
   * Downsample query results
   */
  async downsample(
    dataPoints: MetricDataPoint[],
    targetPoints: number,
    aggregation: AggregationFunction = 'avg' as AggregationFunction
  ): Promise<MetricDataPoint[]> {
    if (dataPoints.length <= targetPoints) {
      return dataPoints;
    }

    // Convert to aggregated points format
    const aggregatedPoints: AggregatedMetricPoint[] = dataPoints.map(p => ({
      name: p.name,
      timestamp: p.timestamp,
      aggregation,
      value: p.value,
      count: 1,
      labels: p.labels
    }));

    // Downsample
    const downsampled = this.aggregator.downsample(aggregatedPoints, targetPoints, aggregation);

    // Convert back to MetricDataPoint format
    return downsampled.map(p => ({
      name: p.name,
      value: p.value,
      timestamp: p.timestamp,
      labels: p.labels,
      metadata: { aggregation: p.aggregation, count: p.count }
    }));
  }

  /**
   * Get latest value for metrics
   */
  async getLatest(metricNames: string[]): Promise<Map<string, MetricDataPoint | null>> {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    const results = new Map<string, MetricDataPoint | null>();

    for (const name of metricNames) {
      const dataPoints = await this.storage.read('raw', name, fiveMinutesAgo, now);

      if (dataPoints.length > 0) {
        // Get most recent point
        const sorted = (dataPoints as MetricDataPoint[]).sort((a, b) => b.timestamp - a.timestamp);
        results.set(name, sorted[0]);
      } else {
        results.set(name, null);
      }
    }

    return results;
  }

  /**
   * Calculate statistics for a metric over a time range
   */
  async calculateStats(
    metricName: string,
    startTime: number,
    endTime: number
  ): Promise<{
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null> {
    const granularity = this.selectGranularity(startTime, endTime);
    const dataPoints = await this.storage.read(granularity, metricName, startTime, endTime);

    if (dataPoints.length === 0) {
      return null;
    }

    const values = (dataPoints as MetricDataPoint[]).map(p => p.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const count = values.length;

    return {
      count,
      sum,
      avg: sum / count,
      min: values[0],
      max: values[values.length - 1],
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99)
    };
  }

  /**
   * Select appropriate granularity based on time range
   */
  private selectGranularity(startTime: number, endTime: number): TimeSeriesGranularity {
    const rangeMs = endTime - startTime;
    const hours = rangeMs / (60 * 60 * 1000);

    if (hours <= 1) {
      return 'raw'; // Last hour: use raw data
    } else if (hours <= 6) {
      return '1m'; // 1-6 hours: use 1-minute aggregation
    } else if (hours <= 24) {
      return '5m'; // 6-24 hours: use 5-minute aggregation
    } else {
      return '1h'; // > 24 hours: use 1-hour aggregation
    }
  }

  /**
   * Filter data points by labels
   */
  private filterByLabels(
    dataPoints: (MetricDataPoint | AggregatedMetricPoint)[],
    labels: Record<string, string>
  ): (MetricDataPoint | AggregatedMetricPoint)[] {
    return dataPoints.filter(point => {
      if (!point.labels) {
        return false;
      }

      for (const [key, value] of Object.entries(labels)) {
        if (point.labels[key] !== value) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Calculate percentile from sorted values
   */
  private percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) {
      return 0;
    }

    const index = Math.floor(sortedValues.length * percentile);
    return sortedValues[Math.min(index, sortedValues.length - 1)];
  }
}
