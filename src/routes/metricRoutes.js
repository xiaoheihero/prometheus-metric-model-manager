const express = require('express');
const router = express.Router();
const db = require('../models/db');
const prometheusUtils = require('../utils/prometheusUtils');

// 获取指标列表
router.get('/', async (req, res) => {
  try {
    const { name, collector, owner, page = 1, pageSize = 10 } = req.query;
    const result = await db.getAllMetrics(name, collector, owner, parseInt(page), parseInt(pageSize));
    res.render('metrics/index', { 
      metrics: result.data,
      total: result.total,
      currentPage: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      searchName: name || '',
      searchCollector: collector || '',
      searchOwner: owner || '',
      req
    });
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).send(`Error fetching metrics: ${err.message || 'Unknown error'}`);
  }
});

// 显示导入metric表单
router.get('/import', async (req, res) => {
  try {
    const result = await db.getAllDataSources(null, 1, 1000);
    res.render('metrics/import', { dataSources: result.data });
  } catch (err) {
    console.error('Error fetching data sources:', err);
    res.status(500).send(`Error fetching data sources: ${err.message || 'Unknown error'}`);
  }
});

// 显示手动添加指标表单
router.get('/add', async (req, res) => {
  try {
    res.render('metrics/form', { isEdit: false, metric: null, labels: null, valueLabel: null });
  } catch (err) {
    console.error('Error showing add metric form:', err);
    res.status(500).send(`Error showing add metric form: ${err.message || 'Unknown error'}`);
  }
});

// 处理手动添加指标
router.post('/add', async (req, res) => {
  try {
    const { metricName, description, collector, owner, labels } = req.body;
    
    if (!metricName) {
      return res.status(400).json({ error: '指标名称不能为空' });
    }
    
    // 保存指标
    let metricId;
    try {
      metricId = await db.addMetric(metricName, description || '', collector || '', owner || '');
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: `指标 "${metricName}" 已存在（相同名称和采集器）` });
      }
      throw err;
    }
    
    // 保存标签
    if (labels && labels.length > 0) {
      for (const label of labels) {
        try {
          await db.addLabel(
            metricId,
            label.name,
            label.valueType || '',
            label.valueRange || '',
            label.description || '',
            label.example || '',
            label.collectionNote || ''
          );
        } catch (err) {
          if (err.message && err.message.includes('UNIQUE constraint failed')) {
            console.warn(`标签 "${label.name}" 已存在，跳过`);
          } else {
            throw err;
          }
        }
      }
    }
    
    res.json({ metricId, message: '指标添加成功' });
  } catch (err) {
    console.error('Error adding metric:', err);
    res.status(500).json({ error: `Error adding metric: ${err.message || 'Unknown error'}` });
  }
});

// 获取数据源的指标列表
router.get('/datasource/:id/metrics', async (req, res) => {
  try {
    const dataSource = await db.getDataSourceById(req.params.id);
    if (!dataSource) {
      return res.status(404).json({ error: 'Data source not found' });
    }
    
    // 从Prometheus获取所有指标
    const metrics = await prometheusUtils.getAllMetrics(dataSource.url);
    res.json(metrics);
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: `Error fetching metrics: ${err.message || 'Unknown error'}` });
  }
});

// 处理导入metric
router.post('/import', async (req, res) => {
  try {
    const { dataSourceId, metricName } = req.body;
    
    // 获取数据源信息
    const dataSource = await db.getDataSourceById(dataSourceId);
    if (!dataSource) {
      res.status(404).json({ error: '数据源不存在' });
      return;
    }
    
    // 从Prometheus获取指标标签和示例值
    const labels = await prometheusUtils.getMetricLabels(dataSource.url, metricName);
    
    // 检查指标是否已存在（名称+采集器唯一）
    let metricId;
    let isNewMetric = true;
    let existingLabels = [];
    
    // 从标签中获取job值作为采集器
    const jobLabel = labels.find(label => label.name === 'job');
    const collector = jobLabel ? jobLabel.example : '';
    
    const existingMetric = await db.getMetricByNameAndCollector(metricName, collector);
    
    if (existingMetric) {
      // 指标已存在，获取已有标签
      metricId = existingMetric.id;
      isNewMetric = false;
      existingLabels = await db.getLabelsByMetricId(metricId);
    } else {
      // 创建新指标
      metricId = await db.addMetric(metricName, '', collector, '');
    }
    
    // 获取已有标签名称列表
    const existingLabelNames = existingLabels.map(label => label.name);
    
    // 检查是否已经包含job标签
    const hasJobLabel = labels.some(label => label.name === 'job');
    
    // 统计新增标签数量
    let newLabelCount = 0;
    
    // 保存标签（仅添加新标签）
    for (const label of labels) {
      if (!existingLabelNames.includes(label.name)) {
        await db.addLabel(metricId, label.name, '', '', '', label.example, '');
        newLabelCount++;
      }
    }
    
    // 如果没有job标签且不存在job标签，添加一个默认的job标签
    if (!hasJobLabel && !existingLabelNames.includes('job')) {
      await db.addLabel(metricId, 'job', 'string', '', '采集任务名称', 'node_exporter', '指标的采集任务名称');
      newLabelCount++;
    }
    
    // 如果不存在数据值标签，添加特殊标签
    if (!existingLabelNames.includes('数据值')) {
      await db.addLabel(metricId, '数据值', 'number', '', '这是一个特殊标签，代表指标的实际数值', '100', '');
      newLabelCount++;
    }
    
    res.json({
      redirectUrl: `/metrics/edit/${metricId}`,
      labelCount: newLabelCount,
      isNewMetric: isNewMetric,
      message: isNewMetric 
        ? `成功导入指标，共 ${newLabelCount} 个标签` 
        : `指标已存在，新增 ${newLabelCount} 个标签`
    });
  } catch (err) {
    console.error('Error importing metric:', err);
    res.status(500).send(`Error importing metric: ${err.message || 'Unknown error'}`);
  }
});

// 编辑metric标签信息
router.get('/edit/:id', async (req, res) => {
  try {
    const metric = await db.getMetricById(req.params.id);
    const allLabels = await db.getLabelsByMetricId(req.params.id);
    
    // 分离数据值标签
    const labels = allLabels.filter(label => label.name !== '数据值');
    const valueLabel = allLabels.find(label => label.name === '数据值');
    
    res.render('metrics/form', { isEdit: true, metric, labels, valueLabel });
  } catch (err) {
    console.error('Error fetching metric:', err);
    res.status(500).send(`Error fetching metric: ${err.message || 'Unknown error'}`);
  }
});

// 处理更新标签信息
router.post('/edit/:id', async (req, res) => {
  try {
    const metricId = req.params.id;
    
    // 处理从弹出框提交的单个标签编辑
    if (req.body.labelId) {
      const labelId = req.body.labelId;
      await db.updateLabel(
        labelId,
        req.body.editValueType,
        req.body.editValueRange,
        req.body.editDescription,
        req.body.editExample,
        req.body.editCollectionNote
      );
      
      // 检查是否是AJAX请求
      if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
        return res.json({ success: true });
      }
    }
    // 处理传统的批量标签编辑（保留向后兼容）
    else if (req.body.labels) {
      const labelUpdates = req.body.labels;
      for (const [labelId, update] of Object.entries(labelUpdates)) {
        await db.updateLabel(labelId, update.valueType, update.valueRange, update.description, update.example, update.collectionNote);
      }
    }
    
    res.redirect(`/metrics/edit/${metricId}`);
  } catch (err) {
    console.error('Error updating labels:', err);
    res.status(500).send(`Error updating labels: ${err.message || 'Unknown error'}`);
  }
});

// 获取推荐值
router.get('/recommend/:metricId/:labelName', async (req, res) => {
  try {
    const { metricId, labelName } = req.params;
    // 这里可以实现基于已录入数据的推荐逻辑
    // 暂时返回空数组
    res.json([]);
  } catch (err) {
    console.error('Error getting recommendations:', err);
    res.status(500).json({ error: `Error getting recommendations: ${err.message || 'Unknown error'}` });
  }
});

// 删除指标
router.get('/delete/:id', async (req, res) => {
  try {
    await db.deleteMetric(req.params.id);
    res.redirect('/metrics');
  } catch (err) {
    console.error('Error deleting metric:', err);
    res.status(500).send(`Error deleting metric: ${err.message || 'Unknown error'}`);
  }
});

// 更新指标信息
router.post('/update-metric/:id', async (req, res) => {
  try {
    const metricId = req.params.id;
    const { description, collector, owner } = req.body;
    await db.updateMetric(metricId, description, collector, owner);
    res.redirect(`/metrics/edit/${metricId}`);
  } catch (err) {
    console.error('Error updating metric:', err);
    res.status(500).send(`Error updating metric: ${err.message || 'Unknown error'}`);
  }
});

// 添加标签
router.post('/add-label/:id', async (req, res) => {
  try {
    const metricId = req.params.id;
    const { addName, addValueType, addValueRange, addDescription, addExample, addCollectionNote } = req.body;
    
    try {
      await db.addLabel(metricId, addName, addValueType, addValueRange, addDescription, addExample, addCollectionNote);
      res.redirect(`/metrics/edit/${metricId}`);
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        res.status(400).send(`标签 "${addName}" 已存在`);
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('Error adding label:', err);
    res.status(500).send(`Error adding label: ${err.message || 'Unknown error'}`);
  }
});

// 删除标签
router.delete('/delete-label/:id', async (req, res) => {
  try {
    const labelId = req.params.id;
    await db.deleteLabel(labelId);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Error deleting label:', err);
    res.status(500).send(`Error deleting label: ${err.message || 'Unknown error'}`);
  }
});

// 预览指标
router.get('/preview/:id', async (req, res) => {
  try {
    const metricId = req.params.id;
    const metric = await db.getMetricById(metricId);
    if (!metric) {
      return res.status(404).send('指标不存在');
    }
    const labels = await db.getLabelsByMetricId(metricId);
    res.render('metrics/preview', { metrics: [{ ...metric, labels }], isBatch: false });
  } catch (err) {
    console.error('Error previewing metric:', err);
    res.status(500).send(`Error previewing metric: ${err.message || 'Unknown error'}`);
  }
});

// 导出Markdown
router.get('/export/:id', async (req, res) => {
  try {
    const metricId = req.params.id;
    const metric = await db.getMetricById(metricId);
    if (!metric) {
      return res.status(404).send('指标不存在');
    }
    const labels = await db.getLabelsByMetricId(metricId);
    
    // 生成Markdown内容
    let markdown = `# ${metric.name}\n\n`;
    
    // 指标基本信息
    markdown += `## 指标信息\n\n`;
    markdown += `| 属性 | 值 |\n`;
    markdown += `|------|----|\n`;
    markdown += `| 指标名称 | ${metric.name} |\n`;
    markdown += `| 指标ID | ${metric.id} |\n`;
    markdown += `| 描述 | ${metric.description || ''} |\n`;
    markdown += `| 采集器 | ${metric.collector || ''} |\n`;
    markdown += `| 责任人 | ${metric.owner || ''} |\n`;
    
    if (metric.created_at) {
      markdown += `| 创建时间 | ${metric.created_at} |\n`;
    }
    
    markdown += `\n`;
    
    // 标签信息
    markdown += `## 标签信息\n\n`;
    
    if (labels && labels.length > 0) {
      markdown += `| 标签名称 | 值类型 | 取值范围 | 描述 | 示例 | 采集说明 |\n`;
      markdown += `|---------|--------|---------|------|------|----------|\n`;
      
      labels.forEach(label => {
        markdown += `| ${label.name} | ${label.value_type || ''} | ${label.value_range || ''} | ${label.description || ''} | ${label.example || ''} | ${label.collection_note || ''} |\n`;
      });
      
      markdown += `\n`;
      markdown += `**标签总数**: ${labels.length}\n`;
    } else {
      markdown += `暂无标签信息\n`;
    }
    
    // 添加导出信息
    markdown += `\n---\n\n`;
    markdown += `*导出时间: ${new Date().toLocaleString('zh-CN')}*\n`;
    markdown += `*来源: Prometheus Metric Model Manager*\n`;
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${metric.name}.md"`);
    res.send(markdown);
  } catch (err) {
    console.error('Error exporting metric:', err);
    res.status(500).send(`Error exporting metric: ${err.message || 'Unknown error'}`);
  }
});

// 批量删除指标
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '请选择要删除的指标' });
    }
    
    let deletedCount = 0;
    
    for (const id of ids) {
      try {
        await db.deleteMetric(id);
        deletedCount++;
      } catch (err) {
        console.error(`Error deleting metric ${id}:`, err);
      }
    }
    
    res.json({ success: true, deletedCount });
  } catch (err) {
    console.error('Error batch deleting metrics:', err);
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
});

// 批量导出Markdown
router.get('/batch-export', async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).send('请选择要导出的指标');
    }
    
    const idArray = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (idArray.length === 0) {
      return res.status(400).send('无效的指标ID');
    }
    
    let markdown = `# Prometheus 指标文档\n\n`;
    markdown += `*导出时间: ${new Date().toLocaleString('zh-CN')}*\n`;
    markdown += `*指标数量: ${idArray.length}*\n\n`;
    markdown += `---\n\n`;
    
    for (const metricId of idArray) {
      const metric = await db.getMetricById(metricId);
      if (!metric) continue;
      
      const labels = await db.getLabelsByMetricId(metricId);
      
      markdown += `## ${metric.name}\n\n`;
      
      markdown += `### 指标信息\n\n`;
      markdown += `| 属性 | 值 |\n`;
      markdown += `|------|----|\n`;
      markdown += `| 指标名称 | ${metric.name} |\n`;
      markdown += `| 指标ID | ${metric.id} |\n`;
      markdown += `| 描述 | ${metric.description || ''} |\n`;
      markdown += `| 采集器 | ${metric.collector || ''} |\n`;
      markdown += `| 责任人 | ${metric.owner || ''} |\n`;
      
      markdown += `\n`;
      
      markdown += `### 标签信息\n\n`;
      
      if (labels && labels.length > 0) {
        markdown += `| 标签名称 | 值类型 | 取值范围 | 描述 | 示例 | 采集说明 |\n`;
        markdown += `|---------|--------|---------|------|------|----------|\n`;
        
        labels.forEach(label => {
          markdown += `| ${label.name} | ${label.value_type || ''} | ${label.value_range || ''} | ${label.description || ''} | ${label.example || ''} | ${label.collection_note || ''} |\n`;
        });
        
        markdown += `\n`;
      } else {
        markdown += `暂无标签信息\n\n`;
      }
      
      markdown += `---\n\n`;
    }
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="metrics_export_${Date.now()}.md"`);
    res.send(markdown);
  } catch (err) {
    console.error('Error batch exporting metrics:', err);
    res.status(500).send(`Error batch exporting metrics: ${err.message || 'Unknown error'}`);
  }
});

// 批量预览
router.get('/batch-preview', async (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).send('请选择要预览的指标');
    }
    
    const idArray = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (idArray.length === 0) {
      return res.status(400).send('无效的指标ID');
    }
    
    const metrics = [];
    
    for (const metricId of idArray) {
      const metric = await db.getMetricById(metricId);
      if (metric) {
        const labels = await db.getLabelsByMetricId(metricId);
        metrics.push({ ...metric, labels });
      }
    }
    
    res.render('metrics/preview', { metrics, isBatch: true });
  } catch (err) {
    console.error('Error batch previewing metrics:', err);
    res.status(500).send(`Error batch previewing metrics: ${err.message || 'Unknown error'}`);
  }
});

module.exports = router;