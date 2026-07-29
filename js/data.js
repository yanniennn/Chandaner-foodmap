/**
 * 茶蛋点评 · 美食地图 - 数据管理模块 (多城市版)
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

// API 基址
const API_BASE = '';

// 数据管理（API 驱动 + 多城市，localStorage 兜底）
const Store = {
  data: { persons: {}, spots: [], lastModified: 0 },
  currentCity: 'guangzhou',
  _pollTimer: null,
  _lastModified: 0,
  _onUpdate: null,
  _useLocal: false, // true = localStorage 模式（无后端时自动启用）

  _localKey() { return 'chadan_' + this.currentCity; },

  _localLoad() {
    const raw = localStorage.getItem(this._localKey());
    if (raw) { this.data = JSON.parse(raw); this._lastModified = this.data.lastModified || 0; }
    else { this.data = { persons: {}, spots: [], lastModified: 0 }; }
    return this.data;
  },

  _localSave() {
    this.data.lastModified = Date.now() / 1000;
    localStorage.setItem(this._localKey(), JSON.stringify(this.data));
  },

  // 从服务器加载数据
  async load() {
    if (this._useLocal) return this._localLoad();
    try {
      const res = await fetch(API_BASE + '/api/data?city=' + this.currentCity);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      this.data = await res.json();
      this._lastModified = this.data.lastModified || 0;
      return this.data;
    } catch (e) {
      console.warn('Server unavailable, switching to localStorage mode');
      this._useLocal = true;
      return this._localLoad();
    }
  },

  // 切换城市
  async switchCity(city) {
    if (!CITY_CONFIGS[city]) return;
    this.currentCity = city;
    this._lastModified = 0;
    await this.load();
    return this.data;
  },
  async add(entry) {
    if (this._useLocal) {
      // localStorage 模式：本地处理
      const data = this.data;
      const name = (entry.name || '').trim();
      const person = (entry.person || '').trim();
      if (!name) throw new Error('餐厅名称不能为空');
      if (!person) throw new Error('推荐人不能为空');
      // 分配颜色
      if (!data.persons[person]) {
        const colors = ['#E74C3C','#3498DB','#2ECC71','#9B59B6','#F39C12','#1ABC9C','#E91E63','#795548','#607D8B','#FF5722','#00BCD4','#8BC34A'];
        const used = new Set(Object.values(data.persons));
        data.persons[person] = colors.find(c => !used.has(c)) || colors[Object.keys(data.persons).length % colors.length];
      }
      // 解析菜品
      let dishes = entry.dishes || '';
      if (typeof dishes === 'string') {
        for (const sep of [',','，','、','\n']) dishes = dishes.replace(sep,'\x00');
        dishes = dishes.split('\x00').map(d => d.trim()).filter(Boolean);
      }
      const rec = { person, dishes, review: entry.review||'', rating: 5, price: parseInt(entry.price)||0, date: new Date().toISOString().split('T')[0] };
      const existing = data.spots.find(s => s.name === name);
      let result;
      if (existing) { existing.recommendations.push(rec); result = { status:'ok', action:'added_rec', spot:existing }; }
      else {
        const id = Math.max(0, ...data.spots.map(s=>s.id)) + 1;
        const spot = { id, name, address: entry.address||'', lat: entry.lat||0, lng: entry.lng||0, category: entry.category||'其他', recommendations:[rec], wantToGo:[] };
        data.spots.push(spot); result = { status:'ok', action:'added_spot', spot };
      }
      this._localSave();
      return result;
    }
    entry.city = this.currentCity;
    const res = await fetch(API_BASE + '/api/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const result = await res.json();
    if (!res.ok || result.status === 'error') {
      throw new Error(result.message || '提交失败');
    }
    await this.load();
    return result;
  },

  // 加载示例数据
  async loadSample() {
    const res = await fetch(API_BASE + '/api/sample?city=' + this.currentCity, { method: 'POST' });
    const result = await res.json();
    if (!res.ok || result.status === 'error') {
      throw new Error(result.message || '加载示例失败');
    }
    await this.load();
    return result;
  },

  // 切换"想去"状态
  async toggleWantToGo(spotId, name) {
    if (this._useLocal) {
      const spot = this.data.spots.find(s => s.id === spotId);
      if (!spot) throw new Error('找不到该餐厅');
      if (!spot.wantToGo) spot.wantToGo = [];
      if (spot.wantToGo.includes(name)) { spot.wantToGo.remove(name); this._localSave(); return { action:'removed', wantToGo:spot.wantToGo }; }
      spot.wantToGo.push(name); this._localSave(); return { action:'added', wantToGo:spot.wantToGo };
    }
    const res = await fetch(API_BASE + '/api/want-to-go', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: this.currentCity, spotId, name }),
    });
    const result = await res.json();
    if (!res.ok || result.status === 'error') {
      throw new Error(result.message || '操作失败');
    }
    await this.load();
    return result;
  },

  // 重置数据
  async reset() {
    if (this._useLocal) { localStorage.removeItem(this._localKey()); this.data = { persons:{}, spots:[], lastModified:0 }; return; }
    const res = await fetch(API_BASE + '/api/reset?city=' + this.currentCity, { method: 'POST' });
    await res.json();
    await this.load();
  },

  // 导入数据
  async importData(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.spots) throw new Error('数据格式不正确');
    parsed.city = this.currentCity;
    const res = await fetch(API_BASE + '/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    });
    const result = await res.json();
    if (!res.ok || result.status === 'error') {
      throw new Error(result.message || '导入失败');
    }
    await this.load();
  },

  // 导出数据
  exportData() {
    return JSON.stringify(this.data, null, 2);
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

  // 开始轮询（实时更新）
  startPolling(callback) {
    this._onUpdate = callback;
    this._pollTimer = setInterval(() => this._poll(), 3000);
  },

  // 停止轮询
  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  // 轮询检查
  async _poll() {
    if (this._useLocal) return; // 本地模式不需要轮询
    try {
      const res = await fetch(API_BASE + '/api/data?city=' + this.currentCity);
      if (!res.ok) return;
      const newData = await res.json();
      const newModified = newData.lastModified || 0;
      if (newModified > this._lastModified) {
        const oldSpotIds = new Set(this.data.spots.map(s => s.id));
        const newSpotIds = newData.spots.map(s => s.id);
        this.data = newData;
        this._lastModified = newModified;
        const addedIds = newSpotIds.filter(id => !oldSpotIds.has(id));
        if (this._onUpdate) this._onUpdate(addedIds);
      }
    } catch (e) {
      // 静默失败，下次重试
    }
  },
};
