export type LanguageCode = 'en' | 'zh' | 'ms';

export const LANGUAGES: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: 'Simplified Chinese' },
  { code: 'ms', label: 'Bahasa Melayu' },
];

type Dict = Record<string, string>;

const DICT: Record<LanguageCode, Dict> = {
  en: {
    'auth.title': 'Combi 3',
    'auth.subtitle': 'Predict the last 3 digits and ride the next round.',
    'auth.account': 'Account',
    'auth.merchant': 'Merchant ID',
    'auth.password': 'Password',
    'auth.enter': 'Enter Arena',

    'ui.tokenBar': 'Token Bar',
    'ui.cleanTokens': 'Clean Tokens',
    'ui.menu': 'Menu',
    'ui.tapToPlace': 'Tap a bet space to place a token.',
    'ui.digitBets': 'Digit Bets',
    'ui.roundSummary': 'Round Summary',
    'ui.myBets': 'My Bets',
    'ui.recentRounds': 'Recent Rounds',
    'ui.digitWinners': 'Digit winners',
    'ui.hilo': 'Hi-Lo',

    'menu.title': 'Menu',
    'menu.statistics': 'Statistics',
    'menu.settings': 'Settings',
    'menu.chart': 'Chart',
    'menu.bettingHistory': 'Betting History',

    'settings.title': 'Settings',
    'settings.music': 'Music',
    'settings.sounds': 'Sounds',
    'settings.language': 'Language',

    'history.title': 'Betting History',
    'history.prev': 'Prev',
    'history.next': 'Next',

    'stats.title': 'Statistics',
    'stats.last9': 'Last 9 rounds',
    'stats.last16': 'Last 16 (Small / Triple / Big)',
    'stats.dist': 'Last 16 distribution',
    'stats.small': 'SMALL',
    'stats.big': 'BIG',
    'stats.triple': 'TRIPLE',

    'chart.title': 'Chart',

    'hilo.up': 'UP',
    'hilo.down': 'DOWN',

    'scene.roundPrefix': 'ROUND',
    'scene.connecting': 'CONNECTING',
    'scene.betsOpen': 'BETS OPEN',
    'scene.locked': 'LOCKED',
    'scene.bitcoinPrice': 'BITCOIN PRICE',
    'scene.placeBets': 'PLACE YOUR BETS',
    'scene.lockedPrice': 'LOCKED PRICE',
    'scene.walletBalance': 'WALLET BALANCE',
    'scene.roundResult': 'ROUND RESULT',
    'scene.youWin': 'YOU WIN!',
    'scene.push': 'PUSH',
    'scene.skippedRound': 'SKIPPED ROUND',
    'scene.noBetsPlaced': 'No Bets Placed',
    'scene.payout': 'PAYOUT',
    'scene.calculating': 'CALCULATING...',
    'scene.lockedLabel': 'LOCKED',
    'scene.finalLabel': 'FINAL',
  },
  zh: {
    'auth.title': 'Combi 3',
    'auth.subtitle': '预测最后 3 位数字，赢下下一轮。',
    'auth.account': '账号',
    'auth.merchant': '商户 ID',
    'auth.password': '密码',
    'auth.enter': '进入',

    'ui.tokenBar': '筹码',
    'ui.cleanTokens': '清除筹码',
    'ui.menu': '菜单',
    'ui.tapToPlace': '点选下注区域放置筹码。',
    'ui.digitBets': '数字下注',
    'ui.roundSummary': '回合总结',
    'ui.myBets': '我的下注',
    'ui.recentRounds': '最近回合',
    'ui.digitWinners': '数字中奖',
    'ui.hilo': '涨跌',

    'menu.title': '菜单',
    'menu.statistics': '统计',
    'menu.settings': '设置',
    'menu.chart': '图表',
    'menu.bettingHistory': '投注记录',

    'settings.title': '设置',
    'settings.music': '音乐',
    'settings.sounds': '音效',
    'settings.language': '语言',

    'history.title': '投注记录',
    'history.prev': '上一页',
    'history.next': '下一页',

    'stats.title': '统计',
    'stats.last9': '最近 9 回合',
    'stats.last16': '最近 16（小 / 豹子 / 大）',
    'stats.dist': '最近 16 分布',
    'stats.small': '小',
    'stats.big': '大',
    'stats.triple': '豹子',

    'chart.title': '图表',

    'hilo.up': '涨',
    'hilo.down': '跌',

    'scene.roundPrefix': '回合',
    'scene.connecting': '连接中',
    'scene.betsOpen': '可下注',
    'scene.locked': '已锁定',
    'scene.bitcoinPrice': '比特币价格',
    'scene.placeBets': '请下注',
    'scene.lockedPrice': '锁定价',
    'scene.walletBalance': '钱包余额',
    'scene.roundResult': '回合结果',
    'scene.youWin': '你赢了！',
    'scene.push': '平局',
    'scene.skippedRound': '跳过回合',
    'scene.noBetsPlaced': '未下注',
    'scene.payout': '派彩',
    'scene.calculating': '计算中...',
    'scene.lockedLabel': '锁定',
    'scene.finalLabel': '最终',
  },
  ms: {
    'auth.title': 'Combi 3',
    'auth.subtitle': 'Ramalkan 3 digit terakhir dan sertai pusingan seterusnya.',
    'auth.account': 'Akaun',
    'auth.merchant': 'ID Pedagang',
    'auth.password': 'Kata laluan',
    'auth.enter': 'Masuk',

    'ui.tokenBar': 'Token',
    'ui.cleanTokens': 'Kosongkan Token',
    'ui.menu': 'Menu',
    'ui.tapToPlace': 'Ketik ruang taruhan untuk letak token.',
    'ui.digitBets': 'Taruhan Digit',
    'ui.roundSummary': 'Ringkasan Pusingan',
    'ui.myBets': 'Taruhan Saya',
    'ui.recentRounds': 'Pusingan Terkini',
    'ui.digitWinners': 'Pemenang digit',
    'ui.hilo': 'Naik/Turun',

    'menu.title': 'Menu',
    'menu.statistics': 'Statistik',
    'menu.settings': 'Tetapan',
    'menu.chart': 'Carta',
    'menu.bettingHistory': 'Sejarah Taruhan',

    'settings.title': 'Tetapan',
    'settings.music': 'Muzik',
    'settings.sounds': 'Bunyi',
    'settings.language': 'Bahasa',

    'history.title': 'Sejarah Taruhan',
    'history.prev': 'Sebelum',
    'history.next': 'Seterusnya',

    'stats.title': 'Statistik',
    'stats.last9': '9 pusingan terakhir',
    'stats.last16': '16 terakhir (Kecil / Triple / Besar)',
    'stats.dist': 'Agihan 16 terakhir',
    'stats.small': 'KECIL',
    'stats.big': 'BESAR',
    'stats.triple': 'TRIPLE',

    'chart.title': 'Carta',

    'hilo.up': 'NAIK',
    'hilo.down': 'TURUN',

    'scene.roundPrefix': 'PUSINGAN',
    'scene.connecting': 'MENYAMBUNG',
    'scene.betsOpen': 'TARUHAN DIBUKA',
    'scene.locked': 'DIKUNCI',
    'scene.bitcoinPrice': 'HARGA BITCOIN',
    'scene.placeBets': 'LETak TARUHAN',
    'scene.lockedPrice': 'HARGA DIKUNCI',
    'scene.walletBalance': 'BAKI DOMPET',
    'scene.roundResult': 'KEPUTUSAN PUSINGAN',
    'scene.youWin': 'ANDA MENANG!',
    'scene.push': 'SERi',
    'scene.skippedRound': 'PUSINGAN DILANGKAU',
    'scene.noBetsPlaced': 'Tiada taruhan',
    'scene.payout': 'BAYARAN',
    'scene.calculating': 'MENGIRA...',
    'scene.lockedLabel': 'DIKUNCI',
    'scene.finalLabel': 'AKHIR',
  },
};

export function getInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';

  const raw = window.localStorage.getItem('language');
  if (raw === 'en' || raw === 'zh' || raw === 'ms') return raw;

  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  const first = (langs?.[0] ?? 'en').toLowerCase();
  if (first.startsWith('zh')) return 'zh';
  if (first.startsWith('ms')) return 'ms';
  return 'en';
}

export function setLanguage(lang: LanguageCode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('language', lang);
  window.dispatchEvent(new CustomEvent('app:language', { detail: lang }));
}

export function t(lang: LanguageCode, key: string, params?: Record<string, string | number>) {
  const template = DICT[lang]?.[key] ?? DICT.en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    params[k] === undefined ? `{${k}}` : String(params[k]),
  );
}

