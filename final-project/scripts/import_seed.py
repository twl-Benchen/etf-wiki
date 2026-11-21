"""把舊資料 (CSV/JSON) 轉成本專案的資料格式。只在初次建立資料時使用。
用法: python scripts/import_seed.py <assets 資料夾>
之後的更新改用 scripts/fetch_prices.py 與 scripts/fetch_daily.py。"""
import csv, json, sys, os, shutil
SRC = sys.argv[1]; ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); D = os.path.join(ROOT, 'data')
UNIVERSE = ['0050', '006208', '0056', '00878', '00919']
TYPES = {'0050': '市值型', '006208': '市值型', '0056': '高股息', '00878': '高股息', '00919': '高股息'}
COLORS = {'0050': '#1f6fd6', '006208': '#8a63d2', '0056': '#e47b24', '00878': '#17a06c', '00919': '#d6417f'}
# 公司主檔: 名稱 -> (代號, 市場, 產業)
CO = {'台積電': ('2330', 'TWSE', '半導體業'), '聯發科': ('2454', 'TWSE', '半導體業'), '聯電': ('2303', 'TWSE', '半導體業'), '聯詠': ('3034', 'TWSE', '半導體業'),
 '瑞昱': ('2379', 'TWSE', '半導體業'), '日月光投控': ('3711', 'TWSE', '半導體業'), '世界': ('5347', 'TPEx', '半導體業'), '群聯': ('8299', 'TPEx', '半導體業'), '力成': ('6239', 'TWSE', '半導體業'),
 '鴻海': ('2317', 'TWSE', '其他電子業'), '台達電': ('2308', 'TWSE', '電子零組件業'), '廣達': ('2382', 'TWSE', '電腦及週邊設備業'), '華碩': ('2357', 'TWSE', '電腦及週邊設備業'),
 '中華電': ('2412', 'TWSE', '通信網路業'), '瑞儀': ('6176', 'TWSE', '光電業'),
 '富邦金': ('2881', 'TWSE', '金融保險業'), '國泰金': ('2882', 'TWSE', '金融保險業'), '中信金': ('2891', 'TWSE', '金融保險業'), '華南金': ('2880', 'TWSE', '金融保險業'),
 '元大金': ('2885', 'TWSE', '金融保險業'), '上海商銀': ('5876', 'TWSE', '金融保險業'),
 '長榮': ('2603', 'TWSE', '航運業'), '陽明': ('2609', 'TWSE', '航運業'), '長榮航': ('2618', 'TWSE', '航運業')}
info = {x['stockNo']: x for x in json.load(open(os.path.join(SRC, 'combined_etf_data.json'), encoding='utf-8'))}
rows = {r['ETF代號']: r for r in csv.DictReader(open(os.path.join(SRC, 'ETF_constituents.csv'), encoding='utf-8-sig'))}
etfs, holdings, used = {}, {}, {}
for k in UNIVERSE:
    i = info[k]; tags = i['tags']
    freq = next((t for t in tags if t.endswith('配') and t != '配息'), None)
    etfs[k] = {'code': k, 'name': i['stockName'], 'type': TYPES[k], 'color': COLORS[k], 'issuer': tags[0], 'listing_date': i['listingDate'].replace('/', '-'),
               'index_name': i['indexName'], 'dividend_freq': freq, 'dividend_months': [int(t[:-1]) for t in tags if t.endswith('月')]}
    v = list(rows[k].values())
    top = [{'name': v[j], 'code': CO[v[j]][0], 'weight': float(v[j + 1])} for j in range(1, 21, 2)]
    holdings[k] = {'top10': top}
    for t in top: used[t['name']] = CO[t['name']]
    src = os.path.join(SRC, 'ETF_History', f'{k}_history.csv')
    with open(src, encoding='utf-8-sig') as f, open(os.path.join(D, 'prices', f'{k}.csv'), 'w', newline='') as g:
        w = csv.writer(g); w.writerow(['date', 'close'])
        for r in csv.DictReader(f): w.writerow([r['date'], r['Close']])
json.dump({'etfs': etfs}, open(os.path.join(D, 'etfs.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump({'as_of': None, 'source': '投信公開的前十大持股 (初始資料，待 scripts/update_holdings 更新)', 'scope': 'top10', 'holdings': holdings}, open(os.path.join(D, 'holdings.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump({'companies': {n: {'code': c, 'market': m, 'industry': ind} for n, (c, m, ind) in used.items()}}, open(os.path.join(D, 'companies.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('etfs', list(etfs), 'companies', len(used))
