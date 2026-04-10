const express = require('express');
const path = require('path');
const db = require('./src/models/db');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src', 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// 路由
const dataSourceRoutes = require('./src/routes/dataSourceRoutes');
const metricRoutes = require('./src/routes/metricRoutes');

app.use('/datasources', dataSourceRoutes);
app.use('/metrics', metricRoutes);

// 首页
app.get('/', (req, res) => {
  res.render('index');
});

// 初始化数据库
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Database initialization failed:', err);
});