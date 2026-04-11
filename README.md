# Prometheus Metric Model Manager

一个用于管理Prometheus指标模型的工具，支持数据源管理、指标导入、标签管理等功能。

## 功能特性

### 核心功能

- **数据源管理**：添加、编辑、删除Prometheus数据源，支持认证配置
- **指标导入**：从Prometheus数据源导入指标及其标签
- **标签管理**：编辑标签的类型、取值范围、描述、示例等信息
- **手动添加指标**：支持手动创建指标和标签
- **搜索功能**：根据指标名称、采集器、责任人搜索指标
- **Docker支持**：提供Dockerfile，支持容器化部署

### 高级功能

- **数据源测试**：测试数据源连接是否正常
- **批量操作**：支持批量删除、导出、预览指标
- **分页展示**：数据源和指标列表支持分页，可调整页大小
- **智能导入**：导入时如果发现指标重复，仅增加新标签
- **导出功能**：支持导出为Markdown格式，支持单个和批量导出
- **预览功能**：支持单个和批量预览指标信息
- **气泡提示**：表格内容过长时显示省略号，悬浮显示完整内容

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

**智能导入**：如果导入的指标已存在，系统会自动检测并仅添加新标签，不会重复创建指标。

### 3. 手动添加指标

1. 访问 `http://localhost:3000/metrics`
2. 点击"手动添加指标"
3. 填写指标基本信息：
   - 指标名称：必填
   - 描述：指标描述
   - 采集器：采集器名称（必填）
   - 责任人：负责人信息
4. 添加标签信息：
   - 系统会自动添加一个"数据值"标签（必填，不可删除）
   - 可以手动添加其他标签
   - 每个标签包含：名称、值类型、取值范围、描述、示例、采集说明
5. 保存指标

### 4. 编辑指标

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
5. 可以手动添加新标签或删除现有标签

### 5. 搜索指标

1. 访问 `http://localhost:3000/metrics`
2. 使用搜索表单：
   - 按指标名称搜索
   - 按采集器搜索
   - 按责任人搜索
3. 支持模糊匹配

### 6. 批量操作

1. 访问 `http://localhost:3000/metrics`
2. 勾选要操作的指标（支持全选）
3. 点击批量操作按钮：
   - **批量删除**：删除选中的指标
   - **批量导出**：导出选中的指标为Markdown文件
   - **批量预览**：预览选中的指标信息

### 7. 预览和导出

**单个指标**：
- 点击指标的"预览"按钮查看详细信息
- 点击指标的"导出"按钮导出为Markdown文件

**批量操作**：
- 勾选多个指标后点击"批量预览"
- 勾选多个指标后点击"批量导出"

**预览功能**：
- 显示指标基本信息（名称、描述、采集器、责任人）
- 显示所有标签信息
- 支持打印
- 表格内容过长时悬浮显示完整内容

### 8. 分页功能

数据源和指标列表均支持分页：
- 可调整每页显示数量（10/20/50/100条）
- 支持跳转到指定页码
- 显示总记录数和当前页信息

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
│       │   ├── index.ejs    # 数据源列表
│       │   └── form.ejs     # 数据源添加/编辑表单
│       ├── metrics/         # 指标视图
│       │   ├── index.ejs    # 指标列表
│       │   ├── form.ejs     # 指标添加/编辑表单
│       │   ├── import.ejs   # 指标导入
│       │   └── preview.ejs  # 指标预览（单个/批量）
│       └── layout.ejs       # 布局模板
├── public/
│   └── css/
│       └── style.css        # 公共样式
├── server.js                # 主服务器文件
├── package.json             # 项目配置
├── Dockerfile               # Docker配置
├── .dockerignore            # Docker忽略文件
└── .gitignore               # Git忽略文件
```

## API接口

### API文档

应用提供了完整的Swagger API文档：

- **Swagger UI**: http://localhost:3000/api-docs
- **Swagger JSON**: http://localhost:3000/swagger.json

通过Swagger UI可以查看所有API接口的详细信息，包括参数、响应格式等，并支持在线测试。

### 数据源

- `GET /datasources` - 获取数据源列表（支持分页和搜索）
- `GET /datasources/add` - 显示添加数据源表单
- `POST /datasources/add` - 添加数据源
- `GET /datasources/edit/:id` - 显示编辑数据源表单
- `POST /datasources/edit/:id` - 更新数据源
- `GET /datasources/delete/:id` - 删除数据源
- `POST /datasources/test` - 测试数据源连接

### 指标

- `GET /metrics` - 获取指标列表（支持分页和搜索）
- `GET /metrics/add` - 显示手动添加指标表单
- `POST /metrics/add` - 手动添加指标
- `GET /metrics/import` - 显示导入指标表单
- `POST /metrics/import` - 导入指标
- `GET /metrics/edit/:id` - 显示编辑指标表单
- `POST /metrics/edit/:id` - 更新指标信息
- `POST /metrics/update-metric/:id` - 更新指标描述、采集器、责任人
- `POST /metrics/add-label/:id` - 添加标签
- `POST /metrics/edit-label/:id` - 编辑标签
- `GET /metrics/delete-label/:id` - 删除标签
- `GET /metrics/delete/:id` - 删除指标
- `POST /metrics/batch-delete` - 批量删除指标
- `GET /metrics/preview/:id` - 预览单个指标
- `GET /metrics/batch-preview` - 批量预览指标
- `GET /metrics/export/:id` - 导出单个指标为Markdown
- `GET /metrics/batch-export` - 批量导出指标为Markdown

## 数据库设计

### 数据源表 (datasources)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 数据源名称 |
| url | TEXT | Prometheus URL |
| auth_type | TEXT | 认证类型 |
| username | TEXT | 用户名 |
| password | TEXT | 密码 |
| headers | TEXT | Headers配置（JSON） |
| skip_tls_verify | INTEGER | 是否跳过TLS验证 |
| created_at | DATETIME | 创建时间 |

### 指标表 (metrics)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 指标名称 |
| description | TEXT | 指标描述 |
| collector | TEXT | 采集器 |
| owner | TEXT | 责任人 |
| created_at | DATETIME | 创建时间 |

**唯一约束**：name + collector

### 标签表 (labels)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| metric_id | INTEGER | 关联的指标ID |
| name | TEXT | 标签名称 |
| value_type | TEXT | 值类型 |
| value_range | TEXT | 取值范围 |
| description | TEXT | 描述 |
| example | TEXT | 示例 |
| collection_note | TEXT | 采集说明 |

**唯一约束**：metric_id + name

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

### 导入指标失败

1. 检查数据源配置是否正确
2. 使用"测试连接"功能验证数据源
3. 检查Prometheus服务器是否可访问
4. 查看服务器日志获取详细错误信息

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request。

## 更新日志

### v1.0.0 (2024-01-XX)

- 初始版本发布
- 支持数据源管理
- 支持指标导入和手动添加
- 支持标签管理
- 支持搜索功能
- 支持批量操作
- 支持分页展示
- 支持预览和导出功能
- 支持Docker部署
