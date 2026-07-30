/**
 * 茶蛋er点评 · 美食地图 - 核心逻辑 (GitHub Pages 纯静态版)
 * 数据从 GitHub raw 文件读取 + localStorage 本地增量
 */
(function () {
  'use strict';

  // ---- 状态 ----
  let map;
  let markers = {};
  let pickedLocation = null;
  let isPickMode = false;
  let starRating = 0;
  let currentSpotId = null;

  const CITY_CENTERS = {
    guangzhou: { center: [23.1291, 113.2644], zoom: 12 },
    shenzhen:   { center: [22.5431, 114.0579], zoom: 12 },
    foshan:     { center: [23.0218, 113.1219], zoom: 12 },
  };

  // ---- 吃饭 Logo ----
  function eatingLogoSVG(size) {
    const uid = 'elogo' + size;
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 3px rgba(139,111,71,0.3));">
        <defs>
          <radialGradient id="${uid}b" cx="50%" cy="30%"><stop offset="0%" stop-color="#FF8A65"/><stop offset="60%" stop-color="#FF5722"/><stop offset="100%" stop-color="#D84315"/></radialGradient>
          <linearGradient id="${uid}s" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF3E0"/><stop offset="100%" stop-color="#FFE0B2"/></linearGradient>
          <radialGradient id="${uid}f" cx="50%" cy="70%"><stop offset="0%" stop-color="#FFAB91"/><stop offset="100%" stop-color="#FF7043"/></radialGradient>
        </defs>
        <path d="M20 55 Q50 80 80 55 L75 85 Q50 95 25 85 Z" fill="url(#${uid}b)" stroke="#BF360C" stroke-width="1.5"/>
        <ellipse cx="50" cy="55" rx="30" ry="8" fill="url(#${uid}s)" stroke="#BF360C" stroke-width="1.2"/>
        <circle cx="42" cy="50" r="6" fill="url(#${uid}f)" stroke="#BF360C" stroke-width="0.8"/>
        <circle cx="50" cy="48" r="5.5" fill="url(#${uid}f)" stroke="#BF360C" stroke-width="0.8"/>
        <circle cx="58" cy="50" r="6" fill="url(#${uid}f)" stroke="#BF360C" stroke-width="0.8"/>
        <circle cx="46" cy="44" r="4.5" fill="url(#${uid}f)" stroke="#BF360C" stroke-width="0.8"/>
        <circle cx="54" cy="44" r="4.5" fill="url(#${uid}f)" stroke="#BF360C" stroke-width="0.8"/>
        <rect x="32" y="15" width="3" height="42" rx="1.5" fill="#5D4037" transform="rotate(-12 33 36)"/>
        <rect x="40" y="15" width="3" height="42" rx="1.5" fill="#5D4037" transform="rotate(-6 41.5 36)"/>
        <path d="M40 35 Q42 25 40 18" fill="none" stroke="#FFCC80" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
        <path d="M50 33 Q52 23 50 16" fill="none" stroke="#FFCC80" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
        <path d="M60 35 Q62 25 60 18" fill="none" stroke="#FFCC80" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
      </svg>
    `;
  }

  // ---- 木棉花 SVG（广州）----
  function kapokSVG(size, names) {
    const cx = 50, cy = 50;
    const count = Array.isArray(names) ? names.length : 0;
    const uid = 'k' + size + 'x' + count;

    let petals = '';
    const petalsCount = 5;
    for (let i = 0; i < petalsCount; i++) {
      const a = (i / petalsCount) * Math.PI * 2 - Math.PI / 2;
      const px = cx + 28 * Math.cos(a);
      const py = cy + 28 * Math.sin(a);
      const rx = 14 + (count > 3 ? 2 : 0);
      const ry = 22 + (count > 3 ? 2 : 0);
      const rot = (a * 180 / Math.PI) + 90;
      const c1 = i % 2 === 0 ? '#FF6B6B' : '#FF8E53';
      const c2 = i % 2 === 0 ? '#C0392B' : '#D35400';
      petals += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx}" ry="${ry}" fill="${c1}" stroke="${c2}" stroke-width="1.2" transform="rotate(${rot.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})" opacity="0.92"/>`;
    }

    let centerText, fontSize;
    if (count === 0) { centerText = '\u{1F33C}'; fontSize = 13; }
    else if (count === 1) { centerText = escapeHtml(String(names[0]).slice(0, 2)); fontSize = 10; }
    else if (count === 2) { centerText = escapeHtml(names.map(n => String(n)[0]).join('')); fontSize = 9; }
    else if (count === 3) { centerText = escapeHtml(names.map(n => String(n)[0]).join('')); fontSize = 8; }
    else { centerText = escapeHtml(names.slice(0, 3).map(n => String(n)[0]).join('')) + '+' + (count - 3); fontSize = 7; }

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 4px rgba(0,0,0,0.2));">
        <defs><radialGradient id="${uid}g" cx="50%" cy="35%"><stop offset="0%" stop-color="#FFCCBC"/><stop offset="70%" stop-color="#FFAB91"/><stop offset="100%" stop-color="#FF8A65"/></radialGradient></defs>
        ${petals}
        <circle cx="${cx}" cy="${cy}" r="16" fill="url(#${uid}g)" stroke="#E64A19" stroke-width="1" opacity="0.95"/>
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="${fontSize}" font-weight="800" fill="#fff" class="kapok-text" style="paint-order: stroke; stroke: #D84315; stroke-width: 0.5;">${centerText}</text>
      </svg>
    `;
  }

  // ---- 小牛 SVG（深圳专用）----
  function calfSVG(size, names) {
    const cx = 50, cy = 52;
    const count = Array.isArray(names) ? names.length : 0;
    const uid = 'cow' + size + 'x' + count;

    let centerText, fontSize;
    if (count === 0) { centerText = '\u{1F42C}'; fontSize = 13; }
    else if (count === 1) { centerText = escapeHtml(String(names[0]).slice(0, 2)); fontSize = 10; }
    else if (count === 2) { centerText = escapeHtml(names.map(n => String(n)[0]).join('')); fontSize = 9; }
    else if (count === 3) { centerText = escapeHtml(names.map(n => String(n)[0]).join('')); fontSize = 8; }
    else { centerText = escapeHtml(names.slice(0, 3).map(n => String(n)[0]).join('')) + '+' + (count - 3); fontSize = 7; }

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 4px rgba(87,60,30,0.35));">
        <defs>
          <radialGradient id="${uid}g" cx="50%" cy="35%"><stop offset="0%" stop-color="#FFF8E1"/><stop offset="70%" stop-color="#FFECB3"/><stop offset="100%" stop-color="#F0D060"/></radialGradient>
          <radialGradient id="${uid}n" cx="50%" cy="50%"><stop offset="0%" stop-color="#FFCDD2"/><stop offset="100%" stop-color="#F48FB1"/></radialGradient>
          <radialGradient id="${uid}c" cx="50%" cy="50%"><stop offset="0%" stop-color="#FFD54F"/><stop offset="100%" stop-color="#FF8F00"/></radialGradient>
        </defs>
        <ellipse cx="${cx-28}" cy="${cy-16}" rx="10" ry="13" fill="#FFECB3" stroke="#8D6E63" stroke-width="0.8" transform="rotate(-25 ${cx-28} ${cy-16})"/>
        <ellipse cx="${cx+28}" cy="${cy-16}" rx="10" ry="13" fill="#FFECB3" stroke="#8D6E63" stroke-width="0.8" transform="rotate(25 ${cx+28} ${cy-16})"/>
        <ellipse cx="${cx-28}" cy="${cy-16}" rx="5" ry="8" fill="#F8BBD0" transform="rotate(-25 ${cx-28} ${cy-16})"/>
        <ellipse cx="${cx+28}" cy="${cy-16}" rx="5" ry="8" fill="#F8BBD0" transform="rotate(25 ${cx+28} ${cy-16})"/>
        <path d="M ${cx-20} ${cy-26} Q ${cx-28} ${cy-38} ${cx-22} ${cy-44} Q ${cx-15} ${cy-38} ${cx-12} ${cy-28} Z" fill="#D7A86E" stroke="#8D6E63" stroke-width="0.8"/>
        <path d="M ${cx+20} ${cy-26} Q ${cx+28} ${cy-38} ${cx+22} ${cy-44} Q ${cx+15} ${cy-38} ${cx+12} ${cy-28} Z" fill="#D7A86E" stroke="#8D6E63" stroke-width="0.8"/>
        <ellipse cx="${cx}" cy="${cy}" rx="30" ry="28" fill="url(#${uid}g)" stroke="#8D6E63" stroke-width="1.2"/>
        <ellipse cx="${cx-16}" cy="${cy-10}" rx="7" ry="5" fill="#8D6E63" opacity="0.25" transform="rotate(-15 ${cx-16} ${cy-10})"/>
        <ellipse cx="${cx+12}" cy="${cy-14}" rx="5" ry="7" fill="#8D6E63" opacity="0.25" transform="rotate(20 ${cx+12} ${cy-14})"/>
        <ellipse cx="${cx-8}" cy="${cy+16}" rx="6" ry="4" fill="#8D6E63" opacity="0.25" transform="rotate(-10 ${cx-8} ${cy+16})"/>
        <ellipse cx="${cx+18}" cy="${cy+8}" rx="4" ry="6" fill="#8D6E63" opacity="0.25" transform="rotate(30 ${cx+18} ${cy+8})"/>
        <ellipse cx="${cx-12}" cy="${cy-4}" rx="6" ry="8" fill="#fff" stroke="#5D4037" stroke-width="0.8"/>
        <ellipse cx="${cx+12}" cy="${cy-4}" rx="6" ry="8" fill="#fff" stroke="#5D4037" stroke-width="0.8"/>
        <circle cx="${cx-11}" cy="${cy-3}" r="3.5" fill="#3E2723"/>
        <circle cx="${cx+13}" cy="${cy-3}" r="3.5" fill="#3E2723"/>
        <circle cx="${cx-10}" cy="${cy-4}" r="1" fill="#fff"/>
        <circle cx="${cx+14}" cy="${cy-4}" r="1" fill="#fff"/>
        <path d="M ${cx-18} ${cy-8} L ${cx-22} ${cy-12}" stroke="#5D4037" stroke-width="0.8" stroke-linecap="round"/>
        <path d="M ${cx+18} ${cy-8} L ${cx+22} ${cy-12}" stroke="#5D4037" stroke-width="0.8" stroke-linecap="round"/>
        <ellipse cx="${cx-20}" cy="${cy+4}" rx="5" ry="3" fill="url(#${uid}n)" opacity="0.6"/>
        <ellipse cx="${cx+20}" cy="${cy+4}" rx="5" ry="3" fill="url(#${uid}n)" opacity="0.6"/>
        <ellipse cx="${cx}" cy="${cy+14}" rx="18" ry="12" fill="#FFECB3" stroke="#8D6E63" stroke-width="0.6" opacity="0.9"/>
        <ellipse cx="${cx-4}" cy="${cy+12}" rx="2.5" ry="1.8" fill="#8D6E63" opacity="0.5"/>
        <ellipse cx="${cx+4}" cy="${cy+12}" rx="2.5" ry="1.8" fill="#8D6E63" opacity="0.5"/>
        <path d="M ${cx-6} ${cy+18} Q ${cx} ${cy+22} ${cx+6} ${cy+18}" fill="none" stroke="#8D6E63" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy+26}" r="5" fill="url(#${uid}c)" stroke="#B76E00" stroke-width="0.6"/>
        <line x1="${cx}" y1="${cy+31}" x2="${cx}" y2="${cy+34}" stroke="#B76E00" stroke-width="0.6"/>
        <text x="${cx}" y="${cy+2}" text-anchor="middle" font-size="${fontSize}" font-weight="800" fill="#fff" class="kapok-text" style="paint-order: stroke; stroke: #5D4037; stroke-width: 0.5;">${centerText}</text>
      </svg>
    `;
  }

  // ---- 超可爱小狮子 SVG（佛山专用）----
  function cuteLionSVG(size, names) {
    const cx = 50, cy = 50;
    const count = Array.isArray(names) ? names.length : 0;
    const uid = 'clion' + size + 'x' + count;

    let centerText, fontSize;
    if (count === 0) { centerText = '\u{1F981}'; fontSize = 13; }
    else if (count === 1) { centerText = escapeHtml(String(names[0]).slice(0, 2)); fontSize = 10; }
    else if (count === 2) { centerText = escapeHtml(names.map(n => String(n)[0]).join('')); fontSize = 9; }
    else if (count === 3) { centerText = escapeHtml(names.map(n => String(n)[0]).join('')); fontSize = 8; }
    else { centerText = escapeHtml(names.slice(0, 3).map(n => String(n)[0]).join('')) + '+' + (count - 3); fontSize = 7; }

    // 超可爱蓬松鬃毛 - 圆润波浪形
    let mane = '';
    const manePoints = 16;
    for (let i = 0; i < manePoints; i++) {
      const a1 = (i / manePoints) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((i + 1) / manePoints) * Math.PI * 2 - Math.PI / 2;
      const mid = (a1 + a2) / 2;
      const rIn = 25, rOut = 36;
      const x1 = cx + rIn * Math.cos(a1), y1 = cy + rIn * Math.sin(a1);
      const x2 = cx + rOut * Math.cos(mid), y2 = cy + rOut * Math.sin(mid);
      const x3 = cx + rIn * Math.cos(a2), y3 = cy + rIn * Math.sin(a2);
      const colors = ['#FFCC02', '#FFB300', '#FF9800', '#FF8F00'];
      const color = colors[i % colors.length];
      mane += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${x2.toFixed(1)} ${y2.toFixed(1)} ${x3.toFixed(1)} ${y3.toFixed(1)}" fill="${color}" stroke="#E65100" stroke-width="0.4" opacity="0.95"/>`;
    }

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(255,143,0,0.3));">
        <defs>
          <radialGradient id="${uid}f" cx="50%" cy="40%"><stop offset="0%" stop-color="#FFF8E1"/><stop offset="50%" stop-color="#FFE082"/><stop offset="100%" stop-color="#FFD54F"/></radialGradient>
          <radialGradient id="${uid}e" cx="50%" cy="30%"><stop offset="0%" stop-color="#FFECB3"/><stop offset="100%" stop-color="#FFCA28"/></radialGradient>
          <radialGradient id="${uid}c" cx="50%" cy="50%"><stop offset="0%" stop-color="#FFF9C4"/><stop offset="100%" stop-color="#FFEB3B"/></radialGradient>
          <radialGradient id="${uid}blush" cx="50%" cy="50%"><stop offset="0%" stop-color="#FFAB91"/><stop offset="100%" stop-color="#FF8A65"/></radialGradient>
        </defs>
        ${mane}
        <!-- 圆耳朵 -->
        <circle cx="${cx-24}" cy="${cy-20}" r="11" fill="url(#${uid}e)" stroke="#E65100" stroke-width="1"/>
        <circle cx="${cx+24}" cy="${cy-20}" r="11" fill="url(#${uid}e)" stroke="#E65100" stroke-width="1"/>
        <circle cx="${cx-24}" cy="${cy-20}" r="6" fill="#FFCC80" opacity="0.9"/>
        <circle cx="${cx+24}" cy="${cy-20}" r="6" fill="#FFCC80" opacity="0.9"/>
        <!-- 圆脸 -->
        <ellipse cx="${cx}" cy="${cy+2}" rx="30" ry="28" fill="url(#${uid}f)" stroke="#E65100" stroke-width="1.2"/>
        <!-- 大眼睛 -->
        <ellipse cx="${cx-12}" cy="${cy-2}" rx="11" ry="12" fill="#fff" stroke="#E65100" stroke-width="1"/>
        <ellipse cx="${cx+12}" cy="${cy-2}" rx="11" ry="12" fill="#fff" stroke="#E65100" stroke-width="1"/>
        <!-- 瞳孔 -->
        <circle cx="${cx-11}" cy="${cy-1}" r="6" fill="#3E2723"/>
        <circle cx="${cx+13}" cy="${cy-1}" r="6" fill="#3E2723"/>
        <!-- 高光 -->
        <circle cx="${cx-8}" cy="${cy-4}" r="2.5" fill="#fff" opacity="0.95"/>
        <circle cx="${cx+16}" cy="${cy-4}" r="2.5" fill="#fff" opacity="0.95"/>
        <circle cx="${cx-14}" cy="${cy+2}" r="1.5" fill="#fff" opacity="0.7"/>
        <circle cx="${cx+10}" cy="${cy+2}" r="1.5" fill="#fff" opacity="0.7"/>
        <!-- 腮红 -->
        <ellipse cx="${cx-20}" cy="${cy+8}" rx="7" ry="4" fill="url(#${uid}blush)" opacity="0.45"/>
        <ellipse cx="${cx+20}" cy="${cy+8}" rx="7" ry="4" fill="url(#${uid}blush)" opacity="0.45"/>
        <!-- 小鼻子 -->
        <ellipse cx="${cx}" cy="${cy+8}" rx="5" ry="4" fill="#FF8A65" stroke="#E65100" stroke-width="0.5"/>
        <!-- 微笑嘴 -->
        <path d="M ${cx-10} ${cy+16} Q ${cx} ${cy+22} ${cx+10} ${cy+16}" fill="none" stroke="#E65100" stroke-width="1.8" stroke-linecap="round"/>
        <!-- 小舌头 -->
        <ellipse cx="${cx+3}" cy="${cy+19}" rx="4" ry="2.5" fill="#FF8A80" opacity="0.7"/>
        <!-- 中心圆 -->
        <circle cx="${cx}" cy="${cy-2}" r="13" fill="url(#${uid}c)" stroke="#E65100" stroke-width="0.8" opacity="0.95"/>
        <!-- 中心文字 -->
        <text x="${cx}" y="${cy+2}" text-anchor="middle" font-size="${fontSize}" font-weight="800" fill="#E65100" class="kapok-text">${centerText}</text>
      </svg>
    `;
  }

  function markerSVG(size, names) {
    if (Store.currentCity === 'foshan') return cuteLionSVG(size, names);
    if (Store.currentCity === 'shenzhen') return calfSVG(size, names);
    return kapokSVG(size, names);
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function avgPriceOf(spot) {
    if (!spot.recommendations || !spot.recommendations.length) return 0;
    const prices = spot.recommendations.map(r => r.price || 0).filter(p => p > 0);
    if (!prices.length) return 0;
    return prices.reduce((a, b) => a + b, 0) / prices.length;
  }

  function initMap() {
    const city = CITY_CENTERS[Store.currentCity] || CITY_CENTERS.guangzhou;
    const gcj = wgs84ToGcj02(city.center[1], city.center[0]);
    map = L.map('map', { zoomControl: false }).setView([gcj.lat, gcj.lng], city.zoom);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&z={z}&x={x}&y={y}', {
      subdomains: '1234',
      attribution: '\u00A9 \u9ad8\u5fb7\u5730\u56fe',
      maxZoom: 18,
    }).addTo(map);

    // 地图点击关闭侧边栏（但在选点模式下处理选点）
    map.on('click', (e) => {
      if (isPickMode) {
        handleMapPick(e);
      } else {
        closeSidebar();
      }
    });
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('show');
    currentSpotId = null;
  }

  async function renderMarkers(filterText = '') {
    const data = Store.data;
    const lower = (filterText || '').toLowerCase();

    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};

    data.spots.forEach((spot, index) => {
      const recNames = spot.recommendations.map(r => r.person);
      const count = recNames.length;
      if (lower && !spot.name.toLowerCase().includes(lower) &&
          !spot.category.toLowerCase().includes(lower) &&
          !recNames.some(n => n.toLowerCase().includes(lower)) &&
          !(spot.recommendations || []).some(r => (r.dishes || []).some(d => d.toLowerCase().includes(lower)))) return;

      let size = 36;
      if (count === 2) size = 42;
      else if (count === 3) size = 50;
      else if (count >= 4 && count <= 5) size = 58;
      else if (count >= 6) size = 66;

      const gcj = wgs84ToGcj02(spot.lng, spot.lat);
      const marker = L.marker([gcj.lat, gcj.lng], {
        icon: L.divIcon({
          className: 'kapok-marker',
          html: markerSVG(size, recNames),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
      });

      marker.bindPopup(createMiniPopup(spot), {
        closeButton: false, offset: [0, -size / 2 + 4],
      });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        marker.openPopup();
        showSidebar(spot.id);
      });
      marker.addTo(map);
      markers[spot.id] = marker;

      setTimeout(() => {
        const el = marker.getElement();
        if (el) {
          el.style.animation = 'none';
          el.offsetHeight;
          el.style.animation = 'markerBounce 0.5s ease';
        }
      }, index * 80);
    });
  }

  function createMiniPopup(spot) {
    const count = spot.recommendations.length;
    const avgPrice = avgPriceOf(spot);
    const catColor = (CATEGORIES && CATEGORIES[spot.category]) || '#607D8B';
    const personNames = spot.recommendations.map(r => escapeHtml(r.person)).join('、');
    const priceStr = avgPrice > 0 ? ' \u00B7 \u00A5' + Math.round(avgPrice) + '/人' : '';
    const wtgCount = (spot.wantToGo || []).length;
    const wtgStr = wtgCount > 0 ? ` \u00B7 \u{1F3AF} ${wtgCount}人想去` : '';

    return `
      <div class="mini-popup">
        <div class="mini-popup-name">${escapeHtml(spot.name)}</div>
        <div class="mini-popup-meta">
          <span style="color:${catColor};font-weight:600">${escapeHtml(spot.category)}</span>
          ${priceStr}${wtgStr}
        </div>
        <div class="mini-popup-persons">${personNames}\u63A8\u8350</div>
        <button class="mini-popup-btn" onclick="window.__showDetail(${spot.id})">\u67E5\u770B\u8BE6\u60C5</button>
      </div>
    `;
  }

  // ---- 侧边栏详情（增强版）----
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
    const wantToGo = spot.wantToGo || [];
    const wtgCount = wantToGo.length;
    const comments = spot.comments || [];

    let html = `
      <div class="spot-detail-name">${escapeHtml(spot.name)}</div>
      <div class="spot-detail-meta">
        <span class="meta-chip category" style="background:${catColor}">${escapeHtml(spot.category)}</span>
        ${avgPrice > 0 ? `<span class="meta-chip price">\u00A5${Math.round(avgPrice)}/人</span>` : ''}
        <span class="meta-chip recommenders">${count}人推荐</span>
      </div>
      <div class="spot-detail-recommenders">
        <span class="recommenders-label">推荐人：</span>
        <span class="recommenders-names">${personNames}</span>
      </div>
      <div class="spot-detail-address">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <span>${escapeHtml(spot.address || '地址未填写')}</span>
      </div>
    `;

    // ---- 想去的人 ----
    html += `
      <div class="want-to-go-section">
        <div class="wtg-header">
          <span class="wtg-icon">\u{1F3AF}</span>
          <span class="wtg-title">${wtgCount > 0 ? wtgCount + '人想去这里' : '想去这里'}</span>
        </div>
    `;
    if (wtgCount > 0) {
      html += '<div class="wtg-names">';
      wantToGo.forEach(name => {
        const color = persons[name] || '#999';
        html += `<span class="wtg-name" style="background:${color}">${escapeHtml(name)}</span>`;
      });
      html += '</div>';
    }
    html += `
        <div class="wtg-input-row">
          <input type="text" id="wtgInput" placeholder="输入你的名字..." maxlength="20">
          <button class="wtg-btn" id="wtgBtn" onclick="window.__addWantToGo()">\u{1F3AF} 想去</button>
        </div>
      </div>
    `;

    // ---- 推荐详情 ----
    html += '<div class="detail-section-title">推荐详情</div>';

    spot.recommendations.forEach((rec, idx) => {
      const color = persons[rec.person] || '#999';
      const dishBadges = (rec.dishes || []).map(d =>
        `<span class="dish-badge" style="background:${color}">${escapeHtml(d)}</span>`
      ).join('');
      const priceTag = rec.price > 0 ? `<span class="rec-price">\u00A5${rec.price}/人</span>` : '';
      const stars = rec.rating ? renderStars(rec.rating) : '';

      html += `
        <div class="rec-card" style="border-left-color:${color};animation-delay:${idx * 0.08}s">
          <div class="rec-header">
            <div class="rec-person">
              <span class="person-dot" style="background:${color}"></span>
              <span>${escapeHtml(rec.person)}</span>
            </div>
            <div class="rec-header-right">${stars}${priceTag}</div>
          </div>
          <div class="rec-dishes">${dishBadges}</div>
          ${rec.review ? `<div class="rec-review">${escapeHtml(rec.review)}</div>` : ''}
          <div class="rec-date">${rec.date || ''}</div>
        </div>
      `;
    });

    // ---- 互动评论区 ----
    html += '<div class="detail-section-title">\u{1F4AC} 互动留言</div>';

    if (comments.length > 0) {
      html += '<div class="comments-list">';
      comments.forEach(c => {
        html += `
          <div class="comment-item">
            <div class="comment-header">
              <span class="comment-author">${escapeHtml(c.author || '匿名')}</span>
              <span class="comment-time">${c.date || ''}</span>
            </div>
            <div class="comment-body">${escapeHtml(c.content)}</div>
          </div>
        `;
      });
      html += '</div>';
    } else {
      html += '<div class="comments-empty">还没有留言，来抢沙发吧~</div>';
    }

    html += `
      <div class="comment-form">
        <input type="text" id="commentAuthor" placeholder="你的名字（选填）" maxlength="20" class="comment-input">
        <textarea id="commentContent" placeholder="想说点什么...（选填）" rows="2" class="comment-textarea"></textarea>
        <button class="btn btn-primary comment-submit" id="commentSubmitBtn" style="width:100%;justify-content:center" onclick="window.__addComment()">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          发表留言
        </button>
      </div>
    `;

    body.innerHTML = html;
    document.getElementById('sidebar').classList.add('show');
  }

  function renderStars(rating) {
    let html = '<span class="rec-stars">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="${i <= rating ? 'filled' : 'empty'}">★</span>`;
    }
    html += '</span>';
    return html;
  }

  // ---- 添加想去 ----
  function addWantToGo() {
    if (!currentSpotId) return;
    const spot = Store.data.spots.find(s => s.id === currentSpotId);
    if (!spot) return;
    const input = document.getElementById('wtgInput');
    const name = (input.value || '').trim();
    if (!name) { showToast('请输入你的名字', 'error'); return; }

    const current = spot.wantToGo || [];
    if (current.includes(name)) { showToast('你已经标记过想去啦', 'error'); return; }

    Store.addWantToGo(spot.name, name);
    showSidebar(currentSpotId);
    renderMarkers();
    showToast('已标记想去！', 'success');
  }

  // ---- 添加评论 ----
  function addComment() {
    if (!currentSpotId) return;
    const spot = Store.data.spots.find(s => s.id === currentSpotId);
    if (!spot) return;

    const authorInput = document.getElementById('commentAuthor');
    const contentInput = document.getElementById('commentContent');
    const author = (authorInput.value || '').trim() || '匿名';
    const content = (contentInput.value || '').trim();
    if (!content) { showToast('请输入留言内容', 'error'); return; }

    const comment = {
      id: Date.now(),
      author,
      content,
      date: new Date().toISOString().split('T')[0],
    };

    Store.addComment(spot.name, comment);
    showSidebar(currentSpotId);
    showToast('留言发表成功！', 'success');
  }

  function renderLogo() {
    document.getElementById('logoIcon').innerHTML = eatingLogoSVG(34);
  }

  function renderLegend() {
    const data = Store.data;
    const persons = data.persons || {};
    const el = document.getElementById('legendBody');
    let html = '';
    Object.entries(persons).forEach(([name, color]) => {
      const count = data.spots.filter(s => s.recommendations.some(r => r.person === name)).length;
      html += `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span><span>${escapeHtml(name)}</span><span class="legend-count">${count}</span></div>`;
    });
    el.innerHTML = html || '<div class="legend-item" style="opacity:0.6">\u6682\u65e0\u63a8\u8350\u4eba</div>';
  }

  async function switchCity(city) {
    if (!CITY_CONFIGS[city]) return;
    const config = CITY_CONFIGS[city];
    document.querySelectorAll('.city-tab').forEach(t => t.classList.toggle('active', t.dataset.city === city));
    Store.currentCity = city;
    await Store.load();
    const gcj = wgs84ToGcj02(config.center[1], config.center[0]);
    map.flyTo([gcj.lat, gcj.lng], config.zoom, { duration: 0.8 });
    renderMarkers();
    renderLegend();
    closeSidebar();
    document.getElementById('citySubtitle').textContent = config.name + ' · 吃好喝好长生不老';
    pickedLocation = null;
    updateLocationDisplay();
  }

  async function performAddressSearch() {
    const address = document.getElementById('spotAddress').value.trim();
    if (!address) { showHint('请先输入地址'); return; }

    const btn = document.getElementById('searchAddrBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> 搜索中...';
    btn.disabled = true;

    try {
      const cityName = CITY_CONFIGS[Store.currentCity].name;
      const query = encodeURIComponent(address + ' ' + cityName);
      const res = await fetch(`https://photon.komoot.io/api/?q=${query}&limit=5&lang=zh`);
      const data = await res.json();

      if (data.features && data.features.length > 0) {
        const best = data.features[0];
        const [lng, lat] = best.geometry.coordinates;
        pickedLocation = { lat, lng };
        updateLocationDisplay();
        const gcj = wgs84ToGcj02(lng, lat);
        map.flyTo([gcj.lat, gcj.lng], 16, { duration: 0.6 });
        showToast('定位成功', 'success');
      } else {
        showToast('未找到该地址，请尝试更详细的描述', 'error');
      }
    } catch (e) {
      console.error('地址搜索失败:', e);
      showToast('搜索失败，请检查网络', 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }

  function enterPickMode() {
    isPickMode = true;
    document.getElementById('addHint').classList.add('show');
    map.getContainer().style.cursor = 'crosshair';
    showToast('点击地图选择餐厅位置');
  }

  function exitPickMode() {
    isPickMode = false;
    document.getElementById('addHint').classList.remove('show');
    map.getContainer().style.cursor = '';
  }

  function handleMapPick(e) {
    const gcj = e.latlng;
    const wgs = gcj02ToWgs84(gcj.lng, gcj.lat);
    pickedLocation = { lat: wgs.lat, lng: wgs.lng };
    updateLocationDisplay();
    exitPickMode();
    showToast('已选择位置', 'success');
  }

  function updateLocationDisplay() {
    const el = document.getElementById('locationDisplay');
    if (pickedLocation) {
      el.innerHTML = `<span style="color:var(--kapok);font-weight:600">已定位</span> &nbsp;<span style="color:var(--text-muted);font-size:11px">${pickedLocation.lat.toFixed(5)}, ${pickedLocation.lng.toFixed(5)}</span>`;
      el.classList.add('has-location');
    } else {
      el.innerHTML = '<span class="location-placeholder">尚未定位，请搜索地址或在地图上选点</span>';
      el.classList.remove('has-location');
    }
  }

  function setupStarPicker() {
    const picker = document.getElementById('starPicker');
    const stars = picker.querySelectorAll('.star');
    stars.forEach(star => {
      star.addEventListener('click', () => {
        starRating = parseInt(star.dataset.val);
        stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= starRating));
      });
    });
  }

  async function submitRecommendation(e) {
    e.preventDefault();

    const name = document.getElementById('spotName').value.trim();
    const address = document.getElementById('spotAddress').value.trim();
    const category = document.getElementById('spotCategory').value;
    const price = parseInt(document.getElementById('spotPrice').value) || 0;
    const person = document.getElementById('recPerson').value.trim();
    const dishesStr = document.getElementById('recDishes').value.trim();
    const review = document.getElementById('recReview').value.trim();

    if (!name) { showHint('请填写餐厅名称'); return; }
    if (!address) { showHint('请填写详细地址'); return; }
    if (!person) { showHint('请填写推荐人'); return; }
    if (!pickedLocation) { showHint('请先搜索地址或在地图上选点定位'); return; }

    const dishes = dishesStr ? dishesStr.split(/[,，]/).map(d => d.trim()).filter(Boolean) : [];
    const today = new Date().toISOString().split('T')[0];

    const existing = Store.findSpotByName(name);
    let spotData;

    if (existing && existing.name === name) {
      spotData = {
        id: existing.id,
        name: existing.name,
        address: existing.address || address,
        lat: existing.lat || pickedLocation.lat,
        lng: existing.lng || pickedLocation.lng,
        category: existing.category || category,
        recommendations: [{
          person, dishes, review, price,
          rating: starRating || undefined,
          date: today,
        }],
      };
    } else {
      spotData = {
        id: Date.now(),
        name, address,
        lat: pickedLocation.lat,
        lng: pickedLocation.lng,
        category,
        recommendations: [{
          person, dishes, review, price,
          rating: starRating || undefined,
          date: today,
        }],
      };
    }

    Store.addLocalSpot(spotData);

    document.getElementById('addForm').reset();
    pickedLocation = null;
    starRating = 0;
    document.querySelectorAll('#starPicker .star').forEach(s => s.classList.remove('active'));
    updateLocationDisplay();
    showHint('');

    renderMarkers();
    renderLegend();

    const gcj = wgs84ToGcj02(spotData.lng, spotData.lat);
    map.flyTo([gcj.lat, gcj.lng], 16, { duration: 0.6 });

    showToast('推荐添加成功！', 'success');
  }

  function showHint(msg) {
    const el = document.getElementById('formHint');
    el.textContent = msg;
    if (msg) el.style.color = 'var(--kapok)';
  }

  function exportData() {
    const json = Store.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data_${Store.currentCity}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('数据已导出，请上传到 GitHub 仓库', 'success');
  }

  function clearLocalData() {
    if (!confirm('确定要清空当前城市的本地添加数据吗？此操作不可恢复。')) return;
    Store.clearLocalData();
    renderMarkers();
    renderLegend();
    showToast('本地数据已清空', 'success');
  }

  function setupEvents() {
    document.querySelectorAll('.city-tab').forEach(tab => {
      tab.addEventListener('click', () => switchCity(tab.dataset.city));
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
      renderMarkers(e.target.value);
    });

    document.getElementById('closeSidebar').addEventListener('click', closeSidebar);

    const collapseBtn = document.getElementById('collapsePanelBtn');
    collapseBtn.addEventListener('click', () => {
      document.body.classList.toggle('panel-collapsed');
    });

    const menuBtn = document.getElementById('menuBtn');
    const menuDropdown = document.getElementById('menuDropdown');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => menuDropdown.classList.remove('show'));

    document.getElementById('refreshMenuBtn').addEventListener('click', async () => {
      await Store.refresh();
      renderMarkers();
      renderLegend();
      showToast('数据已刷新', 'success');
    });

    document.getElementById('exportMenuBtn').addEventListener('click', exportData);
    document.getElementById('clearLocalMenuBtn').addEventListener('click', clearLocalData);
    document.getElementById('addForm').addEventListener('submit', submitRecommendation);
    document.getElementById('searchAddrBtn').addEventListener('click', performAddressSearch);
    document.getElementById('pickMapBtn').addEventListener('click', enterPickMode);
    document.getElementById('cancelPickBtn').addEventListener('click', exitPickMode);
    setupStarPicker();

    document.getElementById('legendHeader').addEventListener('click', () => {
      document.getElementById('legend').classList.toggle('collapsed');
    });

    // 阻止侧边栏内部点击冒泡到地图
    document.getElementById('sidebar').addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  function showToast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.className = 'toast ' + type;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  }

  async function init() {
    initMap();
    renderLogo();
    await Store.load();
    renderMarkers();
    renderLegend();
    setupEvents();
  }

  window.__showDetail = showSidebar;
  window.__addWantToGo = addWantToGo;
  window.__addComment = addComment;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
