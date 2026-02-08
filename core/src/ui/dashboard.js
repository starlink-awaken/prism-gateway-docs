/**
 * PRISM-Gateway Dashboard JavaScript 模块
 *
 * @description
 * 提供 Dashboard 的核心功能：
 * - 从 Analytics API 获取数据
 * - 初始化和更新 Chart.js 图表
 * - 处理错误和加载状态
 * - 响应式设计支持
 *
 * @module ui/dashboard
 *
 * @example
 * ```html
 * <script src="/ui/dashboard.js"></script>
 * <script>
 *   // 页面加载后初始化
 *   document.addEventListener('DOMContentLoaded', () => {
 *     Dashboard.init();
 *   });
 * </script>
 * ```
 */

// ============================================================================
// 命名空间
// ============================================================================

/**
 * Dashboard 命名空间
 *
 * @description
 * 包含所有 Dashboard 相关的功能
 */
const Dashboard = (function() {
  'use strict';

  // ============================================================================
  // 私有变量
  // ============================================================================

  /**
   * Chart 实例存储
   *
   * @type {Map<string, Chart>}
   */
  const charts = new Map();

  /**
   * API 基础 URL
   *
   * @type {string}
   */
  const API_BASE = '/api/v1/analytics';

  /**
   * 当前加载状态
   *
   * @type {boolean}
   */
  let isLoading = false;

  /**
   * 当前选择的时间范围
   *
   * @type {string}
   */
  let currentPeriod = 'week';

  // ============================================================================
  // 工具函数
  // ============================================================================

  /**
   * 显示加载状态
   *
   * @param {boolean} loading - 是否处于加载状态
   */
  function setLoading(loading) {
    isLoading = loading;

    // 更新所有图表容器的加载状态
    const containers = document.querySelectorAll('.chart-container');
    containers.forEach(container => {
      if (loading) {
        container.classList.add('loading');
        container.classList.add('opacity-50');
      } else {
        container.classList.remove('loading');
        container.classList.remove('opacity-50');
      }
    });

    // 更新加载指示器（如果存在）
    const loader = document.getElementById('dashboard-loader');
    if (loader) {
      loader.style.display = loading ? 'flex' : 'none';
    }
  }

  /**
   * 显示错误消息
   *
   * @param {string} message - 错误消息
   * @param {string} [context] - 错误上下文
   */
  function showError(message, context = 'Dashboard') {
    console.error(`[${context}] Error:`, message);

    // 更新错误显示区域
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-700">${escapeHtml(message)}</p>
            </div>
          </div>
        </div>
      `;
      errorContainer.style.display = 'block';

      // 5秒后自动隐藏
      setTimeout(() => {
        errorContainer.style.display = 'none';
      }, 5000);
    }
  }

  /**
   * 转义 HTML 特殊字符
   *
   * @param {string} str - 需要转义的字符串
   * @returns {string} 转义后的字符串
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * 格式化数字
   *
   * @param {number} num - 需要格式化的数字
   * @returns {string} 格式化后的字符串
   */
  function formatNumber(num) {
    if (num === null || num === undefined) return '--';
    return new Intl.NumberFormat('zh-CN').format(num);
  }

  /**
   * 格式化时间（毫秒）
   *
   * @param {number} ms - 毫秒数
   * @returns {string} 格式化后的字符串
   */
  function formatDuration(ms) {
    if (ms === null || ms === undefined) return '--';
    if (ms < 1) return '< 1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  // ============================================================================
  // API 调用函数
  // ============================================================================

  /**
   * 获取仪表板数据
   *
   * @description
   * 从 Analytics API 获取完整的仪表板数据
   *
   * @param {string} [period='week'] - 时间范围 (today|week|month|year|all)
   * @returns {Promise<Object>} 仪表板数据
   *
   * @throws {Error} 当 API 请求失败时
   *
   * @example
   * ```js
   * const data = await Dashboard.fetchDashboardData('week');
   * console.log(data.summary.totalChecks);
   * ```
   */
  async function fetchDashboardData(period = 'week') {
    try {
      const url = `${API_BASE}/dashboard?period=${encodeURIComponent(period)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '未知错误');
      }

      return result.data;
    } catch (error) {
      console.error('[Dashboard] 获取仪表板数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取违规趋势数据
   *
   * @param {string} [period='week'] - 时间范围
   * @returns {Promise<Object>} 趋势数据
   */
  async function fetchViolationsTrend(period = 'week') {
    try {
      const url = `${API_BASE}/trends/violations?period=${encodeURIComponent(period)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('[Dashboard] 获取违规趋势失败:', error);
      return null;
    }
  }

  /**
   * 获取性能指标数据
   *
   * @param {string} [period='week'] - 时间范围
   * @returns {Promise<Object>} 性能数据
   */
  async function fetchPerformanceMetrics(period = 'week') {
    try {
      const url = `${API_BASE}/performance?period=${encodeURIComponent(period)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error('[Dashboard] 获取性能指标失败:', error);
      return null;
    }
  }

  // ============================================================================
  // Chart.js 图表初始化
  // ============================================================================

  /**
   * 初始化违规趋势图
   *
   * @description
   * 创建一个线图显示违规次数随时间的变化趋势
   *
   * @param {Object} data - 趋势数据
   * @param {Array} data.smoothed - 平滑后的数据点数组（来自 TrendAnalyzer）
   * @param {string} data.direction - 趋势方向 (up|down|stable)
   *
   * @example
   * ```js
   * Dashboard.initViolationsChart({
   *   smoothed: [
   *     { timestamp: '2026-02-01', value: 10 },
   *     { timestamp: '2026-02-02', value: 15 }
   *   ],
   *   direction: 'up'
   * });
   * ```
   */
  function initViolationsChart(data) {
    const canvas = document.getElementById('violations-chart');
    if (!canvas) {
      console.warn('[Dashboard] violations-chart canvas 未找到');
      return;
    }

    // 销毁已存在的图表
    const existingChart = charts.get('violations');
    if (existingChart) {
      existingChart.destroy();
    }

    // 准备数据：使用 smoothed 数据点（来自 TrendAnalyzer）
    const dataPoints = data.smoothed || data.dataPoints || [];
    const labels = dataPoints.map(p => {
      const date = new Date(p.timestamp);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }) || [];

    const values = dataPoints.map(p => p.value) || [];

    // 如果没有数据，显示空图表
    if (values.length === 0) {
      console.warn('[Dashboard] 没有违规趋势数据');
      return;
    }

    // 根据趋势方向选择颜色
    let lineColor = 'rgb(75, 192, 192)'; // 默认青色
    if (data.direction === 'up') {
      lineColor = 'rgb(239, 68, 68)'; // 红色
    } else if (data.direction === 'down') {
      lineColor = 'rgb(34, 197, 94)'; // 绿色
    }

    // 创建图表
    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '违规次数',
          data: values,
          borderColor: lineColor,
          backgroundColor: lineColor.replace('rgb', 'rgba').replace(')', ', 0.1)'),
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: lineColor,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 4
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });

    charts.set('violations', chart);
  }

  /**
   * 初始化性能图表
   *
   * @description
   * 创建一个柱状图显示不同百分位的检查时间
   *
   * @param {Object} data - 性能数据
   * @param {number} data.avgCheckTime - 平均检查时间
   * @param {number} data.p50CheckTime - P50 检查时间
   * @param {number} data.p95CheckTime - P95 检查时间
   * @param {number} data.p99CheckTime - P99 检查时间
   *
   * @example
   * ```js
   * Dashboard.initPerformanceChart({
   *   avgCheckTime: 10,
   *   p50CheckTime: 8,
   *   p95CheckTime: 15,
   *   p99CheckTime: 20
   * });
   * ```
   */
  function initPerformanceChart(data) {
    const canvas = document.getElementById('performance-chart');
    if (!canvas) {
      console.warn('[Dashboard] performance-chart canvas 未找到');
      return;
    }

    // 销毁已存在的图表
    const existingChart = charts.get('performance');
    if (existingChart) {
      existingChart.destroy();
    }

    // 准备数据
    const labels = ['平均', 'P50', 'P95', 'P99'];
    const values = [
      data.avgCheckTime || 0,
      data.p50CheckTime || 0,
      data.p95CheckTime || 0,
      data.p99CheckTime || 0
    ];

    // 根据性能水平选择颜色
    const backgroundColors = values.map(v => {
      if (v < 10) return 'rgba(34, 197, 94, 0.8)'; // 绿色 - 优秀
      if (v < 50) return 'rgba(251, 191, 36, 0.8)'; // 黄色 - 良好
      return 'rgba(239, 68, 68, 0.8)'; // 红色 - 需要优化
    });

    // 创建图表
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '检查时间 (ms)',
          data: values,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(c => c.replace('0.8', '1')),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 4,
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${formatDuration(context.raw)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: '时间 (ms)'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });

    charts.set('performance', chart);
  }

  // ============================================================================
  // UI 更新函数
  // ============================================================================

  /**
   * 更新统计卡片
   *
   * @param {Object} summary - 仪表板摘要数据
   */
  function updateStatCards(summary) {
    // 总检查次数
    const totalChecksEl = document.getElementById('total-checks');
    if (totalChecksEl) {
      totalChecksEl.textContent = formatNumber(summary.totalChecks || 0);
    }

    // 违规次数
    const violationsEl = document.getElementById('violations');
    if (violationsEl) {
      violationsEl.textContent = formatNumber(summary.violations || 0);
    }

    // 活跃用户
    const activeUsersEl = document.getElementById('active-users');
    if (activeUsersEl) {
      activeUsersEl.textContent = formatNumber(summary.activeUsers || 0);
    }

    // 平均检查时间
    const avgCheckTimeEl = document.getElementById('avg-check-time');
    if (avgCheckTimeEl) {
      avgCheckTimeEl.textContent = formatDuration(summary.avgCheckTime);
    }
  }

  /**
   * 更新质量指标
   *
   * @param {Object} quality - 质量指标数据
   */
  function updateQualityMetrics(quality) {
    // 违规率
    const violationRate = quality.violationRate || 0;
    const violationRateEl = document.getElementById('violation-rate');
    const violationRateBar = document.getElementById('violation-rate-bar');
    if (violationRateEl) {
      violationRateEl.textContent = `${(violationRate * 100).toFixed(1)}%`;
    }
    if (violationRateBar) {
      violationRateBar.style.width = `${Math.min(violationRate * 100, 100)}%`;
    }

    // 误报率
    const falsePositiveRate = quality.falsePositiveRate || 0;
    const falsePositiveRateEl = document.getElementById('false-positive-rate');
    const falsePositiveBar = document.getElementById('false-positive-bar');
    if (falsePositiveRateEl) {
      falsePositiveRateEl.textContent = `${(falsePositiveRate * 100).toFixed(1)}%`;
    }
    if (falsePositiveBar) {
      falsePositiveBar.style.width = `${Math.min(falsePositiveRate * 100, 100)}%`;
    }

    // Top 违规原则
    const topViolationsEl = document.getElementById('top-violations');
    if (topViolationsEl && quality.topViolations) {
      topViolationsEl.innerHTML = quality.topViolations
        .slice(0, 3)
        .map((v, i) => `
          <li class="flex justify-between">
            <span>P${i + 1}</span>
            <span class="font-medium">${v.principle || v.name || '--'}</span>
            <span class="text-gray-500">${v.count || 0}次</span>
          </li>
        `).join('');
    }
  }

  /**
   * 更新使用指标
   *
   * @param {Object} usage - 使用指标数据
   */
  function updateUsageMetrics(usage) {
    // 复盘次数
    const retrosCountEl = document.getElementById('retros-count');
    if (retrosCountEl) {
      retrosCountEl.textContent = formatNumber(usage.totalRetrospectives || 0);
    }

    // 活跃会话数
    const activeSessionsEl = document.getElementById('active-sessions');
    if (activeSessionsEl) {
      activeSessionsEl.textContent = formatNumber(usage.activeSessions || 0);
    }

    // 平均时长
    const avgDurationEl = document.getElementById('avg-duration');
    if (avgDurationEl) {
      const avgDuration = usage.avgDuration || 0;
      avgDurationEl.textContent = avgDuration > 0
        ? formatDuration(avgDuration)
        : '--';
    }

    // 成功率
    const successRateEl = document.getElementById('success-rate');
    if (successRateEl) {
      const successRate = usage.successRate || 0;
      successRateEl.textContent = `${(successRate * 100).toFixed(1)}%`;
    }
  }

  // ============================================================================
  // 公共 API
  // ============================================================================

  /**
   * 初始化 Dashboard
   *
   * @description
   * 初始化所有图表和数据绑定
   *
   * @param {Object} [options] - 配置选项
   * @param {string} [options.period='week'] - 默认时间范围
   * @param {boolean} [options.autoRefresh=false] - 是否自动刷新
   * @param {number} [options.refreshInterval=60000] - 刷新间隔（毫秒）
   */
  async function init(options = {}) {
    const {
      period = 'week',
      autoRefresh = false,
      refreshInterval = 60000
    } = options;

    currentPeriod = period;

    try {
      setLoading(true);

      // 并行获取所有数据
      const [dashboard, violationsTrend, performance] = await Promise.all([
        fetchDashboardData(currentPeriod),
        fetchViolationsTrend(currentPeriod),
        fetchPerformanceMetrics(currentPeriod)
      ]);

      // 更新 UI
      if (dashboard) {
        updateStatCards(dashboard.summary);
        if (dashboard.quality) {
          updateQualityMetrics(dashboard.quality);
        }
        if (dashboard.usage) {
          updateUsageMetrics(dashboard.usage);
        }
      }

      // 初始化图表
      if (violationsTrend) {
        initViolationsChart(violationsTrend);
      }

      if (performance) {
        initPerformanceChart(performance);
      }

      // 设置自动刷新
      if (autoRefresh) {
        setInterval(() => {
          refresh();
        }, refreshInterval);
      }

      console.log('[Dashboard] 初始化完成');
    } catch (error) {
      showError(error.message, 'Dashboard Init');
    } finally {
      setLoading(false);
    }
  }

  /**
   * 刷新 Dashboard 数据
   *
   * @description
   * 重新获取当前时间范围的数据并更新 UI
   */
  async function refresh() {
    if (isLoading) {
      console.warn('[Dashboard] 正在加载中，跳过刷新');
      return;
    }

    await init({ period: currentPeriod });
  }

  /**
   * 获取并更新Dashboard数据（Task 74: 实时事件推送）
   *
   * @description
   * 静默刷新数据，不显示加载状态（用于WebSocket实时更新）
   */
  async function fetchAndUpdate() {
    try {
      console.log('[Dashboard] Fetching data for real-time update');

      // 获取仪表板数据
      const data = await fetchDashboardData(currentPeriod);

      // 更新Stats Cards（不显示加载状态）
      if (data.summary) {
        updateStatCards(data.summary);
      }

      if (data.quality) {
        updateQualityMetrics(data.quality);
      }

      if (data.usage) {
        updateUsageMetrics(data.usage);
      }

      // 更新图表
      if (data.trends && data.trends.violations) {
        updateViolationsChart(data.trends.violations);
      }

      if (data.performance) {
        updatePerformanceChart(data.performance);
      }

      console.log('[Dashboard] Real-time update completed');
    } catch (error) {
      console.error('[Dashboard] Real-time update failed:', error);
      // 静默失败，不显示错误（避免打扰用户）
    }
  }

  /**
   * 切换时间范围
   *
   * @description
   * 切换到指定的时间范围并刷新数据
   *
   * @param {string} period - 新的时间范围 (today|week|month|year|all)
   */
  async function changePeriod(period) {
    const validPeriods = ['today', 'week', 'month', 'year', 'all'];
    if (!validPeriods.includes(period)) {
      console.error(`[Dashboard] 无效的时间范围: ${period}`);
      return;
    }

    currentPeriod = period;
    await refresh();
  }

  /**
   * 销毁 Dashboard
   *
   * @description
   * 清理所有资源，包括图表实例
   */
  function destroy() {
    // 销毁所有图表
    charts.forEach((chart) => {
      chart.destroy();
    });
    charts.clear();

    console.log('[Dashboard] 已销毁');
  }

  /**
   * 获取当前状态
   *
   * @returns {Object} 当前状态信息
   */
  function getState() {
    return {
      isLoading,
      currentPeriod,
      chartsCount: charts.size
    };
  }

  // 导出公共 API
  return {
    init,
    refresh,
    fetchAndUpdate,  // Task 74: 实时更新方法
    changePeriod,
    destroy,
    getState,
    fetchDashboardData,
    initViolationsChart,
    initPerformanceChart
  };

})();

// ============================================================================
// 全局导出
// ============================================================================

// 在浏览器环境中挂载到 window
if (typeof window !== 'undefined') {
  window.Dashboard = Dashboard;
}

// 在 Node.js/CommonJS 环境中导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Dashboard;
}
