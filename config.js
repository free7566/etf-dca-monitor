/**
 * ============================================================
 *  config.js — 四资产场内ETF动态定投监控系统 全局配置文件
 * ============================================================
 *  用户可自由修改本文件中的所有参数，无需改动业务逻辑代码。
 *  修改后刷新页面即可生效。
 *  所有金额单位为人民币元，百分比为小数（0.10 = 10%）。
 * ============================================================
 */

const CONFIG = {
  // ==================== 项目基本信息 ====================
  appName: '四资产ETF动态定投可视化监控系统',
  appVersion: '1.0.0',

  // ==================== 每月定投总额（元） ====================
  monthlyTotal: 8000,

  // ==================== 监控标的定义 ====================
  // code: 场内ETF代码, market: 0=深圳 1=上海, name: 简称
  // eastmoneySecId: 东方财富接口 secid 格式
  assets: [
    {
      code: '511580',
      market: 1,
      name: '0-3年国债政金债ETF',
      shortName: '短债固收',
      type: 'bond',
      color: '#3B82F6',       // 蓝色系 — 固收
      colorHex: 'blue',
      eastmoneySecId: '1.511580',
      eastmoneyFundCode: '511580'
    },
    {
      code: '512890',
      market: 1,
      name: '中证红利低波动ETF',
      shortName: '红利低波',
      type: 'dividend',
      color: '#10B981',       // 绿色系 — 红利
      colorHex: 'green',
      eastmoneySecId: '1.512890',
      eastmoneyFundCode: '512890',
      // 红利低波跟踪指数
      indexCode: 'H30269',    // 中证红利低波动指数
      indexName: '红利低波'
    },
    {
      code: '513100',
      market: 1,
      name: '国泰纳斯达克100ETF',
      shortName: '纳指100',
      type: 'nasdaq',
      color: '#F59E0B',       // 橙黄系 — 科技成长
      colorHex: 'amber',
      eastmoneySecId: '1.513100',
      eastmoneyFundCode: '513100'
    },
    {
      code: '518880',
      market: 1,
      name: '华安黄金ETF',
      shortName: '黄金',
      type: 'gold',
      color: '#F97316',       // 橙色 — 黄金
      colorHex: 'orange',
      eastmoneySecId: '1.518880',
      eastmoneyFundCode: '518880'
    }
  ],

  // ==================== 长期目标基准仓位（每年12月底再平衡） ====================
  targetAllocation: {
    '511580': 0.10,  // 短债 10%
    '512890': 0.40,  // 红利低波 40%
    '513100': 0.35,  // 纳指100 35%
    '518880': 0.15   // 黄金 15%
  },

  // ==================== 中性估值区间基准月分配（元） ====================
  baseAllocation: {
    '511580': 800,
    '512890': 3200,
    '513100': 2800,
    '518880': 1200
  },

  // ==================== 纳指100 513100 估值判定阈值 ====================
  nasdaq: {
    // PE-TTM 阈值
    peBubble: 40,          // ≥40 极端泡沫
    peOvervalued: 34,      // ≥34 高估
    peReasonableHigh: 34,  // 合理区间上界（不含）
    peReasonableLow: 25,   // 合理区间下界（含）
    peUndervalued: 25,     // <25 深度低估

    // PE 十年历史分位阈值（%）
    percentileBubble: 90,          // >90% 极端泡沫
    percentileOvervalued: 75,      // >75% 高估
    percentileNeutralLow: 30,      // ≥30% 合理下界
    percentileUndervalued: 30,     // <30% 深度低估

    // 高估区间月分配方案（短债800、红利5200、纳指0、黄金2000）
    overvaluedAllocation: {
      '511580': 800,
      '512890': 5200,
      '513100': 0,
      '518880': 2000
    },

    // 深度低估区间月分配方案（短债0、红利3200、纳指4800、黄金0）
    undervaluedAllocation: {
      '511580': 0,
      '512890': 3200,
      '513100': 4800,
      '518880': 0
    },

    // 极端泡沫 — 减仓建议（减持20%-40%）
    bubbleReduceMin: 0.20,
    bubbleReduceMax: 0.40,

    // 纳指回撤手动加仓规则
    drawdownRules: [
      { threshold: 0.12, amount: 1500, label: '较高点回撤12%，手动加仓1500元' },
      { threshold: 0.18, amount: 2500, label: '较高点回撤18%，手动加仓2500元' },
      { threshold: 0.25, amount: 0,    label: '较高点回撤25%，自动恢复每月2800定投', restoreDCA: true }
    ],

    // 禁止回撤加仓阈值（PE分位过高不回撤加仓）
    noDrawdownBuyPercentile: 70
  },

  // ==================== 红利低波 512890 估值判定阈值 ====================
  dividend: {
    // PB 十年分位阈值（%）
    pbPercentileOvervalued: 80,    // >80% 高估
    pbPercentileNeutralHigh: 80,   // 中性区间上界
    pbPercentileNeutralLow: 20,    // 中性区间下界
    pbPercentileUndervalued: 20,   // <20% 深度低估

    // 股息率阈值（%）
    dividendYieldOvervalued: 4.3,  // <4.3% 高估（股息率低 = 价格高）
    dividendYieldNeutralLow: 4.3,  // 中性下界
    dividendYieldNeutralHigh: 5.5, // 中性上界
    dividendYieldUndervalued: 5.5, // >5.5% 深度低估（股息率高 = 价格低）

    // 高估区间月分配减半 → 1600，分流短债+320、黄金+1280
    overvaluedAllocation: {
      '511580': 1120,
      '512890': 1600,
      '513100': 2800,
      '518880': 2480
    },

    // 深度低估区间提升月分配
    undervaluedAllocation: {
      '511580': 0,
      '512890': 5200,
      '513100': 2800,
      '518880': 0
    }
  },

  // ==================== 黄金 518880 估值判定阈值 ====================
  gold: {
    // 近3个月涨幅阈值
    bubbleGain: 0.20,          // >20% 高位泡沫，暂停定投
    hedgeAllocation: 2000,     // 美股高估对冲行情月分配

    // 高位泡沫月分配方案（暂停黄金定投，资金分流）
    bubbleAllocation: {
      '511580': 1200,
      '512890': 4000,
      '513100': 2800,
      '518880': 0
    }
  },

  // ==================== 短债 511580 固定规则 ====================
  bond: {
    // 最低持仓占比（任何场景不得低于总组合5%）
    minPortfolioRatio: 0.05,
    // 基准月分配
    baseMonthlyAllocation: 800
  },

  // ==================== 大跌加仓缓冲规则 ====================
  drawdownBuffer: {
    // 分层加仓纪律
    tier1: {
      maxDrawdown: 0.15,
      rule: '仅使用当月新增8000定投资金加仓，不动用短债',
      useBond: false
    },
    tier2: {
      minDrawdown: 0.15,
      maxDrawdown: 0.25,
      rule: '分批少量卖出短债加仓，单次抛售不超过总组合3%',
      useBond: true,
      maxBondSellRatio: 0.03
    },
    tier3: {
      minDrawdown: 0.25,
      rule: '最多动用一半短债底仓，永久保留≥5%短债保底',
      useBond: true,
      maxBondSellRatio: 0.50,
      minBondRemaining: 0.05
    }
  },

  // ==================== 年度再平衡规则 ====================
  rebalance: {
    // 偏离阈值：单资产偏离目标±15%则触发强制调仓
    deviationThreshold: 0.15,
    // 再平衡提醒起始日期（月-日）
    reminderStart: '12-01',
    reminderEnd: '12-31'
  },

  // ==================== 自动刷新设置 ====================
  refresh: {
    defaultInterval: 300000,  // 默认5分钟
    options: [
      { label: '5分钟', value: 300000 },
      { label: '10分钟', value: 600000 },
      { label: '30分钟', value: 1800000 }
    ]
  },

  // ==================== API 接口配置 ====================
  apis: {
    // 东方财富实时行情 API（支持 CORS）
    eastmoneyQuote: 'https://push2.eastmoney.com/api/qt/stock/get',
    // 东方财富基金估值 API
    eastmoneyFund: 'https://fundgz.1234567.com.cn/js',
    // 新浪财经实时行情（JSONP 备用）
    sinaQuote: 'https://hq.sinajs.cn/list',
    // 中证指数估值数据
    csindex: 'https://www.csindex.com.cn/csindex-home/perf/index-perf',
    // 国际金价（美元/盎司）
    goldSpot: 'https://api.gold-api.com/price/XAU',
    // 免费的美股估值数据（通过第三方代理）
    nasdaqPE: 'https://api.nasdaq.com/api/quote/QQQ/info'
  },

  // ==================== 本地缓存键名 ====================
  storageKeys: {
    holdings: 'etf_dca_holdings',      // 持仓股数
    extraCash: 'etf_dca_extra_cash',   // 额外备用现金
    lastData: 'etf_dca_last_data',     // 上次完整数据缓存
    lastUpdate: 'etf_dca_last_update', // 最后更新时间
    theme: 'etf_dca_theme'             // 主题偏好
  },

  // ==================== 配色主题 ====================
  colors: {
    undervalued: '#22C55E',  // 绿色 — 低估/加仓
    neutral: '#EAB308',      // 黄色 — 中性正常
    overvalued: '#EF4444',   // 红色 — 高估/减仓
    bond: '#3B82F6',         // 蓝色 — 短债固收
    gold: '#F97316',         // 橙色 — 黄金
    bgDark: '#0F172A',       // 深色背景
    bgLight: '#F8FAFC',      // 浅色背景
    cardDark: '#1E293B',     // 深色卡片
    cardLight: '#FFFFFF',    // 浅色卡片
    textDark: '#F1F5F9',     // 深色文字
    textLight: '#1E293B'     // 浅色文字
  }
};

// 防止意外修改
Object.freeze(CONFIG);
Object.freeze(CONFIG.assets);
Object.freeze(CONFIG.targetAllocation);
Object.freeze(CONFIG.baseAllocation);
Object.freeze(CONFIG.nasdaq);
Object.freeze(CONFIG.nasdaq.overvaluedAllocation);
Object.freeze(CONFIG.nasdaq.undervaluedAllocation);
Object.freeze(CONFIG.dividend);
Object.freeze(CONFIG.dividend.overvaluedAllocation);
Object.freeze(CONFIG.dividend.undervaluedAllocation);
Object.freeze(CONFIG.gold);
Object.freeze(CONFIG.gold.bubbleAllocation);
Object.freeze(CONFIG.refresh.options);
Object.freeze(CONFIG.colors);
