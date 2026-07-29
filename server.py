#!/usr/bin/env python3
"""
茶蛋点评 · 美食地图 — 后端服务器
支持多城市：广州 / 深圳 / 佛山
提供静态文件服务 + REST API 数据端口
"""

import json
import os
import time
import urllib.request
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLE_FILE = os.path.join(BASE_DIR, 'sample-data.json')

CITIES = ['guangzhou', 'shenzhen', 'foshan']
CITY_NAMES = {
    'guangzhou': '广州',
    'shenzhen': '深圳',
    'foshan': '佛山',
}

# 城市中心坐标（WGS84，用于搜索位置偏向）
CITY_CENTERS = {
    'guangzhou': (23.1291, 113.2644),
    'shenzhen': (22.5431, 114.0579),
    'foshan': (23.0218, 113.1219),
}

PERSON_COLORS = [
    '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6', '#F39C12',
    '#1ABC9C', '#E91E63', '#795548', '#607D8B', '#FF5722',
    '#00BCD4', '#8BC34A',
]


def data_file(city):
    return os.path.join(BASE_DIR, f'data_{city}.json')


def load_data(city):
    path = data_file(city)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"persons": {}, "spots": [], "lastModified": time.time()}


def save_data(data, city):
    data['lastModified'] = time.time()
    with open(data_file(city), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def assign_color(data, name):
    if name not in data['persons']:
        used = set(data['persons'].values())
        for c in PERSON_COLORS:
            if c not in used:
                data['persons'][name] = c
                return c
        data['persons'][name] = PERSON_COLORS[len(data['persons']) % len(PERSON_COLORS)]
    return data['persons'][name]


def parse_dishes(raw):
    if isinstance(raw, list):
        return [d.strip() for d in raw if d.strip()]
    if not raw:
        return []
    for sep in [',', '，', '、', '\n']:
        raw = raw.replace(sep, '\x00')
    return [d.strip() for d in raw.split('\x00') if d.strip()]


def add_entry(data, entry):
    name = (entry.get('name') or '').strip()
    person = (entry.get('person') or '').strip()
    dishes = parse_dishes(entry.get('dishes', ''))
    review = (entry.get('review') or '').strip()
    rating = max(1, min(5, int(entry.get('rating', 5))))
    category = entry.get('category', '其他')
    address = (entry.get('address') or '').strip()
    lat = float(entry.get('lat', 0) or 0)
    lng = float(entry.get('lng', 0) or 0)

    if not name:
        raise ValueError('餐厅名称不能为空')
    if not person:
        raise ValueError('推荐人不能为空')

    assign_color(data, person)

    price = entry.get('price')
    try:
        price = int(float(price)) if price else 0
    except (ValueError, TypeError):
        price = 0

    rec = {
        'person': person,
        'dishes': dishes,
        'review': review,
        'rating': rating,
        'price': price,
        'date': time.strftime('%Y-%m-%d'),
    }

    # 查找已有同名店铺
    existing = None
    for s in data['spots']:
        if s['name'] == name:
            existing = s
            break

    if existing:
        existing['recommendations'].append(rec)
        if address and not existing.get('address'):
            existing['address'] = address
        return {'status': 'ok', 'action': 'added_rec', 'spot': existing}
    else:
        if lat == 0 and lng == 0:
            raise ValueError('新餐厅需要在地图上设置位置')
        new_id = max([s['id'] for s in data['spots']], default=0) + 1
        spot = {
            'id': new_id,
            'name': name,
            'address': address,
            'lat': lat,
            'lng': lng,
            'category': category,
            'recommendations': [rec],
            'wantToGo': [],
        }
        data['spots'].append(spot)
        return {'status': 'ok', 'action': 'added_spot', 'spot': spot}


def toggle_want_to_go(data, spot_id, name):
    """切换某人的"想去"状态：已在列表中则移除，不在则添加"""
    spot = None
    for s in data['spots']:
        if s['id'] == spot_id:
            spot = s
            break
    if not spot:
        raise ValueError('找不到该餐厅')

    if 'wantToGo' not in spot or spot['wantToGo'] is None:
        spot['wantToGo'] = []

    if name in spot['wantToGo']:
        spot['wantToGo'].remove(name)
        return {'status': 'ok', 'action': 'removed', 'wantToGo': spot['wantToGo']}
    else:
        spot['wantToGo'].append(name)
        return {'status': 'ok', 'action': 'added', 'wantToGo': spot['wantToGo']}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def _get_city(self, query):
        city = query.get('city', ['guangzhou'])[0]
        if city not in CITIES:
            city = 'guangzhou'
        return city

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == '/api/data':
            city = self._get_city(query)
            data = load_data(city)
            data['city'] = city
            self._json(200, data)
        elif path == '/api/health':
            counts = {}
            for c in CITIES:
                counts[c] = len(load_data(c)['spots'])
            self._json(200, {'status': 'ok', 'cities': counts})
        elif path == '/api/search':
            self._handle_search(query)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == '/api/add':
            self._handle_add(query)
        elif path == '/api/want-to-go':
            self._handle_want_to_go(query)
        elif path == '/api/sample':
            self._handle_sample(query)
        elif path == '/api/reset':
            city = self._get_city(query)
            save_data({"persons": {}, "spots": [], "lastModified": time.time()}, city)
            self._json(200, {'status': 'ok', 'city': city})
        elif path == '/api/import':
            self._handle_import(query)
        else:
            self.send_response(404)
            self.end_headers()

    def _handle_add(self, query):
        try:
            body = self._read_body()
            city = body.get('city') or self._get_city(query)
            if city not in CITIES:
                city = 'guangzhou'
            data = load_data(city)
            result = add_entry(data, body)
            save_data(data, city)
            self._json(200, result)
        except Exception as e:
            self._json(400, {'status': 'error', 'message': str(e)})

    def _handle_want_to_go(self, query):
        try:
            body = self._read_body()
            city = body.get('city') or self._get_city(query)
            if city not in CITIES:
                city = 'guangzhou'
            spot_id = int(body.get('spotId', 0))
            name = (body.get('name') or '').strip()
            if not name:
                raise ValueError('请输入你的名字')
            data = load_data(city)
            # 确保推荐人颜色池中有此人（方便颜色一致）
            assign_color(data, name)
            result = toggle_want_to_go(data, spot_id, name)
            save_data(data, city)
            self._json(200, result)
        except Exception as e:
            self._json(400, {'status': 'error', 'message': str(e)})

    def _handle_sample(self, query):
        city = self._get_city(query)
        if city == 'guangzhou' and os.path.exists(SAMPLE_FILE):
            with open(SAMPLE_FILE, 'r', encoding='utf-8') as f:
                sample = json.load(f)
            save_data(sample, city)
            self._json(200, {'status': 'ok', 'count': len(sample['spots']), 'city': city})
        else:
            # 非广州城市无示例数据，返回空
            save_data({"persons": {}, "spots": [], "lastModified": time.time()}, city)
            self._json(200, {'status': 'ok', 'count': 0, 'city': city, 'message': '该城市暂无示例数据'})

    def _handle_import(self, query):
        try:
            body = self._read_body()
            city = body.get('city') or self._get_city(query)
            if city not in CITIES:
                city = 'guangzhou'
            if not isinstance(body, dict) or 'spots' not in body:
                raise ValueError('数据格式不正确，需要包含 spots 字段')
            save_data(body, city)
            self._json(200, {'status': 'ok', 'city': city})
        except Exception as e:
            self._json(400, {'status': 'error', 'message': str(e)})

    def _handle_search(self, query):
        """POI 搜索 — 通过 Photon (Komoot) API 搜索餐厅位置"""
        q = query.get('q', [''])[0].strip()
        city = self._get_city(query)
        if not q:
            self._json(200, {'status': 'ok', 'results': []})
            return

        lat, lng = CITY_CENTERS.get(city, (23.1291, 113.2644))
        # Photon API: 免费、无需 key、支持 CORS、返回 WGS84 坐标
        params = urllib.parse.urlencode({
            'q': q,
            'lat': lat,
            'lon': lng,
            'limit': 6,
        })
        url = f'https://photon.komoot.io/api/?{params}'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'ChadaMap/1.0'})
            resp = urllib.request.urlopen(req, timeout=8)
            data = json.loads(resp.read())
            results = []
            for f in data.get('features', []):
                p = f.get('properties', {})
                coords = f.get('geometry', {}).get('coordinates', [0, 0])
                name = p.get('name', '')
                if not name:
                    continue
                # 拼接地址
                addr_parts = []
                for key in ['street', 'housenumber', 'postcode', 'city', 'state']:
                    v = p.get(key, '')
                    if v:
                        addr_parts.append(str(v))
                address = ' '.join(addr_parts) if addr_parts else ''
                results.append({
                    'name': name,
                    'address': address,
                    'lat': coords[1],
                    'lng': coords[0],
                })
            self._json(200, {'status': 'ok', 'results': results})
        except Exception as e:
            self._json(200, {'status': 'ok', 'results': [], 'error': str(e)})

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length).decode('utf-8')
        return json.loads(raw)

    def _json(self, code, payload):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode('utf-8'))

    def log_message(self, fmt, *args):
        msg = args[0] if args else ''
        if '/api/' in str(msg):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    PORT = 8080
    print('')
    print('  ====================================')
    print('  \U0001F375 茶蛋点评 · 美食地图服务器')
    print('  ====================================')
    print(f'  \U0001F310 网页界面  http://127.0.0.1:{PORT}')
    print(f'  \U0001F38D 支持城市  广州 / 深圳 / 佛山')
    print(f'  \U0001F4E1 数据端口  GET  /api/data?city=guangzhou')
    print(f'  \U0001F4E4 提交端口  POST /api/add (body含city字段)')
    print(f'  \U0001F504 示例数据  POST /api/sample?city=guangzhou')
    print(f'  \u274C 重置端口  POST /api/reset?city=guangzhou')
    print('  ------------------------------------')
    print('  \U0001F4A1 提交示例:')
    print(f'  curl -X POST http://127.0.0.1:{PORT}/api/add \\')
    print('    -H "Content-Type: application/json" \\')
    print('    -d \'{"city":"guangzhou","name":"测试餐厅","person":"小明","dishes":"虾饺","review":"好吃","lat":23.13,"lng":113.26,"category":"粤菜"}\'')
    print('  ====================================')
    print('')
    server = HTTPServer(('127.0.0.1', PORT), Handler)
    server.serve_forever()
