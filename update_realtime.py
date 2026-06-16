"""
update_realtime.py — 四资产ETF实时行情更新脚本
==============================================
每30分钟运行一次，拉取4只ETF最新价格，写入 data.json
前端 index.html 直接读取 data.json（同源无CORS问题）

数据流：
  Tencent API → ETF最新2条K线 → 计算价格/涨跌幅
  乐咕乐股 API → 纳指PE/分位
  Gold API → 国际金价
  → 写入 data.json → git push（有变化时）

使用方式：
  python update_realtime.py           # 正常运行
  python update_realtime.py --no-push # 只更新JSON，不push
  python update_realtime.py --init    # 首次初始化（创建完整data.json）
"""
import json
import os
import sys
import time
import subprocess
import urllib.request

# ============ 四资产ETF配置 ============
ETFS = [
    {"code": "511580", "name": "国债政金债ETF", "short_name": "短债固收", "prefix": "sh", "type": "bond"},
    {"code": "512890", "name": "红利低波ETF", "short_name": "红利低波", "prefix": "sh", "type": "dividend"},
    {"code": "513100", "name": "纳指ETF", "short_name": "纳指100", "prefix": "sh", "type": "nasdaq"},
    {"code": "518880", "name": "黄金ETF", "short_name": "黄金", "prefix": "sh", "type": "gold"},
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(SCRIPT_DIR, 'data.json')

# ============ 数据获取 ============
def fetch_etf_price(code, prefix):
    """从腾讯API获取ETF最新2条K线
    返回: {
        price, prev_close, change_pct, date,
        high, low, volume, name
    }
    """
    full_code = f"{prefix}{code}"
    try:
        url = f'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={full_code},day,,,2,qfq'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=15)
        data = json.loads(resp.read().decode('utf-8'))

        stock_data = data.get('data', {}).get(full_code, {})
        klines = stock_data.get('qfqday', stock_data.get('day', []))

        if not klines or len(klines) < 1:
            return None

        latest = klines[-1]
        date_str = latest[0]         # "2026-06-16"
        price = float(latest[2])     # 收盘价

        if len(klines) >= 2:
            prev_close = float(klines[-2][2])
            change_pct = round((price - prev_close) / prev_close * 100, 2)
        else:
            prev_close = price
            change_pct = 0.0

        high = float(latest[3]) if len(latest) > 3 else price
        low = float(latest[4]) if len(latest) > 4 else price
        volume = float(latest[5]) if len(latest) > 5 else 0

        # 用qt数组获取name
        qt = stock_data.get('qt', {}).get(full_code, [])
        name = qt[1] if len(qt) > 1 else code

        return {
            'price': round(price, 4),
            'prev_close': round(prev_close, 4),
            'change_pct': change_pct,
            'date': date_str,
            'high': round(high, 4),
            'low': round(low, 4),
            'volume': int(volume),
            'name': name,
        }
    except Exception as e:
        print(f"  ⚠ 腾讯 {full_code} 失败: {str(e)[:80]}")
        return None

def fetch_nasdaq_pe():
    """获取纳指PE和分位（乐咕乐股API）
    返回: { nasdaq_pe, nasdaq_percentile } 或 {}
    """
    try:
        # 尝试乐咕乐股
        url = 'https://legulegu.com/stockdata/nasdaq-pe-ttm'
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://legulegu.com/'
        })
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode('utf-8'))

        if isinstance(data, list) and len(data) > 0:
            latest = data[-1]
            pe = float(latest.get('pe', 0))
            pct = float(latest.get('quantile', latest.get('percentile', 50)))
            return {'nasdaq_pe': round(pe, 2), 'nasdaq_percentile': round(pct, 2)}
    except Exception:
        pass

    # 备用：新浪获取纳指实时点位（用于前端显示，非PE数据）
    try:
        url = 'https://hq.sinajs.cn/list=int_nasdaq'
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://finance.sina.com.cn/'
        })
        resp = urllib.request.urlopen(req, timeout=10)
        text = resp.read().decode('gbk')
        # 格式: var hq_str_int_nasdaq="纳斯达克,22484.07,99.37,0.44";
        parts = text.split('"')[1].split(',')
        if len(parts) >= 2:
            return {'nasdaq_price': float(parts[1]), 'nasdaq_price_change': float(parts[2])}
    except Exception:
        pass

    return {}

def fetch_gold_price():
    """获取国际现货金价（多源备用）
    返回: { gold_price_usd, gold_price_cny } 或 {}
    """
    try:
        url = 'https://api.gold-api.com/price/XAU'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read().decode('utf-8'))
        if data and data.get('price'):
            usd = float(data['price'])
            return {
                'gold_price_usd': round(usd, 2),
                'gold_price_cny': round(usd * 7.25, 2),
            }
    except Exception:
        pass

    # 备用：新浪黄金现货
    try:
        url = 'https://hq.sinajs.cn/list=hf_XAU'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.sina.com.cn/'})
        resp = urllib.request.urlopen(req, timeout=10)
        text = resp.read().decode('gbk')
        parts = text.split('"')[1].split(',')
        if len(parts) > 1:
            usd = float(parts[2]) if len(parts) > 2 else 0
            if usd > 0:
                return {'gold_price_usd': round(usd, 2), 'gold_price_cny': round(usd * 7.25, 2)}
    except Exception:
        pass

    return {}

# ============ JSON 更新 ============
def build_data_json():
    """构建完整 data.json 结构"""
    from datetime import datetime

    etfs_data = []
    for etf in ETFS:
        result = fetch_etf_price(etf['code'], etf['prefix'])
        entry = {
            'code': etf['code'],
            'name': etf['name'],
            'short_name': etf['short_name'],
            'type': etf['type'],
        }
        if result:
            entry.update(result)
            print(f"  ✓ {etf['code']} {etf['short_name']}: ¥{result['price']} ({'+' if result['change_pct'] >= 0 else ''}{result['change_pct']}%)")
        else:
            print(f"  ✗ {etf['code']} {etf['short_name']}: 获取失败")
            entry['price'] = None
            entry['change_pct'] = 0

        etfs_data.append(entry)

    # 纳指PE/分位
    print(f"\n--- 估值数据 ---")
    nasdaq_pe_data = fetch_nasdaq_pe()
    if nasdaq_pe_data:
        print(f"  ✓ 纳指PE: {nasdaq_pe_data.get('nasdaq_pe')}, 分位: {nasdaq_pe_data.get('nasdaq_percentile')}%")
        # 合并到纳指ETF数据
        for e in etfs_data:
            if e['code'] == '513100':
                e.update(nasdaq_pe_data)

    # 黄金价格
    gold_data = fetch_gold_price()
    if gold_data:
        print(f"  ✓ 国际金价: ${gold_data.get('gold_price_usd')}/oz")
        for e in etfs_data:
            if e['code'] == '518880':
                e.update(gold_data)

    data = {
        'update_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'market_status': 'closed',  # 'trading' / 'closed' / 'pre'
        'etfs': etfs_data,
    }
    return data

def write_json(data, filepath):
    """写入JSON文件，如果有变化返回True"""
    new_json = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)

    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            old_json = f.read()
        if old_json == new_json:
            return False

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_json)
    return True

# ============ Git Push ============
def git_push():
    """提交并推送JSON到GitHub"""
    print(f"\n--- Git Push ---")
    try:
        result = subprocess.run(
            ['git', 'status', '--porcelain', 'data.json'],
            capture_output=True, text=True, cwd=SCRIPT_DIR
        )
        if not result.stdout.strip():
            print("  没有数据变更，跳过push")
            return

        subprocess.run(['git', 'add', 'data.json'], cwd=SCRIPT_DIR, check=True)
        from datetime import datetime
        now = datetime.now().strftime('%Y-%m-%d %H:%M')
        subprocess.run(
            ['git', 'commit', '-m', f'🔄 实时行情更新 {now}'],
            cwd=SCRIPT_DIR, check=True
        )

        for attempt in range(3):
            try:
                subprocess.run(['git', 'push'], cwd=SCRIPT_DIR, check=True, timeout=60)
                print(f"  ✓ Push成功!")
                return
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                if attempt < 2:
                    wait = 10 * (attempt + 1)
                    print(f"  ⚠ Push第{attempt+1}次失败，{wait}秒后重试...")
                    time.sleep(wait)
                else:
                    raise
    except Exception as e:
        print(f"  ✗ Git操作失败: {str(e)[:80]}")

# ============ 主程序 ============
def main():
    from datetime import datetime
    no_push = '--no-push' in sys.argv

    print(f"[{datetime.now()}] ========== 四资产ETF实时行情更新 ==========")
    if no_push:
        print("模式: 仅更新JSON（不push）")

    # 1. 拉取数据并构建JSON
    data = build_data_json()

    # 2. 写入本地
    changed = write_json(data, DATA_FILE)
    if changed:
        print(f"\n✓ data.json 已更新 ({len(data['etfs'])} 只ETF)")
        # 3. Git push（有变化时）
        if not no_push:
            git_push()
        else:
            print("(跳过push)")
    else:
        print("\n数据无变化，跳过更新")

    print(f"完成: {datetime.now()}")

if __name__ == "__main__":
    main()
