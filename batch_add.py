#!/usr/bin/env python3
"""批量搜索餐厅坐标并提交推荐"""
import json, urllib.request, urllib.parse, time

BASE = "http://127.0.0.1:8080"

def search(q, city="guangzhou"):
    """通过 Photon API 搜索餐厅位置"""
    params = urllib.parse.urlencode({"q": q, "city": city})
    try:
        req = urllib.request.Request(f"{BASE}/api/search?{params}")
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read())
        results = data.get("results", [])
        if results:
            return results[0]
    except:
        pass
    return None

def add(city, name, person, **kwargs):
    """提交推荐"""
    entry = {"city": city, "name": name, "person": person}
    entry.update(kwargs)
    data = json.dumps(entry, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/api/add",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        result = json.loads(resp.read())
        action = result.get("action", "?")
        print(f"  {'OK' if result.get('status')=='ok' else 'FAIL'} [{action}] {name} ({person})")
        return result
    except Exception as e:
        print(f"  FAIL {name}: {e}")
        return None

def reset(city):
    """重置城市数据"""
    try:
        req = urllib.request.Request(
            f"{BASE}/api/reset?city={city}",
            method="POST"
        )
        urllib.request.urlopen(req, timeout=5)
        print(f"  Reset {city} done")
    except:
        pass

def main():
    # 1. 重置广州和佛山
    print("=== Resetting cities ===")
    reset("guangzhou")
    reset("foshan")
    time.sleep(0.5)

    # 2. 广州推荐列表
    gz_spots = [
        # 葱葱的推荐
        {"name": "金辉食馆", "person": "葱葱", "address": "同福西", "dishes": "咸蛋鱿鱼", "category": "粤菜"},
        {"name": "穗香食府", "person": "葱葱", "address": "惠福西", "review": "便宜好吃", "category": "粤菜"},
        {"name": "朱仔记", "person": "葱葱", "address": "江南大道南", "review": "创新菜式", "category": "粤菜"},
        {"name": "碗仔翅", "person": "葱葱", "address": "西华路", "category": "小吃"},
        {"name": "天妇罗", "person": "葱葱", "address": "正佳广场", "category": "其他"},
        # 🍃
        {"name": "啫八", "person": "🍃", "category": "粤菜"},
        # 熊
        {"name": "荡失路桑拿鸡煲", "person": "熊", "category": "火锅"},
        # kuku
        {"name": "银灯食府", "person": "kuku", "category": "早茶"},
        # LaVine
        {"name": "侨美", "person": "LaVine", "category": "粤菜"},
        {"name": "丘大·恒仔酒家", "person": "LaVine", "category": "粤菜"},
    ]

    # 佛山推荐列表
    fs_spots = [
        {"name": "小草糖水", "person": "葱葱", "category": "甜品"},
    ]

    # 3. 搜索坐标并提交广州
    print("\n=== Adding Guangzhou recommendations ===")
    for spot in gz_spots:
        # 搜索坐标
        search_q = spot["name"]
        if "address" in spot:
            search_q = spot["name"] + " " + spot["address"]
        result = search(search_q, "guangzhou")
        if result:
            spot["lat"] = result["lat"]
            spot["lng"] = result["lng"]
            if "address" not in spot and result.get("address"):
                spot["address"] = result["address"]
            print(f"  Found: {spot['name']} @ {result['lat']:.5f},{result['lng']:.5f}")
        else:
            print(f"  NOT FOUND: {spot['name']}, using city center")
            spot["lat"] = 23.1291
            spot["lng"] = 113.2644

        add("guangzhou", **spot)
        time.sleep(0.3)

    # 4. 提交佛山
    print("\n=== Adding Foshan recommendations ===")
    for spot in fs_spots:
        result = search(spot["name"], "foshan")
        if result:
            spot["lat"] = result["lat"]
            spot["lng"] = result["lng"]
            if result.get("address"):
                spot["address"] = result["address"]
            print(f"  Found: {spot['name']} @ {result['lat']:.5f},{result['lng']:.5f}")
        else:
            print(f"  NOT FOUND: {spot['name']}, using city center")
            spot["lat"] = 23.0218
            spot["lng"] = 113.1219

        add("foshan", **spot)
        time.sleep(0.3)

    # 5. 验证
    print("\n=== Final data ===")
    for city in ["guangzhou", "foshan"]:
        resp = urllib.request.urlopen(f"{BASE}/api/data?city={city}", timeout=5)
        data = json.loads(resp.read())
        print(f"\n{city}: {len(data['spots'])} spots")
        for s in data["spots"]:
            recs = [r["person"] for r in s["recommendations"]]
            print(f"  - {s['name']} ({s.get('address','')}) ← {', '.join(recs)}")

if __name__ == "__main__":
    main()
