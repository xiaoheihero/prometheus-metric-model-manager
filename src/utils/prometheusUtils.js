const axios = require('axios');
const https = require('https');

class PrometheusUtils {
  static async testConnection(config) {
    const { url, authType, username, password, headers, skipTlsVerify } = config;
    
    try {
      const axiosConfig = {
        method: 'get',
        url: `${url}/api/v1/query`,
        params: {
          query: 'up'
        },
        timeout: 10000,
        headers: {}
      };
      
      // 处理认证
      if (authType === 'basic' && username && password) {
        axiosConfig.auth = {
          username,
          password
        };
      }
      
      // 处理自定义headers
      if (headers) {
        try {
          const parsedHeaders = typeof headers === 'string' ? JSON.parse(headers) : headers;
          Object.assign(axiosConfig.headers, parsedHeaders);
        } catch (e) {
          console.warn('Failed to parse headers:', e);
        }
      }
      
      // 处理TLS验证
      if (skipTlsVerify) {
        axiosConfig.httpsAgent = new https.Agent({
          rejectUnauthorized: false
        });
      }
      
      const response = await axios(axiosConfig);
      
      if (response.data && response.data.status === 'success') {
        return {
          success: true,
          message: '连接成功',
          data: response.data.data
        };
      } else {
        return {
          success: false,
          message: 'Prometheus返回异常状态'
        };
      }
    } catch (error) {
      let errorMessage = '连接失败';
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage = '无法连接到服务器，请检查URL是否正确';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        errorMessage = '连接超时，请检查网络或URL是否正确';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = '无法解析主机名，请检查URL是否正确';
      } else if (error.response) {
        if (error.response.status === 401) {
          errorMessage = '认证失败，请检查用户名和密码';
        } else if (error.response.status === 403) {
          errorMessage = '访问被拒绝，请检查权限';
        } else if (error.response.status === 404) {
          errorMessage = 'API端点不存在，请检查URL是否正确';
        } else {
          errorMessage = `服务器返回错误: ${error.response.status}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }
  
  static async getAllMetrics(prometheusUrl) {
    try {
      const response = await axios.get(`${prometheusUrl}/api/v1/metadata`);
      
      if (response.data && response.data.data) {
        return Object.keys(response.data.data);
      }
      return [];
    } catch (error) {
      console.error('Error fetching all metrics:', error);
      return [];
    }
  }
  
  static async getMetricLabels(prometheusUrl, metricName) {
    try {
      const response = await axios.get(`${prometheusUrl}/api/v1/series`, {
        params: {
          match: [metricName]
        }
      });
      
      const series = response.data.data;
      const labelExamples = {};
      
      // 检查series是否存在且为数组
      if (series && Array.isArray(series)) {
        // 提取所有标签名和示例值
        series.forEach(seriesItem => {
          // 检查seriesItem是否存在
          if (seriesItem) {
            // 遍历seriesItem的所有属性
            Object.keys(seriesItem).forEach(labelName => {
              // 排除__name__标签
              if (labelName !== '__name__') {
                // 为每个标签保存第一个出现的示例值
                if (!labelExamples[labelName]) {
                  labelExamples[labelName] = seriesItem[labelName];
                }
              }
            });
          }
        });
      }
      
      // 转换为数组格式，包含标签名和示例值
      return Object.entries(labelExamples).map(([name, example]) => ({
        name,
        example
      }));
    } catch (error) {
      console.error('Error fetching metric labels:', error);
      throw error;
    }
  }
  
  static async getMetricValues(prometheusUrl, metricName, timeRange = '1h') {
    try {
      const response = await axios.get(`${prometheusUrl}/api/v1/query_range`, {
        params: {
          query: metricName,
          start: Date.now() / 1000 - 3600, // 1小时前
          end: Date.now() / 1000,
          step: '60s'
        }
      });
      
      return response.data.data.result;
    } catch (error) {
      console.error('Error fetching metric values:', error);
      throw error;
    }
  }
}

module.exports = PrometheusUtils;