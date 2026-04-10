# Prometheus Metric Model Manager

一个用于管理Prometheus指标模型的工具，支持数据源管理、指标导入、标签管理等功能。

## 功能特性

- **数据源管理**：添加、编辑、删除Prometheus数据源，支持认证配置
- **指标导入**：从Prometheus数据源导入指标及其标签
- **标签管理**：编辑标签的类型、取值范围、描述、示例等信息
- **搜索功能**：根据指标名称、采集器、责任人搜索指标
- **Docker支持**：提供Dockerfile，支持容器化部署

## 环境要求

### 运行环境

- **Node.js**: >= 14.0.0 (推荐使用 18.x LTS)
- **npm**: >= 6.0.0 (推荐使用 9.x)
- **操作系统**: Windows, Linux, macOS

### 依赖包

- **express**: ^4.18.2 - Web框架
- **axios**: ^1.6.2 - HTTP客户端
- **sqlite3**: ^5.1.6 - SQLite数据库
- **ejs**: ^3.1.9 - 模板引擎

## 安装

### 方式一：本地安装

1. **克隆项目**

```bash
git clone <repository-url>
cd prometheus_metric_model_manager
```

2. **安装依赖**

```bash
npm install
```

3. **启动应用**

```bash
npm start
```

应用将在 `http://localhost:3000` 启动。

### 方式二：Docker部署

1. **构建Docker镜像**

```bash
docker build -t prometheus-metric-model-manager .
```

2. **运行容器**

```bash
# 使用默认配置
docker run -d -p 3000:3000 --name metric-manager prometheus-metric-model-manager

# 挂载数据目录（推荐）
docker run -d -p 3000:3000 -v /path/to/data:/app/data --name metric-manager prometheus-metric-model-manager

# 使用Docker卷
docker volume create metric-data
docker run -d -p 3000:3000 -v metric-data:/app/data --name metric-manager prometheus-metric-model-manager
```

## 配置

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 应用端口 | `3000` |
| `DB_PATH` | SQLite数据库文件路径 | `./prometheus_metric_manager.db` |

### 数据库

应用使用SQLite数据库，数据库文件会在首次启动时自动创建。

- **本地运行**：数据库文件位于项目根目录
- **Docker运行**：数据库文件位于 `/app/data` 目录（可通过挂载持久化）

## 使用说明

### 1. 添加数据源

1. 访问 `http://localhost:3000/datasources`
2. 点击"添加数据源"
3. 填写数据源信息：
   - 名称：数据源名称
   - URL：Prometheus服务器地址
   - 认证类型：无认证/基础认证
   - 其他配置：Headers、TLS验证等
4. 点击"测试连接"验证配置
5. 保存数据源

### 2. 导入指标

1. 访问 `http://localhost:3000/metrics/import`
2. 选择数据源
3. 选择要导入的指标
4. 系统会自动获取指标的所有标签和示例值
5. 保存指标

### 3. 编辑指标

1. 访问 `http://localhost:3000/metrics`
2. 点击指标的"编辑"按钮
3. 编辑指标信息：
   - 描述：指标描述
   - 采集器：采集器名称
   - 责任人：负责人信息
4. 编辑标签信息：
   - 值类型：字符串/数字/布尔值
   - 取值范围：标签值的范围
   - 描述：标签含义说明
   - 示例：标签示例值
   - 采集说明：采集相关说明
5. 可以手动添加新标签

### 4. 搜索指标

1. 访问 `http://localhost:3000/metrics`
2. 使用搜索表单：
   - 按指标名称搜索
   - 按采集器搜索
   - 按责任人搜索
3. 支持模糊匹配

## 开发

### 开发模式

```bash
npm run dev
```

使用nodemon自动重启服务器。

### 项目结构

```
prometheus_metric_model_manager/
├── src/
│   ├── models/
│   │   └── db.js           # 数据库模型
│   ├── routes/
│   │   ├── dataSourceRoutes.js  # 数据源路由
│   │   └── metricRoutes.js      # 指标路由
│   ├── utils/
│   │   └── prometheusUtils.js   # Prometheus工具类
│   └── views/
│       ├── datasources/     # 数据源视图
│       ├── metrics/         # 指标视图
│       └── layout.ejs       # 布局模板
├── server.js                # 主服务器文件
├── package.json             # 项目配置
├── Dockerfile               # Docker配置
└── .dockerignore            # Docker忽略文件
```

## API接口

### 数据源

- `GET /datasources` - 获取数据源列表
- `GET /datasources/add` - 显示添加数据源表单
- `POST /datasources/add` - 添加数据源
- `GET /datasources/edit/:id` - 显示编辑数据源表单
- `POST /datasources/edit/:id` - 更新数据源
- `GET /datasources/delete/:id` - 删除数据源
- `POST /datasources/test` - 测试数据源连接

### 指标

- `GET /metrics` - 获取指标列表（支持搜索）
- `GET /metrics/import` - 显示导入指标表单
- `POST /metrics/import` - 导入指标
- `GET /metrics/edit/:id` - 显示编辑指标表单
- `POST /metrics/edit/:id` - 更新指标信息
- `POST /metrics/update-metric/:id` - 更新指标描述、采集器、责任人
- `POST /metrics/add-label/:id` - 添加标签
- `GET /metrics/delete/:id` - 删除指标

## 故障排除

### 端口被占用

```bash
# Windows
netstat -ano | findstr :3000
taskkill /F /PID <PID>

# Linux/macOS
lsof -i :3000
kill -9 <PID>
```

### 数据库错误

删除数据库文件重新启动应用：

```bash
rm prometheus_metric_manager.db
npm start
```

### Docker构建失败

确保已安装Docker并正确配置：

```bash
docker --version
docker info
```

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request。
