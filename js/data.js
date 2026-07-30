/**
 * 茶蛋er点评 · 美食地图 - 数据管理模块 (GitHub Pages 纯静态版)
 * 数据从 GitHub raw 文件读取，通过编辑仓库中的 data_*.json 更新
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

// 数据管理（GitHub raw 文件读取）
const Store = {
  data: { persons: {}, spots: [], lastModified: 0 },
  currentCity: 'guangzhou',
  _onUpdate: null,

  // 从 GitHub raw 加载数据
  async load() {
    try {
      const url = `${RAW_URL}/data_${this.currentCity}.json?t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) {
          console.warn(`data_${this.currentCity}.json not found on GitHub, using empty data`);
          this.data = { persons: {}, spots: [], lastModified: 0 };
          return this.data;
        }
        throw new Error('HTTP ' + res.status);
      }
      this.data = await res.json();
      return this.data;
    } catch (e) {
      console.error('加载数据失败:', e);
      // 回退到空数据
      this.data = { persons: {}, spots: [], lastModified: 0 };
      return this.data;
    }
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

  // 手动刷新数据（GitHub Pages 模式）
  async refresh() {
    return await this.load();
  },
};

// 向后兼容：导出到全局
try { window.Store = Store; } catch(e) {}
