/**
 * 茶蛋点评 · 广州美食地图 - 核心逻辑 (Phase 2: API + 实时轮询)
 */
(function () {
  'use strict';

  // ---- 状态 ----
  let map;
  let markers = {};
  let pickLocationMode = false;
  let tempMarker = null;
  let tempLatLng = null;
  let isSubmitting = false;

  // 广州中心坐标
  const GZ_CENTER = [23.1291, 113.2644];
  const GZ_ZOOM = 12;

  // ---- 吃饭 Logo（品牌主标识）----
  function eatingLogoSVG(size) {
    const uid = 'elogo' + size;
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 3px rgba(139,111,71,0.3));">
        <defs>
          <radialGradient id="${uid}b" cx="50%" cy="30%">
            <stop offset="0%" stop-color="#FF8A65"/>
            <stop offset="60%" stop-color="#FF5722"/>
            <stop offset="100%" stop-color="#D84315"/>
          </radialGradient>
          <linearGradient id="${uid}s" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#FFCC80" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#FFCC80" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <!-- 蒸汽 -->
        <path d="M 38 18 Q 34 26 40 30 Q 34 34 40 38" fill="none" stroke="#FFCC80" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
        <path d="M 50 14 Q 46 22 52 26 Q 46 30 52 34" fill="none" stroke="#FFCC80" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
        <path d="M 62 18 Q 58 26 64 30 Q 58 34 64 38" fill="none" stroke="#FFCC80" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
        <!-- 碗 -->
        <path d="M 20 48 Q 20 78 50 82 Q 80 78 80 48 Z" fill="url(#${uid}b)" stroke="#BF360C" stroke-width="1.5"/>
        <ellipse cx="50" cy="48" rx="30" ry="7" fill="#FFCC80" stroke="#BF360C" stroke-width="1.2"/>
        <!-- 食物（碗内） -->
        <ellipse cx="50" cy="46" rx="24" ry="5" fill="#FFD54F" opacity="0.9"/>
        <circle cx="42" cy="45" r="3" fill="#FF8A65" opacity="0.8"/>
        <circle cx="55" cy="46" r="2.5" fill="#66BB6A" opacity="0.8"/>
        <circle cx="60" cy="44" r="2" fill="#FF8A65" opacity="0.8"/>
        <!-- 筷子 -->
        <line x1="68" y1="20" x2="88" y2="62" stroke="#8D6E63" stroke-width="3" stroke-linecap="round"/>
        <line x1="74" y1="20" x2="92" y2="58" stroke="#A1887F" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    `;
  }

  // ---- 可爱小狮子 SVG（佛山专用）----
  function lionDanceSVG(size, names) {
    const cx = 50, cy = 52;
    const count = Array.isArray(names) ? names.length : 0;
    const uid = 'lion' + size + 'x' + count;

    // 中心文字
    let centerText, fontSize;
    if (count === 0) { centerText = '\u{1F981}'; fontSize = 14; }
    else if (count === 1) { centerText = escapeHtml(String(names[0]).slice(0, 2)); fontSize = 10; }
    else if (count === 2) { centerText = escapeHtml(names.map(n => String(n)[0]).join('')); fontSize = 9; }
    else if (count === 3) { centerText = escapeHtml(names.map(n => String(n)[0]).join('')); fontSize = 8; }
    else { centerText = escapeHtml(names.slice(0, 3).map(n => String(n)[0]).join('')) + '+' + (count - 3); fontSize = 7; }

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/200/svg" style="filter: drop-shadow(0 3px 4px rgba(180,83,9,0.3));">
        <defs>
          <radialGradient id="${uid}m" cx="50%" cy="35%">
            <stop offset="0%" stop-color="#FFD54F"/>
            <stop offset="60%" stop-color="#FFA726"/>
            <stop offset="100%" stop-color="#EF6C00"/>
          </radialGradient>
          <radialGradient id="${uid}f" cx="50%" cy="40%">
            <stop offset="0%" stop-color="#FFE0B2"/>
            <stop offset="80%" stop-color="#FFCC80"/>
            <stop offset="100%" stop-color="#FFB74D"/>
          </radialGradient>
          <radialGradient id="${uid}c" cx="50%" cy="50%">
            <stop offset="0%" stop-color="#FFEB3B"/>
            <stop offset="100%" stop-color="#F9A825"/>
          </radialGradient>
        </defs>
        <!-- 鬃毛外圈（蓬松圆刺） -->
        ${(() => {
          let mane = '';
          const n = 16;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const r1 = 34, r2 = 40;
            const x1 = cx + r1 * Math.cos(a), y1 = cy + r1 * Math.sin(a);
            const r3 = 43 + (i % 2 === 0 ? 3 : 0);
            const x2 = cx + r3 * Math.cos(a + 0.18), y2 = cy + r3 * Math.sin(a + 0.18);
            mane += `<polygon points="${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}" fill="url(#${uid}m)" opacity="0.75"/>`;
          }
          return mane;
        })()}
        <!-- 小圆耳朵 -->
        <circle cx="${cx-26}" cy="${cy-24}" r="8" fill="url(#${uid}m)" stroke="#E65100" stroke-width="0.8"/>
        <circle cx="${cx+26}" cy="${cy-24}" r="8" fill="url(#${uid}m)" stroke="#E65100" stroke-width="0.8"/>
        <circle cx="${cx-26}" cy="${cy-24}" r="4" fill="#FFCC80" opacity="0.8"/>
        <circle cx="${cx+26}" cy="${cy-24}" r="4" fill="#FFCC80" opacity="0.8"/>
        <!-- 脸（圆润） -->
        <ellipse cx="${cx}" cy="${cy}" rx="30" ry="29" fill="url(#${uid}f)" stroke="#E65100" stroke-width="1.2"/>
        <!-- 腮红 -->
        <ellipse cx="${cx-18}" cy="${cy+10}" rx="6" ry="4" fill="#FF8A80" opacity="0.55"/>
        <ellipse cx="${cx+18}" cy="${cy+10}" rx="6" ry="4" fill="#FF8A80" opacity="0.55"/>
        <!-- 大眼睛 -->
        <ellipse cx="${cx-11}" cy="${cy-5}" rx="7" ry="8" fill="#fff" stroke="#5D4037" stroke-width="0.8"/>
        <ellipse cx="${cx+11}" cy="${cy-5}" rx="7" ry="8" fill="#fff" stroke="#5D4037" stroke-width="0.8"/>
        <circle cx="${cx-10}" cy="${cy-4}" r="4" fill="#3E2723"/>
        <circle cx="${cx+12}" cy="${cy-4}" r="4" fill="#3E2723"/>
        <circle cx="${cx-8}" cy="${cy-6}" r="1.5" fill="#fff"/>
        <circle cx="${cx+14}" cy="${cy-6}" r="1.5" fill="#fff"/>
        <!-- 小鼻子（粉色三角形） -->
        <path d="M ${cx-4} ${cy+5} L ${cx+4} ${cy+5} L ${cx} ${cy+9} Z" fill="#FF8A80" stroke="#E65100" stroke-width="0.5"/>
        <!-- 嘴巴（微笑曲线） -->
        <path d="M ${cx} ${cy+9} L ${cx} ${cy+13}" stroke="#5D4037" stroke-width="1.2" stroke-linecap="round" fill="none"/>
        <path d="M ${cx-7} ${cy+13} Q ${cx} ${cy+18} ${cx+7} ${cy+13}" fill="none" stroke="#5D4037" stroke-width="1.8" stroke-linecap="round"/>
        <!-- 中心文字 -->
        <circle cx="${cx}" cy="${cy-22}" r="8" fill="url(#${uid}c)" opacity="0.9"/>
        <text x="${cx}" y="${cy-19}" text-anchor="middle" font-size="${fontSize}" font-weight="800" fill="#fff" class="kapok-text" style="paint-order: stroke; stroke: #E65100; stroke-width: 0.4;">${centerText}</text>
      </svg>
    `;
  }

  // ---- 小牛 SVG（深圳专用）----
  function calfSVG(size, names) {
    const cx = 50, cy = 50;
    const count = Array.isArray(names) ? names.length : 0;
    const uid = 'calf' + size + 'x' + count;

    // 中心文字
    let centerText, fontSize;
    if (count === 0) { centerText = '\u{1F42E}'; fontSize = 14; }
    else if (count === 1) { centerText = escapeHtml(String(names[0]).slice(0, 2)); fontSize = 10; }
    else if (count === 2) { centerText = escapeHtml(names.map(n => String(n)[0]).join('')); fontSize = 10; }
    else if (count === 3) { centerText = escapeHtml(names.map(n => String(n)[0]).join('')); fontSize = 8; }
    else { centerText = escapeHtml(names.slice(0, 3).map(n => String(n)[0]).join('')) + '+' + (count - 3); fontSize = 7; }

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 4px rgba(0,100,0,0.3));">
        <defs>
          <radialGradient id="${uid}g" cx="50%" cy="35%">
            <stop offset="0%" stop-color="#81C784"/>
            <stop offset="65%" stop-color="#4CAF50"/>
            <stop offset="100%" stop-color="#2E7D32"/>
          </radialGradient>
          <radialGradient id="${uid}c" cx="50%" cy="50%">
            <stop offset="0%" stop-color="#FFD54F"/>
            <stop offset="100%" stop-color="#FF8F00"/>
          </radialGradient>
          <radialGradient id="${uid}s" cx="50%" cy="30%">
            <stop offset="0%" stop-color="#FFF9C4"/>
            <stop offset="100%" stop-color="#FDD835"/>
          </radialGradient>
        </defs>
        <!-- 耳朵 -->
        <ellipse cx="${cx-28}" cy="${cy-18}" rx="10" ry="14" fill="url(#${uid}g)" stroke="#1B5E20" stroke-width="1" transform="rotate(-30 ${cx-28} ${cy-18})" opacity="0.9"/>
        <ellipse cx="${cx+28}" cy="${cy-18}" rx="10" ry="14" fill="url(#${uid}g)" stroke="#1B5E20" stroke-width="1" transform="rotate(30 ${cx+28} ${cy-18})" opacity="0.9"/>
        <!-- 小犄角 -->
        <path d="M ${cx-14} ${cy-28} Q ${cx-18} ${cy-38} ${cx-12} ${cy-40} Q ${cx-8} ${cy-36} ${cx-10} ${cy-28} Z" fill="#8D6E63" stroke="#5D4037" stroke-width="0.8"/>
        <path d="M ${cx+14} ${cy-28} Q ${cx+18} ${cy-38} ${cx+12} ${cy-40} Q ${cx+8} ${cy-36} ${cx+10} ${cy-28} Z" fill="#8D6E63" stroke="#5D4037" stroke-width="0.8"/>
        <!-- 头部 -->
        <ellipse cx="${cx}" cy="${cy}" rx="30" ry="28" fill="url(#${uid}g)" stroke="#1B5E20" stroke-width="1.2"/>
        <!-- 鼻吻部 -->
        <ellipse cx="${cx}" cy="${cy+14}" rx="16" ry="12" fill="url(#${uid}s)" stroke="#F9A825" stroke-width="0.8" opacity="0.95"/>
        <!-- 鼻孔 -->
        <ellipse cx="${cx-5}" cy="${cy+14}" rx="2" ry="3" fill="#5D4037" opacity="0.6"/>
        <ellipse cx="${cx+5}" cy="${cy+14}" rx="2" ry="3" fill="#5D4037" opacity="0.6"/>
        <!-- 眼睛 -->
        <ellipse cx="${cx-11}" cy="${cy-4}" rx="6" ry="7" fill="#fff" stroke="#1B5E20" stroke-width="0.8"/>
        <ellipse cx="${cx+11}" cy="${cy-4}" rx="6" ry="7" fill="#fff" stroke="#1B5E20" stroke-width="0.8"/>
        <circle cx="${cx-10}" cy="${cy-3}" r="3" fill="#1a1a1a"/>
        <circle cx="${cx+12}" cy="${cy-3}" r="3" fill="#1a1a1a"/>
        <circle cx="${cx-9}" cy="${cy-4}" r="1" fill="#fff"/>
        <circle cx="${cx+13}" cy="${cy-4}" r="1" fill="#fff"/>
        <!-- 中心文字（花心） -->
        <circle cx="${cx}" cy="${cy-12}" r="7" fill="url(#${uid}c)" opacity="0.85"/>
        <text x="${cx}" y="${cy-9}" text-anchor="middle" font-size="${fontSize}" font-weight="800" fill="#fff" class="kapok-text" style="paint-order: stroke; stroke: #1B5E20; stroke-width: 0.4;">${centerText}</text>
      </svg>
    `;
  }

  // 根据当前城市选择标记 SVG
  function markerSVG(size, names) {
    if (Store.currentCity === 'foshan') {
      return lionDanceSVG(size, names);
    }
    if (Store.currentCity === 'shenzhen') {
      return calfSVG(size, names);
    }
    return kapokSVG(size, names);
  }

  // ---- 木棉花 SVG ----
  function kapokSVG(size, names) {
    // names: 推荐人名字数组（空数组=logo）
    const cx = 50, cy = 50;
    const petalRx = 15, petalRy = 26;
    const colors = ['#FF6B6B', '#E74C3C', '#C0392B'];
    const centerColors = ['#FFD93D', '#F39C12'];
    const count = Array.isArray(names) ? names.length : 0;
    const uid = 'k' + size + 'x' + count;

    let petals = '';
    for (let i = 0; i < 5; i++) {
      const angle = i * 72;
      petals += `<ellipse cx="${cx}" cy="${cy - 24}" rx="${petalRx}" ry="${petalRy}" fill="url(#${uid}g)" transform="rotate(${angle} ${cx} ${cy})" opacity="0.92"/>`;
    }

    // 花心文字：显示推荐人名字缩写
    let centerText, fontSize;
    if (count === 0) {
      centerText = '\u{1F33C}';
      fontSize = 14;
    } else if (count === 1) {
      centerText = escapeHtml(String(names[0]).slice(0, 2));
      fontSize = 10;
    } else if (count === 2) {
      centerText = escapeHtml(names.map(n => String(n)[0]).join(''));
      fontSize = 10;
    } else if (count === 3) {
      centerText = escapeHtml(names.map(n => String(n)[0]).join(''));
      fontSize = 8;
    } else {
      const initials = names.slice(0, 3).map(n => String(n)[0]).join('');
      centerText = escapeHtml(initials) + '+' + (count - 3);
      fontSize = 7;
    }

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 4px rgba(139,111,71,0.35));">
        <defs>
          <radialGradient id="${uid}g" cx="50%" cy="35%">
            <stop offset="0%" stop-color="${colors[0]}"/>
            <stop offset="60%" stop-color="${colors[1]}"/>
            <stop offset="100%" stop-color="${colors[2]}"/>
          </radialGradient>
          <radialGradient id="${uid}c" cx="50%" cy="50%">
            <stop offset="0%" stop-color="${centerColors[0]}"/>
            <stop offset="100%" stop-color="${centerColors[1]}"/>
          </radialGradient>
        </defs>
        ${petals}
        <circle cx="${cx}" cy="${cy}" r="13" fill="url(#${uid}c)"/>
        <circle cx="${cx}" cy="${cy}" r="13" fill="none" stroke="${colors[2]}" stroke-width="1" opacity="0.3"/>
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="${fontSize}" font-weight="800" fill="#fff" class="kapok-text">${centerText}</text>
      </svg>
    `;
  }

  // 根据推荐人数计算标记大小
  function markerSize(count) {
    if (count <= 1) return 36;
    if (count <= 2) return 42;
    if (count <= 3) return 50;
    if (count <= 5) return 58;
    return 66;
  }

  // ---- 地图初始化 ----
  function initMap() {
    // 广州中心坐标（WGS84 → GCJ02 用于高德瓦片显示）
    const gcj = wgs84ToGcj02(GZ_CENTER[1], GZ_CENTER[0]);
    map = L.map('map', {
      center: [gcj.lat, gcj.lng],
      zoom: GZ_ZOOM,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // 高德地图瓦片（中文标注，GCJ02 坐标系）
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
      attribution: '&copy; 高德地图',
    }).addTo(map);

    // 地图点击
    map.on('click', onMapClick);
  }

  // ---- 渲染标记 ----
  function renderMarkers(filterText, newSpotIds) {
    // 清除旧标记
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};

    const data = Store.data;
    const filter = (filterText || '').toLowerCase().trim();
    const newSet = new Set(newSpotIds || []);

    data.spots.forEach(spot => {
      // 过滤
      if (filter) {
        const matchName = spot.name.toLowerCase().includes(filter);
        const matchAddr = (spot.address || '').toLowerCase().includes(filter);
        const matchCat = (spot.category || '').toLowerCase().includes(filter);
        const matchPerson = spot.recommendations.some(r => r.person.toLowerCase().includes(filter));
        const matchDish = spot.recommendations.some(r =>
          r.dishes.some(d => d.toLowerCase().includes(filter))
        );
        if (!matchName && !matchAddr && !matchCat && !matchPerson && !matchDish) return;
      }

      const count = spot.recommendations.length;
      const size = markerSize(count);
      const recNames = spot.recommendations.map(r => r.person);
      const icon = L.divIcon({
        className: 'kapok-marker' + (newSet.has(spot.id) ? ' marker-new' : ''),
        html: markerSVG(size, recNames),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2 - 4],
      });

      // WGS84 → GCJ02 用于高德瓦片显示
      const gcj = wgs84ToGcj02(spot.lng, spot.lat);
      const marker = L.marker([gcj.lat, gcj.lng], { icon });
      marker.bindPopup(createMiniPopup(spot), { closeButton: false, offset: [0, -4] });
      marker.on('click', () => showSidebar(spot.id));
      marker.addTo(map);
      markers[spot.id] = marker;
    });
  }

  // ---- 小弹窗 ----
  function createMiniPopup(spot) {
    const count = spot.recommendations.length;
    const avgPrice = avgPriceOf(spot);
    const catColor = (CATEGORIES && CATEGORIES[spot.category]) || '#607D8B';
    const personNames = spot.recommendations.map(r => escapeHtml(r.person)).join('、');
    const priceStr = avgPrice > 0 ? ' &middot; \u00A5' + Math.round(avgPrice) + '/人' : '';
    const wantCount = (spot.wantToGo || []).length;
    const wantStr = wantCount > 0
      ? `<div class="mini-popup-want">\u{1F3AF} ${wantCount}\u4EBA\u60F3\u53BB</div>`
      : '';
    return `
      <div class="mini-popup">
        <div class="mini-popup-name">${escapeHtml(spot.name)}</div>
        <div class="mini-popup-meta">
          <span style="color:${catColor};font-weight:600">${escapeHtml(spot.category)}</span>
          ${priceStr}
        </div>
        <div class="mini-popup-persons">${personNames}\u63A8\u8350</div>
        ${wantStr}
        <button class="mini-popup-btn" onclick="window.__showDetail(${spot.id})">\u67E5\u770B\u8BE6\u60C5</button>
      </div>
    `;
  }

  // 暴露给 popup 内 onclick
  window.__showDetail = function (id) {
    map.closePopup();
    showSidebar(id);
  };

  // ---- 侧边栏详情 ----
  let currentSpotId = null;

  function showSidebar(spotId) {
    const spot = Store.data.spots.find(s => s.id === spotId);
    if (!spot) return;
    currentSpotId = spotId;

    const body = document.getElementById('sidebarBody');
    const count = spot.recommendations.length;
    const avgPrice = avgPriceOf(spot);
    const catColor = (CATEGORIES && CATEGORIES[spot.category]) || '#607D8B';
    const persons = Store.getAllPersons();
    const personNames = spot.recommendations.map(r => escapeHtml(r.person)).join('、');

    // 想去数据
    const wantList = spot.wantToGo || [];
    const wantCount = wantList.length;
    const wantBadges = wantList.map(name => {
      const color = persons[name] || '#999';
      return `<span class="want-to-go-badge" style="background:${color}">${escapeHtml(name)}</span>`;
    }).join('');
    const currentUserName = document.getElementById('fPerson')?.value?.trim() || '';
    const isWanting = currentUserName && wantList.includes(currentUserName);

    let html = `
      <div class="spot-detail-name">${escapeHtml(spot.name)}</div>
      <div class="spot-detail-meta">
        <span class="meta-chip category" style="background:${catColor}">${escapeHtml(spot.category)}</span>
        ${avgPrice > 0 ? `<span class="meta-chip price">\u00A5${Math.round(avgPrice)}/人</span>` : ''}
      </div>
      <div class="spot-detail-recommenders">
        <span class="recommenders-label">\u63A8\u8350\u4EBA\uFF1A</span>
        <span class="recommenders-names">${personNames}</span>
      </div>
      <div class="spot-detail-address">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <span>${escapeHtml(spot.address || '地址未填写')}</span>
      </div>
      <div class="want-to-go-section">
        <div class="want-to-go-header">
          <span class="want-to-go-title">\u{1F3AF} \u60F3\u53BB\u8FD9\u91CC</span>
          <span class="want-to-go-count ${wantCount > 0 ? 'has-count' : ''}">${wantCount}\u4EBA</span>
        </div>
        ${wantCount > 0 ? `<div class="want-to-go-names">${wantBadges}</div>` : ''}
        <div class="want-to-go-input-row">
          <input type="text" id="wantToGoName" placeholder="\u4F60\u7684\u540D\u5B57" autocomplete="off" list="personList" value="${escapeHtml(currentUserName)}">
          <button class="btn btn-sm want-to-go-btn ${isWanting ? 'active' : 'btn-primary'}" id="wantToGoBtn">
            ${isWanting ? '\u53D6\u6D88\u60F3\u53BB' : '\u6211\u4E5F\u60F3\u53BB'}
          </button>
        </div>
      </div>
      <div class="detail-section-title">推荐详情</div>
    `;

    spot.recommendations.forEach((rec, idx) => {
      const color = persons[rec.person] || '#999';
      const dishBadges = rec.dishes.map(d =>
        `<span class="dish-badge" style="background:${color}">${escapeHtml(d)}</span>`
      ).join('');
      const priceTag = rec.price > 0 ? `<span class="rec-price">\u00A5${rec.price}/人</span>` : '';

      html += `
        <div class="rec-card" style="border-left-color:${color};animation-delay:${idx * 0.08}s">
          <div class="rec-header">
            <div class="rec-person">
              <span class="person-dot" style="background:${color}"></span>
              <span>${escapeHtml(rec.person)}</span>
            </div>
            <div class="rec-header-right">
              ${priceTag}
            </div>
          </div>
          ${dishBadges ? `<div class="rec-dishes">${dishBadges}</div>` : ''}
          ${rec.review ? `<div class="rec-review">${escapeHtml(rec.review)}</div>` : ''}
          <div class="rec-date">${rec.date || ''}</div>
        </div>
      `;
    });

    // 添加推荐按钮
    html += `
      <button class="btn btn-outline" style="width:100%;justify-content:center;margin-top:8px" onclick="window.__addRecToSpot(${spot.id})">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        添加我的推荐
      </button>
    `;

    body.innerHTML = html;
    document.getElementById('sidebar').classList.add('show');

    // 想去按钮事件
    const wantBtn = document.getElementById('wantToGoBtn');
    const wantInput = document.getElementById('wantToGoName');
    if (wantBtn && wantInput) {
      wantBtn.addEventListener('click', () => handleToggleWantToGo(spot.id));
      wantInput.addEventListener('input', () => updateWantToGoBtnState(spot.id));
      wantInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleToggleWantToGo(spot.id); }
      });
    }
  }

  // 切换"想去"状态
  async function handleToggleWantToGo(spotId) {
    const input = document.getElementById('wantToGoName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) { showToast('\u8BF7\u8F93\u5165\u4F60\u7684\u540D\u5B57', 'error'); input.focus(); return; }
    const btn = document.getElementById('wantToGoBtn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    try {
      const result = await Store.toggleWantToGo(spotId, name);
      const spot = Store.data.spots.find(s => s.id === spotId);
      if (spot) {
        showSidebar(spotId);
        renderMarkers(document.getElementById('searchInput').value);
        renderLegend();
        updatePersonList();
      }
      showToast(result.action === 'added' ? '\u5DF2\u52A0\u5165\u60F3\u53BB\u540D\u5355' : '\u5DF2\u53D6\u6D88\u60F3\u53BB', 'success');
    } catch (e) {
      showToast(e.message || '\u64CD\u4F5C\u5931\u8D25', 'error');
    } finally {
      if (btn) { btn.disabled = false; }
    }
  }

  // 更新想去按钮状态（根据输入的名字是否已在列表中）
  function updateWantToGoBtnState(spotId) {
    const spot = Store.data.spots.find(s => s.id === spotId);
    if (!spot) return;
    const input = document.getElementById('wantToGoName');
    const btn = document.getElementById('wantToGoBtn');
    if (!input || !btn) return;
    const name = input.value.trim();
    const wantList = spot.wantToGo || [];
    const isWanting = name && wantList.includes(name);
    btn.textContent = isWanting ? '\u53D6\u6D88\u60F3\u53BB' : '\u6211\u4E5F\u60F3\u53BB';
    btn.classList.toggle('active', isWanting);
    btn.classList.toggle('btn-primary', !isWanting);
  }

  window.__addRecToSpot = function (id) {
    const spot = Store.data.spots.find(s => s.id === id);
    if (!spot) return;
    // 填充左侧表单
    document.getElementById('fName').value = spot.name;
    document.getElementById('fName').readOnly = true;
    document.getElementById('fName').style.opacity = '0.6';
    document.getElementById('fAddress').value = spot.address || '';
    document.getElementById('fCategory').value = spot.category || '粤菜';
    document.getElementById('fPerson').value = '';
    document.getElementById('fDishes').value = '';
    document.getElementById('fReview').value = '';
    document.getElementById('fPrice').value = '';
    document.getElementById('nameHint').textContent = '';
    tempLatLng = { lat: spot.lat, lng: spot.lng };
    updateLocationDisplay();
    // 关闭侧边栏，聚焦表单
    document.getElementById('sidebar').classList.remove('show');
    // 手机端打开底部表单面板
    if (window.innerWidth <= 768) {
      document.getElementById('inputPanel').classList.add('show');
      document.getElementById('fabBtn').classList.add('open');
    }
    document.getElementById('fPerson').focus();
    showToast('表单已填充，请填写你的推荐');
  };

  // ---- 位置选取 ----
  function enterPickMode() {
    pickLocationMode = true;
    document.getElementById('addHint').classList.add('show');
    document.getElementById('map').style.cursor = 'crosshair';
  }

  function exitPickMode() {
    pickLocationMode = false;
    document.getElementById('addHint').classList.remove('show');
    document.getElementById('map').style.cursor = '';
  }

  function onMapClick(e) {
    if (pickLocationMode) {
      // 高德瓦片返回 GCJ02，转回 WGS84 存储
      const wgs = gcj02ToWgs84(e.latlng.lng, e.latlng.lat);
      tempLatLng = { lat: wgs.lat, lng: wgs.lng };
      if (tempMarker) map.removeLayer(tempMarker);
      // 标记用原始 GCJ02 坐标显示（与瓦片对齐）
      tempMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
      tempMarker.on('dragend', function (ev) {
        const ll = ev.target.getLatLng();
        const w = gcj02ToWgs84(ll.lng, ll.lat);
        tempLatLng = { lat: w.lat, lng: w.lng };
        updateLocationDisplay();
      });
      updateLocationDisplay();
      exitPickMode();
    }
  }

  // 清除位置
  function clearCoord() {
    tempLatLng = null;
    if (tempMarker) {
      map.removeLayer(tempMarker);
      tempMarker = null;
    }
    updateLocationDisplay();
  }

  function updateLocationDisplay() {
    const el = document.getElementById('locationDisplay');
    if (tempLatLng) {
      const addr = document.getElementById('fAddress').value.trim();
      el.classList.add('has-location');
      el.innerHTML = addr
        ? `<span>&#128205; ${escapeHtml(addr)}</span>`
        : `<span>&#128205; 已选取地图位置</span>`;
    } else {
      el.classList.remove('has-location');
      el.innerHTML = '<span class="location-placeholder">输入餐厅名称自动匹配位置</span>';
    }
  }

  // ---- 重置表单 ----
  function resetForm() {
    document.getElementById('fName').value = '';
    document.getElementById('fName').readOnly = false;
    document.getElementById('fName').style.opacity = '1';
    document.getElementById('fAddress').value = '';
    document.getElementById('fCategory').value = '粤菜';
    document.getElementById('fPerson').value = '';
    document.getElementById('fDishes').value = '';
    document.getElementById('fReview').value = '';
    document.getElementById('fPrice').value = '';
    document.getElementById('nameHint').textContent = '';
    tempLatLng = null;
    updateLocationDisplay();
    if (tempMarker) {
      map.removeLayer(tempMarker);
      tempMarker = null;
    }
  }

  // ---- 提交推荐 ----
  async function submitRecommendation() {
    if (isSubmitting) return;

    const name = document.getElementById('fName').value.trim();
    const address = document.getElementById('fAddress').value.trim();
    const category = document.getElementById('fCategory').value;
    const person = document.getElementById('fPerson').value.trim();
    const dishesText = document.getElementById('fDishes').value.trim();
    const review = document.getElementById('fReview').value.trim();
    const price = parseInt(document.getElementById('fPrice').value) || 0;

    // 验证
    if (!name) { showToast('请填写餐厅名称', 'error'); return; }
    if (!person) { showToast('请填写推荐人', 'error'); return; }

    // 检查是否已有同名店（已有则不需要位置）
    const existing = Store.findSpotByName(name);
    if (!existing && !tempLatLng) {
      showToast('请输入餐厅名称自动匹配位置，或点击地图选点', 'error');
      return;
    }

    isSubmitting = true;
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span>提交中...</span>';
    submitBtn.disabled = true;

    try {
      const entry = {
        name,
        person,
        dishes: dishesText,
        review,
        price,
        category,
        address,
      };
      if (tempLatLng) {
        entry.lat = tempLatLng.lat;
        entry.lng = tempLatLng.lng;
      }

      const result = await Store.add(entry);
      showToast('推荐已提交！', 'success');

      // 如果是新增的店，飞过去（WGS84 → GCJ02）
      if (result.action === 'added_spot' && result.spot) {
        const gcj = wgs84ToGcj02(result.spot.lng, result.spot.lat);
        map.flyTo([gcj.lat, gcj.lng], 15, { duration: 0.8 });
        showSidebar(result.spot.id);
      } else if (result.action === 'added_rec' && result.spot) {
        showSidebar(result.spot.id);
      }

      resetForm();
      renderMarkers(document.getElementById('searchInput').value);
      renderLegend();
      updatePersonList();

      // 手机端提交后收起底部面板
      if (window.innerWidth <= 768) {
        document.getElementById('inputPanel').classList.remove('show');
        document.getElementById('fabBtn').classList.remove('open');
      }
    } catch (e) {
      showToast(e.message || '提交失败', 'error');
    } finally {
      isSubmitting = false;
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  }

  // ---- 搜索 ----
  function setupSearch() {
    let timer;
    document.getElementById('searchInput').addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        renderMarkers(e.target.value);
      }, 200);
    });
  }

  // ---- 图例 ----
  function renderLegend() {
    const persons = Store.getAllPersons();
    const body = document.getElementById('legendBody');
    body.innerHTML = Object.entries(persons).map(([name, color]) => `
      <div class="legend-person">
        <span class="legend-person-dot" style="background:${color}"></span>
        <span>${escapeHtml(name)}</span>
      </div>
    `).join('');
  }

  // ---- 推荐人自动补全 ----
  function updatePersonList() {
    const datalist = document.getElementById('personList');
    const persons = Object.keys(Store.getAllPersons());
    datalist.innerHTML = persons.map(p => `<option value="${escapeHtml(p)}">`).join('');
  }

  // ---- 导出 ----
  function exportData() {
    const json = Store.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '广州美食地图_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出', 'success');
  }

  // ---- 导入 ----
  async function importData(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await Store.importData(e.target.result);
        renderMarkers();
        renderLegend();
        updatePersonList();
        showToast('数据导入成功', 'success');
      } catch (err) {
        showToast('导入失败：' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  // ---- Logo ----
  function renderLogo() {
    document.getElementById('logoIcon').innerHTML = eatingLogoSVG(36);
  }

  // ---- Toast ----
  let toastTimer;
  function showToast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
  }

  // ---- 工具函数 ----
  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function avgPriceOf(spot) {
    const prices = spot.recommendations.map(r => r.price || 0).filter(p => p > 0);
    if (!prices.length) return 0;
    return prices.reduce((a, b) => a + b, 0) / prices.length;
  }

  // ---- 轮询回调 ----
  function onPollUpdate(newSpotIds) {
    renderMarkers(document.getElementById('searchInput').value, newSpotIds);
    renderLegend();
    updatePersonList();
    // 如果侧边栏打开中，刷新当前详情
    if (currentSpotId !== null && document.getElementById('sidebar').classList.contains('show')) {
      const spot = Store.data.spots.find(s => s.id === currentSpotId);
      if (spot) {
        showSidebar(currentSpotId);
      }
    }
    if (newSpotIds && newSpotIds.length > 0) {
      showToast('\u6536\u5230 ' + newSpotIds.length + ' \u6761\u65B0\u63A8\u8350\uFF01', 'success');
    }
  }

  // ---- 城市切换 ----
  async function switchCity(city) {
    if (city === Store.currentCity) return;
    const config = CITY_CONFIGS[city];
    if (!config) return;

    // 更新 tab UI
    document.querySelectorAll('.city-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.city === city);
    });

    // 更新副标题
    document.getElementById('citySubtitle').textContent = config.name + ' · 吃好喝好长生不老';

    // 关闭侧边栏、重置表单
    document.getElementById('sidebar').classList.remove('show');
    // 手机端收起底部面板
    if (window.innerWidth <= 768) {
      document.getElementById('inputPanel').classList.remove('show');
      document.getElementById('fabBtn').classList.remove('open');
    }
    resetForm();
    document.getElementById('searchInput').value = '';

    // 切换数据
    await Store.switchCity(city);

    // 地图飞行到新城市（WGS84 → GCJ02）
    const gcj = wgs84ToGcj02(config.center[1], config.center[0]);
    map.flyTo([gcj.lat, gcj.lng], config.zoom, { duration: 0.8 });

    // 重新渲染（含 logo 图标切换）
    renderLogo();
    renderMarkers();
    renderLegend();
    updatePersonList();
    updateApiCurl(city);

    showToast('已切换到' + config.name, 'success');
  }

  // 更新 API curl 示例（含城市参数）
  function updateApiCurl(city) {
    const el = document.getElementById('apiCurl');
    const config = CITY_CONFIGS[city];
    const sampleName = city === 'guangzhou' ? '陶陶居' : city === 'shenzhen' ? '椰子鸡' : '盲公丸';
    const sampleCat = city === 'guangzhou' ? '粤菜' : city === 'shenzhen' ? '火锅' : '小吃';
    el.textContent = `curl -X POST http://127.0.0.1:8080/api/add \\
  -H "Content-Type: application/json" \\
  -d '{"city":"${city}","name":"${sampleName}","person":"小明","dishes":"招牌菜","review":"好吃","price":80,"lat":${config.center[0]},"lng":${config.center[1]},"category":"${sampleCat}"}'`;
  }

  // ---- 餐厅名自动搜索位置 ----
  let searchTimer = null;
  let searchActiveIdx = -1;
  let searchResultsCache = [];

  function performSearch(name) {
    const dropdown = document.getElementById('searchDropdown');
    if (name.length < 2) {
      dropdown.classList.remove('show');
      searchResultsCache = [];
      return;
    }
    dropdown.innerHTML = '<div class="search-dropdown loading">\u6B63\u5728\u641C\u7D22...</div>';
    dropdown.classList.add('show');

    // 本地模式直接调用 Photon API
    const searchFn = Store._useLocal
      ? fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(name) + '&lat=' + CITY_CONFIGS[Store.currentCity].center[0] + '&lon=' + CITY_CONFIGS[Store.currentCity].center[1] + '&limit=6')
          .then(r => r.json())
          .then(data => ({ status:'ok', results: (data.features||[]).map(f => {
            const p = f.properties || {}, c = (f.geometry||{}).coordinates || [0,0];
            const addrParts = []; for (const k of ['street','housenumber','postcode','city','state']) { const v=p[k]; if(v) addrParts.push(String(v)); }
            return { name: p.name||'', address: addrParts.join(' '), lat: c[1], lng: c[0] };
          }).filter(r => r.name) }))
      : fetch('/api/search?q=' + encodeURIComponent(name) + '&city=' + Store.currentCity).then(r => r.json());

    searchFn
      .then(r => r.json())
      .then(data => {
        searchResultsCache = data.results || [];
        if (searchResultsCache.length === 0) {
          dropdown.innerHTML = '<div class="search-dropdown loading">\u672A\u627E\u5230\u76F8\u5173\u5730\u70B9</div>';
          setTimeout(() => dropdown.classList.remove('show'), 1500);
          return;
        }
        searchActiveIdx = -1;
        dropdown.innerHTML = searchResultsCache.map((r, i) =>
          '<div class="search-item" data-idx="' + i + '">' +
            '<div class="search-item-name">' + escapeHtml(r.name) + '</div>' +
            (r.address ? '<div class="search-item-addr">' + escapeHtml(r.address) + '</div>' : '') +
          '</div>'
        ).join('');
        dropdown.querySelectorAll('.search-item').forEach(item => {
          item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectSearchResult(parseInt(item.dataset.idx));
          });
        });
      })
      .catch(() => {
        dropdown.classList.remove('show');
      });
  }

  function selectSearchResult(idx) {
    const result = searchResultsCache[idx];
    if (!result) return;
    // 填充表单
    document.getElementById('fName').value = result.name;
    if (result.address) {
      _addrSearchLocked = true;
      document.getElementById('fAddress').value = result.address;
      setTimeout(() => { _addrSearchLocked = false; }, 500);
    }
    // 设置坐标（Photon 返回 WGS84）
    tempLatLng = { lat: result.lat, lng: result.lng };
    updateLocationDisplay();
    // 放置临时标记（转 GCJ02 显示）
    const gcj = wgs84ToGcj02(result.lng, result.lat);
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker([gcj.lat, gcj.lng], { draggable: true }).addTo(map);
    tempMarker.on('dragend', function (ev) {
      const ll = ev.target.getLatLng();
      const w = gcj02ToWgs84(ll.lng, ll.lat);
      tempLatLng = { lat: w.lat, lng: w.lng };
      updateLocationDisplay();
    });
    map.flyTo([gcj.lat, gcj.lng], 16, { duration: 0.6 });
    // 隐藏下拉框
    document.getElementById('searchDropdown').classList.remove('show');
    // 检查是否已有同名店
    const existing = Store.findSpotByName(result.name);
    if (existing) {
      document.getElementById('nameHint').textContent =
        '\u5DF2\u5B58\u5728\u300C' + existing.name + '\u300D\uFF0C\u63D0\u4EA4\u5C06\u4E3A\u5B83\u6DFB\u52A0\u63A8\u8350';
    } else {
      document.getElementById('nameHint').textContent = '\u2705 \u5DF2\u81EA\u52A8\u5339\u914D\u4F4D\u7F6E';
    }
    showToast('\u5DF2\u5339\u914D\u4F4D\u7F6E\uFF1A' + result.name, 'success');
  }

  // ---- 地址输入自动定位 ----
  let addrSearchTimer = null;
  let _addrSearchLocked = false;

  function performAddressSearch(addressText) {
    if (addressText.length < 3) return;
    const cityCfg = CITY_CONFIGS[Store.currentCity];
    const searchFn = Store._useLocal
      ? fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(addressText) + '&lat=' + cityCfg.center[0] + '&lon=' + cityCfg.center[1] + '&limit=1')
          .then(r => r.json())
          .then(data => ({ results: (data.features||[]).map(f => { const c=(f.geometry||{}).coordinates||[0,0]; return { lat:c[1], lng:c[0] }; }) }))
      : fetch('/api/search?q=' + encodeURIComponent(addressText) + '&city=' + Store.currentCity).then(r => r.json());

    searchFn
      .then(data => {
        const results = data.results || [];
        if (results.length === 0) return;
        // 自动选取第一个结果
        const r = results[0];
        tempLatLng = { lat: r.lat, lng: r.lng };
        updateLocationDisplay();
        const gcj = wgs84ToGcj02(r.lng, r.lat);
        if (tempMarker) map.removeLayer(tempMarker);
        tempMarker = L.marker([gcj.lat, gcj.lng], { draggable: true }).addTo(map);
        tempMarker.on('dragend', function (ev) {
          const ll = ev.target.getLatLng();
          const w = gcj02ToWgs84(ll.lng, ll.lat);
          tempLatLng = { lat: w.lat, lng: w.lng };
          updateLocationDisplay();
        });
        map.flyTo([gcj.lat, gcj.lng], 16, { duration: 0.6 });
        showToast('\u5DF2\u6839\u636E\u5730\u5740\u5B9A\u4F4D', 'success');
      })
      .catch(() => {});
  }

  // ---- 事件绑定 ----
  function setupEvents() {
    // 地图选点 — 地图点击模式
    document.getElementById('pickLocationBtn').addEventListener('click', () => {
      enterPickMode();
      showToast('请在地图上点击选取位置');
    });
    document.getElementById('cancelAddBtn').addEventListener('click', exitPickMode);

    // 清除位置
    document.getElementById('clearCoordBtn').addEventListener('click', clearCoord);

    // 提交
    document.getElementById('submitBtn').addEventListener('click', submitRecommendation);

    // 地址输入自动定位
    document.getElementById('fAddress').addEventListener('input', (e) => {
      if (_addrSearchLocked) return;
      const addr = e.target.value.trim();
      clearTimeout(addrSearchTimer);
      if (addr.length >= 3) {
        addrSearchTimer = setTimeout(() => performAddressSearch(addr), 600);
      }
    });

    // 店名重复检测 + 自动搜索位置
    document.getElementById('fName').addEventListener('input', (e) => {
      if (document.getElementById('fName').readOnly) return;
      const name = e.target.value.trim();
      
      // 防抖搜索
      clearTimeout(searchTimer);
      if (name.length >= 2) {
        searchTimer = setTimeout(() => performSearch(name), 500);
      } else {
        document.getElementById('searchDropdown').classList.remove('show');
      }
      
      // 重复检测
      if (name.length < 2) {
        document.getElementById('nameHint').textContent = '';
        return;
      }
      const existing = Store.findSpotByName(name);
      if (existing) {
        document.getElementById('nameHint').textContent =
          '已存在「' + existing.name + '」，提交将为它添加推荐';
        tempLatLng = { lat: existing.lat, lng: existing.lng };
        updateLocationDisplay();
      } else {
        document.getElementById('nameHint').textContent = '';
      }
    });

    // 搜索框失焦时隐藏下拉（延迟以允许点击）
    document.getElementById('fName').addEventListener('blur', () => {
      setTimeout(() => {
        document.getElementById('searchDropdown').classList.remove('show');
      }, 200);
    });

    // 搜索框键盘导航
    document.getElementById('fName').addEventListener('keydown', (e) => {
      const dropdown = document.getElementById('searchDropdown');
      if (!dropdown.classList.contains('show') || searchResultsCache.length === 0) return;
      const items = dropdown.querySelectorAll('.search-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        searchActiveIdx = Math.min(searchActiveIdx + 1, items.length - 1);
        items.forEach((it, i) => it.classList.toggle('active', i === searchActiveIdx));
        items[searchActiveIdx]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        searchActiveIdx = Math.max(searchActiveIdx - 1, 0);
        items.forEach((it, i) => it.classList.toggle('active', i === searchActiveIdx));
        items[searchActiveIdx]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && searchActiveIdx >= 0) {
        e.preventDefault();
        selectSearchResult(searchActiveIdx);
      } else if (e.key === 'Escape') {
        dropdown.classList.remove('show');
      }
    });

    // 侧边栏关闭
    document.getElementById('closeSidebar').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('show');
    });

    // 面板折叠（桌面端）— 手机端用 FAB 控制
    document.getElementById('collapsePanelBtn').addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        document.getElementById('inputPanel').classList.remove('show');
        document.getElementById('fabBtn').classList.remove('open');
      } else {
        document.body.classList.toggle('panel-collapsed');
      }
    });

    // FAB（手机端）— 打开/关闭底部表单
    document.getElementById('fabBtn').addEventListener('click', () => {
      const panel = document.getElementById('inputPanel');
      const fab = document.getElementById('fabBtn');
      panel.classList.toggle('show');
      fab.classList.toggle('open');
    });

    // 菜单
    document.getElementById('menuBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('menuDropdown').classList.toggle('show');
    });
    document.addEventListener('click', () => {
      document.getElementById('menuDropdown').classList.remove('show');
    });

    // 导出
    document.getElementById('exportBtn').addEventListener('click', () => {
      document.getElementById('menuDropdown').classList.remove('show');
      exportData();
    });

    // 导入
    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('menuDropdown').classList.remove('show');
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', (e) => {
      if (e.target.files[0]) {
        importData(e.target.files[0]);
        e.target.value = '';
      }
    });

    // 加载示例数据
    document.getElementById('sampleBtn').addEventListener('click', async () => {
      document.getElementById('menuDropdown').classList.remove('show');
      if (!confirm('确定加载示例数据？当前数据将被覆盖。')) return;
      try {
        await Store.loadSample();
        renderMarkers();
        renderLegend();
        updatePersonList();
        document.getElementById('sidebar').classList.remove('show');
        showToast('示例数据已加载', 'success');
      } catch (e) {
        showToast('加载失败：' + e.message, 'error');
      }
    });

    // 清空数据
    document.getElementById('resetBtn').addEventListener('click', async () => {
      document.getElementById('menuDropdown').classList.remove('show');
      if (!confirm('确定清空所有数据？此操作不可撤销。')) return;
      try {
        await Store.reset();
        renderMarkers();
        renderLegend();
        updatePersonList();
        document.getElementById('sidebar').classList.remove('show');
        showToast('数据已清空', 'success');
      } catch (e) {
        showToast('操作失败：' + e.message, 'error');
      }
    });

    // API 区域折叠
    document.getElementById('apiHeader').addEventListener('click', () => {
      document.getElementById('apiBody').parentElement.classList.toggle('collapsed');
    });

    // API curl 复制
    document.getElementById('apiCurl').addEventListener('click', async () => {
      const text = document.getElementById('apiCurl').textContent;
      try {
        await navigator.clipboard.writeText(text);
        showToast('已复制到剪贴板', 'success');
      } catch (e) {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('已复制到剪贴板', 'success');
      }
    });

    // 图例折叠
    document.getElementById('legendHeader').addEventListener('click', () => {
      document.getElementById('legend').classList.toggle('collapsed');
    });

    // 城市切换
    document.querySelectorAll('.city-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        switchCity(tab.dataset.city);
      });
    });

    // ESC 关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (pickLocationMode) {
          exitPickMode();
        } else {
          document.getElementById('sidebar').classList.remove('show');
          document.getElementById('menuDropdown').classList.remove('show');
        }
      }
    });
  }

  // ---- 初始化 ----
  async function init() {
    initMap();
    renderLogo();
    updateLocationDisplay();

    // 加载数据
    await Store.load();
    renderMarkers();
    renderLegend();
    updatePersonList();
    setupSearch();
    setupEvents();

    // 启动轮询（实时更新）
    Store.startPolling(onPollUpdate);
    updateApiCurl(Store.currentCity);
    document.getElementById('citySubtitle').textContent = CITY_CONFIGS[Store.currentCity].name + ' · 吃好喝好长生不老';

    console.log('%c茶蛋点评 · 美食地图', 'color:#D64545;font-size:16px;font-weight:bold');
    console.log('支持城市：广州 / 深圳 / 佛山');
    console.log('API 端口：GET /api/data?city=guangzhou | POST /api/add');
  }

  // DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
