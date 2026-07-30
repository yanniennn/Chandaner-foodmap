/**
 * 茶蛋er点评 · 美食地图 - 数据管理模块 (GitHub Pages 纯静态版)
 * 数据从 GitHub raw 文件读取 + localStorage 本地增量
 */

// ---- WGS84 ↔ GCJ02 坐标转换 ----
const PI = Math.PI;
const GCJ_A = 6378245.0;
const GCJ_EE = 0.00669342162296594323;

function _outOfChina(lng, lat) {
  return (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271);
}

function _transformLat(x, y) {
  let r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  r += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  r += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return r;
}

function _transformLng(x, y) {
  let r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  r += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  r += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return r;
}

// WGS84 → GCJ02（存储用 WGS84，显示用 GCJ02）
function wgs84ToGcj02(lng, lat) {
  if (_outOfChina(lng, lat)) return { lng, lat };
  let dLat = _transformLat(lng - 105.0, lat - 35.0);
  let dLng = _transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (GCJ_A / sqrtMagic * Math.cos(radLat) * PI);
  return { lng: lng + dLng, lat: lat + dLat };
}

// GCJ02 → WGS84（地图点击得到 GCJ02，转回 WGS84 存储）
function gcj02ToWgs84(lng, lat) {
  if (_outOfChina(lng, lat)) return { lng, lat };
  let dLat = _transformLat(lng - 105.0, lat - 35.0);
  let dLng = _transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (GCJ_A / sqrtMagic * Math.cos(radLat) * PI);
  return { lng: lng - dLng, lat: lat - dLat };
}

// 分类配置
const CATEGORIES = {
  '早茶': '#E91E63',
  '粤菜': '#E74C3C',
  '甜品': '#9C27B0',
  '小吃': '#FF9800',
  '火锅': '#FF5722',
  '烧烤': '#795548',
  '海鲜': '#00BCD4',
  '面食': '#8BC34A',
  '其他': '#607D8B',
};

// 城市配置
const CITY_CONFIGS = {
  guangzhou: { name: '广州', center: [23.1291, 113.2644], zoom: 12 },
  shenzhen:   { name: '深圳', center: [22.5431, 114.0579], zoom: 12 },
  foshan:     { name: '佛山', center: [23.0218, 113.1219], zoom: 12 },
};

// GitHub 数据配置
const GITHUB_USER = 'yanniennn';
const GITHUB_REPO = 'Chandaner-foodmap';
const GITHUB_BRANCH = 'main';
const RAW_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;

// 颜色池
const COLOR_POOL = ['#E91E63','#9C27B0','#673AB7','#3F51B5','#2196F3','#009688','#4CAF50','#8BC34A','#CDDC39','#FF9800','#FF5722','#795548'];

// 数据管理（GitHub raw + localStorage 增量）
const Store = {
  data: { persons: {}, spots: [], lastModified: 0 },
  _githubData: { persons: {}, spots: [], lastModified: 0 },
  _localData: { persons: {}, spots: [], lastModified: 0 },
  currentCity: 'guangzhou',

  // 从 GitHub raw 加载数据 + localStorage 增量
  async load() {
    // 加载 GitHub 数据
    try {
      const url = `${RAW_URL}/data_${this.currentCity}.json?t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        this._githubData = await res.json();
      } else if (res.status === 404) {
        this._githubData = { persons: {}, spots: [], lastModified: 0 };
      } else {
        console.warn('GitHub data load failed:', res.status);
        this._githubData = { persons: {}, spots: [], lastModified: 0 };
      }
    } catch (e) {
      console.error('加载 GitHub 数据失败:', e);
      this._githubData = { persons: {}, spots: [], lastModified: 0 };
    }

    // 加载本地增量数据
    try {
      const raw = localStorage.getItem(`chandaner_local_${this.currentCity}`);
      this._localData = raw ? JSON.parse(raw) : { persons: {}, spots: [], lastModified: 0 };
    } catch (e) {
      this._localData = { persons: {}, spots: [], lastModified: 0 };
    }

    this._rebuildData();
    return this.data;
  },

  // 合并 GitHub 数据和本地增量
  _rebuildData() {
    const persons = { ...(this._githubData.persons || {}), ...(this._localData.persons || {}) };
    const spots = JSON.parse(JSON.stringify(this._githubData.spots || []));
    const githubNames = new Set(spots.map(s => s.name));

    (this._localData.spots || []).forEach(ls => {
      if (githubNames.has(ls.name)) {
        // 合并到已有店铺
        const gs = spots.find(s => s.name === ls.name);
        if (gs) {
          // 合并推荐
          const recNames = new Set(gs.recommendations.map(r => r.person));
          (ls.recommendations || []).forEach(r => {
            if (!recNames.has(r.person)) {
              gs.recommendations.push(r);
              recNames.add(r.person);
            }
          });
          if (ls.address && (!gs.address || gs.address === '地址未填写')) gs.address = ls.address;
          if (ls.lat && ls.lng) {
            gs.lat = ls.lat;
            gs.lng = ls.lng;
          }
        }
      } else {
        spots.push(ls);
      }
    });

    this.data = { persons, spots, lastModified: Date.now() };
  },

  // 添加本地店铺/推荐
  addLocalSpot(spotData) {
    // 更新本地增量数据
    const existing = this._localData.spots.find(s => s.name === spotData.name);
    if (existing) {
      existing.recommendations.push(...spotData.recommendations);
      if (spotData.address) existing.address = spotData.address;
      if (spotData.lat != null && spotData.lng != null) {
        existing.lat = spotData.lat;
        existing.lng = spotData.lng;
      }
      if (spotData.category) existing.category = spotData.category;
    } else {
      this._localData.spots.push(spotData);
    }

    // 为新推荐人分配颜色
    const allPersons = { ...(this._githubData.persons || {}), ...(this._localData.persons || {}) };
    spotData.recommendations.forEach(rec => {
      if (!allPersons[rec.person]) {
        const used = Object.values(allPersons);
        const color = COLOR_POOL.find(c => !used.includes(c)) || COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
        this._localData.persons[rec.person] = color;
        allPersons[rec.person] = color;
      }
    });

    this._localData.lastModified = Date.now();
    try {
      localStorage.setItem(`chandaner_local_${this.currentCity}`, JSON.stringify(this._localData));
    } catch (e) {
      console.error('保存本地数据失败:', e);
    }

    this._rebuildData();
  },

  // 切换城市
  async switchCity(city) {
    if (!CITY_CONFIGS[city]) return;
    this.currentCity = city;
    await this.load();
    return this.data;
  },

  // 获取推荐人颜色
  getPersonColor(person) {
    return this.data.persons[person] || '#999';
  },

  // 获取所有推荐人
  getAllPersons() {
    return this.data.persons;
  },

  // 按名称查找已有店
  findSpotByName(name) {
    const lower = name.toLowerCase();
    return this.data.spots.find(s =>
      s.name.toLowerCase().includes(lower) ||
      lower.includes(s.name.toLowerCase())
    );
  },

  // 手动刷新数据
  async refresh() {
    return await this.load();
  },

  // 导出合并后的完整数据（JSON 字符串）
  exportData() {
    return JSON.stringify(this.data, null, 2);
  },

  _saveLocal() {
    this._localData.lastModified = Date.now();
    try {
      localStorage.setItem(`chandaner_local_${this.currentCity}`, JSON.stringify(this._localData));
    } catch (e) {
      console.error('保存本地数据失败:', e);
    }
  },
  clearLocalData() {
    this._localData = { persons: {}, spots: [], lastModified: 0 };
    try {
      localStorage.removeItem(`chandaner_local_${this.currentCity}`);
    } catch (e) {}
    this._rebuildData();
  },
};

// 向后兼容：导出到全局
try { window.Store = Store; } catch(e) {}
