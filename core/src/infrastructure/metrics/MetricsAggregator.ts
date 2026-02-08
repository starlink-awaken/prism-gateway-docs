/**
 * PRISM-Gateway Metrics Aggregator
 *
 * @module infrastructure/metrics/MetricsAggregator
 */

import type {
  MetricDataPoint,
  AggregatedMetricPoint,
  AggregationFunction,
  TimeSeriesGranularity
} from './types.js';

/**
 * Aggregates metric data points over time windows
 */
export class MetricsAggregator {
  /**
   * Aggregate data points to 1-minute buckets
   */
  aggregate1m(dataPoints: MetricDataPoint[]): AggregatedMetricPoint[] {
    return this.aggregateByWindow(dataPoints, 60 * 1000); // 1 minute in ms
  }

  /**
   * Aggregate data points to 5-minute buckets
   */
  aggregate5m(dataPoints: MetricDataPoint[]): AggregatedMetricPoint[] {
    return this.aggregateByWindow(dataPoints, 5 * 60 * 1000); // 5 minutes in ms
  }

  /**
   * Aggregate data points to 1-hour buckets
   */
  aggregate1h(dataPoints: MetricDataPoint[]): AggregatedMetricPoint[] {
    return this.aggregateByWindow(dataPoints, 60 * 60 * 1000); // 1 hour in ms
  }

  /**
   * Aggregate with custom window size
   */
  aggregateByWindow(
    dataPoints: MetricDataPoint[],
    windowSizeMs: number
  ): AggregatedMetricPoint[] {
    if (dataPoints.length === 0) {
      return [];
    }

    // Group by metric name and time bucket
    const buckets = new Map<string, Map<number, MetricDataPoint[]>>();

    for (const point of dataPoints) {
      const bucketTimestamp = Math.floor(point.timestamp / windowSizeMs) * windowSizeMs;
      const key = this.getMetricKey(point);

      if (!buckets.has(key)) {
        buckets.set(key, new Map());
      }

      const metricBuckets = buckets.get(key)!;
      if (!metricBuckets.has(bucketTimestamp)) {
        metricBuckets.set(bucketTimestamp, []);
      }

      metricBuckets.get(bucketTimestamp)!.push(point);
    }

    // Aggregate each bucket with all aggregation functions
    const aggregated: AggregatedMetricPoint[] = [];

    for (const [key, metricBuckets] of buckets.entries()) {
      const { name, labels } = this.parseMetricKey(key);

      for (const [timestamp, points] of metricBuckets.entries()) {
        // Calculate all aggregations
        const aggregations = this.calculateAggregations(points);

        for (const [func, value] of Object.entries(aggregations)) {
          aggregated.push({
            name,
            timestamp,
            aggregation: func as AggregationFunction,
            value,
            count: points.length,
            ...(labels && { labels })
          });
        }
      }
    }

    return aggregated;
  }

  /**
   * Calculate all aggregation functions for a set of points
   */
  private calculateAggregations(points: MetricDataPoint[]): Record<string, number> {
    if (points.length === 0) {
      return {};
    }

    const values = points.map(p => p.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const count = values.length;

    return {
      sum,
      avg: sum / count,
      min: values[0],
      max: values[values.length - 1],
      count,
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99)
    };
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

  /**
   * Get unique key for metric (name + labels)
   */
  private getMetricKey(point: MetricDataPoint): string {
    if (!point.labels || Object.keys(point.labels).length === 0) {
      return point.name;
    }

    const labelStr = Object.entries(point.labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    return `${point.name}{${labelStr}}`;
  }

  /**
   * Parse metric key back to name and labels
   */
  private parseMetricKey(key: string): { name: string; labels?: Record<string, string> } {
    const match = key.match(/^(.+?)\{(.+)\}$/);

    if (!match) {
      return { name: key };
    }

    const name = match[1];
    const labelStr = match[2];
    const labels: Record<string, string> = {};

    for (const pair of labelStr.split(',')) {
      const [k, v] = pair.split('=');
      labels[k] = v;
    }

    return { name, labels };
  }

  /**
   * Downsample aggregated points to reduce data volume
   */
  downsample(
    points: AggregatedMetricPoint[],
    targetPoints: number,
    aggregation: AggregationFunction = 'avg' as AggregationFunction
  ): AggregatedMetricPoint[] {
    if (points.length <= targetPoints) {
      return points;
    }

    // Group by metric name
    const grouped = new Map<string, AggregatedMetricPoint[]>();
    for (const point of points) {
      const key = this.getAggregatedMetricKey(point);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(point);
    }

    const downsampled: AggregatedMetricPoint[] = [];

    for (const [key, metricPoints] of grouped.entries()) {
      const { name, labels } = this.parseMetricKey(key);

      // Sort by timestamp
      const sorted = metricPoints.sort((a, b) => a.timestamp - b.timestamp);

      // Calculate bucket size
      const bucketSize = Math.ceil(sorted.length / targetPoints);

      // Create downsampled buckets
      for (let i = 0; i < sorted.length; i += bucketSize) {
        const bucket = sorted.slice(i, i + bucketSize);
        const timestamp = bucket[0].timestamp;
        const values = bucket.map(p => p.value);
        const totalCount = bucket.reduce((sum, p) => sum + p.count, 0);

        let value: number;
        switch (aggregation) {
          case 'sum':
            value = values.reduce((sum, v) => sum + v, 0);
            break;
          case 'min':
            value = Math.min(...values);
            break;
          case 'max':
            value = Math.max(...values);
            break;
          case 'avg':
          default:
            value = values.reduce((sum, v) => sum + v, 0) / values.length;
        }

        downsampled.push({
          name,
          timestamp,
          aggregation,
          value,
          count: totalCount,
          ...(labels && { labels })
        });
      }
    }

    return downsampled;
  }

  private getAggregatedMetricKey(point: AggregatedMetricPoint): string {
    if (!point.labels || Object.keys(point.labels).length === 0) {
      return point.name;
    }

    const labelStr = Object.entries(point.labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    return `${point.name}{${labelStr}}`;
  }
}
