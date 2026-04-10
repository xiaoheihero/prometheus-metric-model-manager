const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'prometheus_metric_manager.db');
let db;

class Database {
  static init() {
    return new Promise((resolve, reject) => {
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // 创建数据源表
        db.run(`
          CREATE TABLE IF NOT EXISTS data_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            auth_type TEXT DEFAULT 'none',
            username TEXT,
            password TEXT,
            headers TEXT,
            skip_tls_verify INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // 数据源表迁移
        db.all('PRAGMA table_info(data_sources)', (err, columns) => {
          if (!err && columns) {
            const columnNames = columns.map(col => col.name);
            if (!columnNames.includes('auth_type')) {
              db.run('ALTER TABLE data_sources ADD COLUMN auth_type TEXT DEFAULT \'none\'');
            }
            if (!columnNames.includes('username')) {
              db.run('ALTER TABLE data_sources ADD COLUMN username TEXT');
            }
            if (!columnNames.includes('password')) {
              db.run('ALTER TABLE data_sources ADD COLUMN password TEXT');
            }
            if (!columnNames.includes('headers')) {
              db.run('ALTER TABLE data_sources ADD COLUMN headers TEXT DEFAULT \'{}\'' );
            }
            if (!columnNames.includes('skip_tls_verify')) {
              db.run('ALTER TABLE data_sources ADD COLUMN skip_tls_verify INTEGER DEFAULT 0');
            }
          }
        });
        
        // 创建metrics表
        db.run(`
          CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            collector TEXT,
            owner TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, collector)
          )
        `);
        
        // metrics表迁移
        db.all('PRAGMA table_info(metrics)', (err, columns) => {
          if (!err && columns) {
            const columnNames = columns.map(col => col.name);
            if (!columnNames.includes('description')) {
              db.run('ALTER TABLE metrics ADD COLUMN description TEXT');
            }
            if (!columnNames.includes('collector')) {
              db.run('ALTER TABLE metrics ADD COLUMN collector TEXT');
            }
            if (!columnNames.includes('owner')) {
              db.run('ALTER TABLE metrics ADD COLUMN owner TEXT');
            }
          }
        });
        
        // 添加唯一索引（如果不存在）
        db.run(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_name_collector 
          ON metrics(name, collector)
        `);
        
        // 创建labels表
        db.run(`
          CREATE TABLE IF NOT EXISTS labels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_id INTEGER,
            name TEXT NOT NULL,
            value_type TEXT,
            value_range TEXT,
            description TEXT,
            example TEXT,
            collection_note TEXT,
            FOREIGN KEY (metric_id) REFERENCES metrics(id)
          )
        `);
        
        // labels表迁移
        db.all('PRAGMA table_info(labels)', (err, columns) => {
          if (!err && columns) {
            const columnNames = columns.map(col => col.name);
            if (!columnNames.includes('example')) {
              db.run('ALTER TABLE labels ADD COLUMN example TEXT');
            }
            if (!columnNames.includes('collection_note')) {
              db.run('ALTER TABLE labels ADD COLUMN collection_note TEXT');
            }
          }
        });
        
        // 删除旧的全局唯一索引（如果存在）
        db.run(`DROP INDEX IF EXISTS idx_labels_name`);
        
        // 迁移labels表：移除name字段的UNIQUE约束
        db.all('PRAGMA table_info(labels)', (err, columns) => {
          if (!err && columns) {
            // 检查是否需要迁移（通过检查索引是否存在）
            db.all('PRAGMA index_list(labels)', (err, indexes) => {
              if (!err && indexes) {
                const hasOldUniqueIndex = indexes.some(idx => 
                  idx.name === 'sqlite_autoindex_labels_1' || 
                  idx.origin === 'u' // u表示UNIQUE约束自动创建的索引
                );
                
                if (hasOldUniqueIndex) {
                  // 需要重建表
                  db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    db.run(`ALTER TABLE labels RENAME TO labels_old`);
                    db.run(`
                      CREATE TABLE labels (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        metric_id INTEGER,
                        name TEXT NOT NULL,
                        value_type TEXT,
                        value_range TEXT,
                        description TEXT,
                        example TEXT,
                        collection_note TEXT,
                        FOREIGN KEY (metric_id) REFERENCES metrics(id)
                      )
                    `);
                    db.run(`
                      INSERT INTO labels 
                      SELECT id, metric_id, name, value_type, value_range, description, example, collection_note 
                      FROM labels_old
                    `);
                    db.run('DROP TABLE labels_old');
                    db.run('COMMIT');
                  });
                }
              }
            });
          }
        });
        
        // 添加新的组合唯一索引（指标ID + 标签名称）
        db.run(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_labels_metric_name 
          ON labels(metric_id, name)
        `);
        
        resolve();
      });
    });
  }
  
  static getDB() {
    return db;
  }
  
  // 数据源操作
  static addDataSource(name, url, authType = 'none', username = '', password = '', headers = '{}', skipTlsVerify = 0) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO data_sources (name, url, auth_type, username, password, headers, skip_tls_verify) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, url, authType, username, password, headers, skipTlsVerify],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.lastID);
        }
      );
    });
  }
  
  static getDataSourceById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM data_sources WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row);
        }
      );
    });
  }
  
  static getAllDataSources(name = null, page = 1, pageSize = 10) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM data_sources';
      let countSql = 'SELECT COUNT(*) as total FROM data_sources';
      let params = [];
      let countParams = [];
      
      if (name) {
        sql += ' WHERE name LIKE ?';
        countSql += ' WHERE name LIKE ?';
        params.push(`%${name}%`);
        countParams.push(`%${name}%`);
      }
      
      sql += ' ORDER BY id DESC';
      
      const offset = (page - 1) * pageSize;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(pageSize, offset);
      
      db.get(countSql, countParams, (err, countRow) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            data: rows,
            total: countRow.total,
            page: page,
            pageSize: pageSize,
            totalPages: Math.ceil(countRow.total / pageSize)
          });
        });
      });
    });
  }
  
  static updateDataSource(id, name, url, authType = 'none', username = '', password = '', headers = '{}', skipTlsVerify = 0) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE data_sources SET name = ?, url = ?, auth_type = ?, username = ?, password = ?, headers = ?, skip_tls_verify = ? WHERE id = ?',
        [name, url, authType, username, password, headers, skipTlsVerify, id],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes);
        }
      );
    });
  }
  
  static deleteDataSource(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM data_sources WHERE id = ?',
        [id],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes);
        }
      );
    });
  }
  
  // Metric操作
  static addMetric(name, description = '', collector = '', owner = '') {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO metrics (name, description, collector, owner) VALUES (?, ?, ?, ?)',
        [name, description, collector, owner],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.lastID);
        }
      );
    });
  }
  
  static getMetricById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM metrics WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row);
        }
      );
    });
  }
  
  static getMetricByNameAndCollector(name, collector = '') {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM metrics WHERE name = ? AND (collector = ? OR (collector IS NULL AND ? = "") OR (collector = "" AND ? = ""))',
        [name, collector, collector, collector],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row);
        }
      );
    });
  }
  
  static getAllMetrics(name, collector, owner, page = 1, pageSize = 10) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM metrics WHERE 1=1';
      let countQuery = 'SELECT COUNT(*) as total FROM metrics WHERE 1=1';
      const params = [];
      const countParams = [];
      
      if (name) {
        query += ' AND name LIKE ?';
        countQuery += ' AND name LIKE ?';
        params.push('%' + name + '%');
        countParams.push('%' + name + '%');
      }
      
      if (collector) {
        query += ' AND collector LIKE ?';
        countQuery += ' AND collector LIKE ?';
        params.push('%' + collector + '%');
        countParams.push('%' + collector + '%');
      }
      
      if (owner) {
        query += ' AND owner LIKE ?';
        countQuery += ' AND owner LIKE ?';
        params.push('%' + owner + '%');
        countParams.push('%' + owner + '%');
      }
      
      query += ' ORDER BY id DESC';
      
      const offset = (page - 1) * pageSize;
      query += ' LIMIT ? OFFSET ?';
      params.push(pageSize, offset);
      
      db.get(countQuery, countParams, (err, countRow) => {
        if (err) {
          reject(err);
          return;
        }
        
        db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            data: rows,
            total: countRow.total,
            page: page,
            pageSize: pageSize,
            totalPages: Math.ceil(countRow.total / pageSize)
          });
        });
      });
    });
  }
  
  static deleteMetric(id) {
    return new Promise((resolve, reject) => {
      // 先删除关联的标签
      db.run('DELETE FROM labels WHERE metric_id = ?', [id], (err) => {
        if (err) {
          reject(err);
          return;
        }
        // 再删除指标
        db.run('DELETE FROM metrics WHERE id = ?', [id], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes);
        });
      });
    });
  }
  
  static updateMetric(id, description = '', collector = '', owner = '') {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE metrics SET description = ?, collector = ?, owner = ? WHERE id = ?',
        [description, collector, owner, id],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes);
        }
      );
    });
  }
  
  // Label操作
  static addLabel(metricId, name, valueType, valueRange, description, example = '', collectionNote = '') {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO labels (metric_id, name, value_type, value_range, description, example, collection_note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [metricId, name, valueType, valueRange, description, example, collectionNote],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.lastID);
        }
      );
    });
  }
  
  static getLabelsByMetricId(metricId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM labels WHERE metric_id = ?',
        [metricId],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows);
        }
      );
    });
  }
  
  static updateLabel(id, valueType, valueRange, description, example = '', collectionNote = '') {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE labels SET value_type = ?, value_range = ?, description = ?, example = ?, collection_note = ? WHERE id = ?',
        [valueType, valueRange, description, example, collectionNote, id],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes);
        }
      );
    });
  }
  
  static deleteLabel(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM labels WHERE id = ?',
        [id],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes);
        }
      );
    });
  }
}

module.exports = Database;