const express = require('express');
const router = express.Router();
const db = require('../models/db');
const prometheusUtils = require('../utils/prometheusUtils');

// 列出所有数据源
router.get('/', async (req, res) => {
  try {
    const { name, page = 1, pageSize = 10 } = req.query;
    const result = await db.getAllDataSources(name || null, parseInt(page), parseInt(pageSize));
    res.render('datasources/index', { 
      dataSources: result.data,
      total: result.total,
      currentPage: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      searchName: name || '',
      req
    });
  } catch (err) {
    console.error('Error fetching data sources:', err);
    res.status(500).send(`Error fetching data sources: ${err.message || 'Unknown error'}`);
  }
});

// 测试数据源连接
router.post('/test', async (req, res) => {
  try {
    const { name, url, authType = 'none', username = '', password = '', headerKeys = [], headerValues = [], skipTlsVerify } = req.body;
    
    // 处理headers
    const headers = {};
    if (Array.isArray(headerKeys) && Array.isArray(headerValues)) {
      headerKeys.forEach((key, index) => {
        if (key && headerValues[index]) {
          headers[key] = headerValues[index];
        }
      });
    }
    
    // 测试连接
    const result = await prometheusUtils.testConnection({
      url,
      authType,
      username,
      password,
      headers: Object.keys(headers).length > 0 ? headers : null,
      skipTlsVerify: skipTlsVerify ? true : false
    });
    
    res.json(result);
  } catch (err) {
    console.error('Error testing data source:', err);
    res.json({
      success: false,
      message: err.message || '测试失败'
    });
  }
});

// 测试已保存的数据源连接
router.post('/test/:id', async (req, res) => {
  try {
    const dataSource = await db.getDataSourceById(req.params.id);
    
    if (!dataSource) {
      return res.json({
        success: false,
        message: '数据源不存在'
      });
    }
    
    // 测试连接
    const result = await prometheusUtils.testConnection({
      url: dataSource.url,
      authType: dataSource.auth_type,
      username: dataSource.username,
      password: dataSource.password,
      headers: dataSource.headers,
      skipTlsVerify: dataSource.skip_tls_verify
    });
    
    res.json(result);
  } catch (err) {
    console.error('Error testing data source:', err);
    res.json({
      success: false,
      message: err.message || '测试失败'
    });
  }
});

// 显示添加数据源表单
router.get('/add', (req, res) => {
  res.render('datasources/form', { isEdit: false, dataSource: null });
});

// 处理添加数据源
router.post('/add', async (req, res) => {
  try {
    const { name, url, authType = 'none', username = '', password = '', headerKeys = [], headerValues = [] } = req.body;
    // 处理headers
    const headers = {};
    if (Array.isArray(headerKeys) && Array.isArray(headerValues)) {
      headerKeys.forEach((key, index) => {
        if (key && headerValues[index]) {
          headers[key] = headerValues[index];
        }
      });
    }
    // 处理skipTlsVerify，checkbox未选中时req.body中没有该字段
    const skipTlsVerify = req.body.skipTlsVerify ? 1 : 0;
    await db.addDataSource(name, url, authType, username, password, JSON.stringify(headers), skipTlsVerify);
    res.redirect('/datasources');
  } catch (err) {
    console.error('Error adding data source:', err);
    res.status(500).send(`Error adding data source: ${err.message || 'Unknown error'}`);
  }
});

// 显示编辑数据源表单
router.get('/edit/:id', async (req, res) => {
  try {
    const dataSource = await db.getDataSourceById(req.params.id);
    res.render('datasources/form', { isEdit: true, dataSource });
  } catch (err) {
    console.error('Error fetching data source:', err);
    res.status(500).send(`Error fetching data source: ${err.message || 'Unknown error'}`);
  }
});

// 处理编辑数据源
router.post('/edit/:id', async (req, res) => {
  try {
    const { name, url, authType = 'none', username = '', password = '', headerKeys = [], headerValues = [] } = req.body;
    // 处理headers
    const headers = {};
    if (Array.isArray(headerKeys) && Array.isArray(headerValues)) {
      headerKeys.forEach((key, index) => {
        if (key && headerValues[index]) {
          headers[key] = headerValues[index];
        }
      });
    }
    // 处理skipTlsVerify，checkbox未选中时req.body中没有该字段
    const skipTlsVerify = req.body.skipTlsVerify ? 1 : 0;
    await db.updateDataSource(req.params.id, name, url, authType, username, password, JSON.stringify(headers), skipTlsVerify);
    res.redirect('/datasources');
  } catch (err) {
    console.error('Error updating data source:', err);
    res.status(500).send(`Error updating data source: ${err.message || 'Unknown error'}`);
  }
});

// 删除数据源
router.get('/delete/:id', async (req, res) => {
  try {
    await db.deleteDataSource(req.params.id);
    res.redirect('/datasources');
  } catch (err) {
    console.error('Error deleting data source:', err);
    res.status(500).send(`Error deleting data source: ${err.message || 'Unknown error'}`);
  }
});

module.exports = router;
