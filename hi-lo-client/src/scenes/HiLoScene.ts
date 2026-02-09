import Phaser from 'phaser';
import type {
  DigitBetType,
  GameConfig,
  PriceUpdate,
  RoundLockPayload,
  RoundResultPayload,
  RoundStatePayload,
} from '../types';
import { getInitialLanguage, t, type LanguageCode } from '../i18n';
import { setStatus } from '../ui/domControls';
import { state, subscribe } from '../state/gameState';
import { setSonarUrgent } from '../ui/tradingViewWidget';

type BetHandlers = {
  onSelectToken: (value: number) => void;
  onClearTokens: () => Promise<void> | void;
  onPlaceDigitBet: (selection: {
    digitType: DigitBetType;
    selection?: string;
  }) => Promise<void> | void;
  onOpenSettings?: () => void;
};

const formatPayoutRatio = (value: number) => {
  if (!Number.isFinite(value)) return '--';
  const rounded = Math.round(value * 100) / 100;
  const asStr = rounded.toFixed(2).replace(/\.?0+$/, '');
  return `${asStr}:1`;
};

const formatMultiplierRatio = (value: number) => {
  if (!Number.isFinite(value)) return '--';
  const rounded = Math.round(value * 100) / 100;
  const asStr = rounded.toFixed(2).replace(/\.?0+$/, '');
  return `1:${asStr}`;
};

const DEFAULT_SUM_PAYOUTS: Record<number, number> = {
  1: 130,
  2: 70,
  3: 40,
  4: 26,
  5: 18,
  6: 14,
  7: 12,
  8: 10,
  9: 9,
  10: 8,
  11: 8,
  12: 8,
  13: 7,
  14: 7,
  15: 8,
  16: 8,
  17: 8,
  18: 9,
  19: 10,
  20: 12,
  21: 14,
  22: 18,
  23: 26,
  24: 40,
  25: 70,
  26: 130,
  27: 130,
};

export class HiLoScene extends Phaser.Scene {
  private language: LanguageCode = getInitialLanguage();
  private uiReady = false;
  private handlers: BetHandlers | null = null;

  private round?: RoundStatePayload;
  private lastPrice?: PriceUpdate;

  private priceText?: Phaser.GameObjects.Text;
  private priceTextHighlight?: Phaser.GameObjects.Text; // Last 3 digits highlighted
  private priceTextDecimal?: Phaser.GameObjects.Text; // Decimal part
  private priceArrowText?: Phaser.GameObjects.Text;
  private priceLabelText?: Phaser.GameObjects.Text;
  private priceTextY = 465;
  private timerText?: Phaser.GameObjects.Text;
  private sumTriangleText?: Phaser.GameObjects.Text;
  private lastSumTriangleValue: string | null = null;
  private sumTriangleTimer?: Phaser.Time.TimerEvent;
  private timerUrgencyTween?: Phaser.Tweens.Tween;
  private lastTimerSeconds = -1;
  private bigCountdownText?: Phaser.GameObjects.Text;
  private bigCountdownTween?: Phaser.Tweens.Tween;
  private lastBigCountdownSec = -1;
  private roundText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private balanceText?: Phaser.GameObjects.Text;
  private oddsLeftText?: Phaser.GameObjects.Text;
  private oddsCenterText?: Phaser.GameObjects.Text;
  private oddsRightText?: Phaser.GameObjects.Text;
  private bgLightOverlay?: Phaser.GameObjects.Image;
  private doublePayoutText?: Phaser.GameObjects.Text;
  private triplePayoutText?: Phaser.GameObjects.Text;
  private singlePayoutText?: Phaser.GameObjects.Text;
  private singleDoubleMultiplierText?: Phaser.GameObjects.Text;
  private singleTripleMultiplierText?: Phaser.GameObjects.Text;
  private lastResultDigits: Phaser.GameObjects.Image[] = [];
  private roundDigitsLeftText?: Phaser.GameObjects.Text;
  private roundDigitsCenterText?: Phaser.GameObjects.Text;
  private roundDigitsRightText?: Phaser.GameObjects.Text;
  private bgm?: Phaser.Sound.BaseSound;
  private lockedBackground?: Phaser.GameObjects.Image;

  private chipButtons = new Map<number, { image: Phaser.GameObjects.Image; baseScale: number }>();
  private tokenStyleValues = [10, 50, 100, 150, 200, 300, 500];
  private tokenStyleByValue = new Map<number, number>();
  private betTargets = new Map<string, Phaser.GameObjects.Image>();
  private tokenSprites = new Map<string, Phaser.GameObjects.Container>();
  private oddsTextByKey = new Map<string, Phaser.GameObjects.Text>();
  private baseOddsByKey = new Map<string, number>();
  private bonusOddsByKey = new Map<string, number>();
  private bonusTweens = new Map<string, Phaser.Tweens.Tween>();
  private winnerTweens = new Map<string, Phaser.Tweens.Tween>();
  private winnerLightTweens = new Map<string, Phaser.Tweens.Tween>();
  private winnerLightSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private bonusLightTweens = new Map<string, Phaser.Tweens.Tween>();
  private bonusLightSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private winnerHighlightTimer?: Phaser.Time.TimerEvent;
  private lightningGraphics: Phaser.GameObjects.Graphics[] = [];
  private lightningBoltTweens: Phaser.Tweens.Tween[] = [];
  private lightningTimers: Phaser.Time.TimerEvent[] = [];
  private coinSprites: Phaser.GameObjects.Sprite[] = [];
  private pendingWinPayout = 0;
  private payoutFloatText?: Phaser.GameObjects.Text;
  private winCoinSoundPlayed = false;
  private layoutRestoreEndsAt = 0;

  private clearTokensButton?: Phaser.GameObjects.Image;
  private settingButton?: Phaser.GameObjects.Image;
  private menuHitButton?: Phaser.GameObjects.Image;

  private resultOverlay?: Phaser.GameObjects.Container;
  private resultTitleText?: Phaser.GameObjects.Text;
  private resultPayoutText?: Phaser.GameObjects.Text;
  private resultWinnersText?: Phaser.GameObjects.Text;
  private resultPlayerWinsText?: Phaser.GameObjects.Text;
  private resultRoundId?: number;
  private resultDisplayDurationMs = 11000;
  private resultOverlayEndsAt = 0;
  private plusLightSprite?: Phaser.GameObjects.Sprite;

  private roundStartText?: Phaser.GameObjects.Text;
  private roundStartTween?: Phaser.Tweens.Tween;
  private lastSeenRoundId?: number;
  private chartRevealTimer?: Phaser.Time.TimerEvent;
  private chartRevealExpectedStatus?: RoundStatePayload['status'];
  private lockedBannerText?: Phaser.GameObjects.Text;
  private lockedBannerTween?: Phaser.Tweens.Tween;
  private lockedBannerTimers: Phaser.Time.TimerEvent[] = [];
  private pendingRoundState?: RoundStatePayload;
  private pendingRoundStateTimer?: Phaser.Time.TimerEvent;

  private unsubscribeState?: () => void;
  private statusListener?: (event: Event) => void;
  private audioSettingsListener?: (event: Event) => void;
  private dragScrollActive = false;
  private dragScrollY = 0;
  private scrollBounds?: { minY: number; maxY: number };
  private desiredMusicEnabled = true;

  // Locked layout mode state
  private isLockedLayoutMode = false;
  private isLockedLayoutPending = false;
  private lockedLayoutDelayTimer?: Phaser.Time.TimerEvent;
  private readonly LOCKED_LAYOUT_DELAY_MS = 3500;
  private readonly LOCKED_BET_SLOTS_OFFSET_Y = 100;
  private lockedLayoutTween?: Phaser.Tweens.Tween;
  private lockedLayoutScale = 1;
  private betSlotsContainer?: Phaser.GameObjects.Container;
  private betSlotsOriginalY = 0;
  private readonly BET_SLOTS_PIVOT_Y = 550; // Includes odds boxes (Y~699 after compression)

  constructor() {
    super('HiLoScene');
  }

  setBetHandlers(handlers: BetHandlers) {
    this.handlers = handlers;
  }

  preload() {
    this.cameras.main.setBackgroundColor('#050505');
    this.load.audio('bgm', 'audio/BGM_Hi_Lo.mp3');
    this.load.audio('bet_chip', 'audio/bet_chip.mp3');
    this.load.audio('wining_gold_coin', 'audio/wining_gold_coin.mp3');
    this.load.setPath('main_screen_UI');
    const loadImage = (key: string, file = `${key}.png`) => {
      this.load.image(key, encodeURI(file));
    };

    [
      'bg',
      'bg_light',
      'bg_line_left',
      'bg_line_right',
      'logo_combi3',
      '3N_box',
      'time',
      'box_round',
      'box_amount',
      'odd_box_left',
      'odd_box_mid',
      'odd_box_right',
      'button_small',
      'button_odd',
      'button_any triple',
      'button_even',
      'button_big',
      'title_bigbox_yellow',
      'title_bigbox_purple',
      'title_on_double',
      'title_on_triple',
      'title_on_single',
      'title_sum',
      'token_bar_box',
      'token_bar_clean',
      'setting',
      'chip_10',
      'chip_50',
      'chip_100',
      'chip_150',
      'chip_200',
      'chip_300',
      'chip_500',
    ].forEach((key) => loadImage(key));
    this.load.image('bg_lockedphase', '../bg_lockedphase.png');

    for (let i = 0; i <= 9; i += 1) {
      loadImage(`number_${i}`);
      loadImage(`number_${i}${i}`);
      loadImage(`number_${i}${i}${i}`);
    }

    for (let sum = 3; sum <= 27; sum += 1) {
      loadImage(`number_sum_${String(sum).padStart(2, '0')}`);
    }

    this.load.spritesheet(
      'plus_light_anim',
      '../UI_sprites/plus_light_anim/plus_light_anim.png',
      { frameWidth: 1074, frameHeight: 580 },
    );

    this.load.spritesheet(
      'number_light_box_2',
      '../UI_sprites/number_light_box_2/number_light_box2.png',
      { frameWidth: 270, frameHeight: 109 },
    );

    this.load.spritesheet(
      'money_anim',
      '../UI_sprites/money_anim/money_anim.png',
      { frameWidth: 68, frameHeight: 68 },
    );
  }

  create() {
    this.createMainLayout();
    this.updateCameraBounds();
    this.fitCameraZoom();
    this.enableVerticalScroll();
    this.startBackgroundMusic();

    this.uiReady = true;
    this.setLanguage(this.language);
    this.applyConfigOdds(state.config);
    this.updateTokenStyleMap(state.config);
    this.syncSelectedToken(state.selectedTokenValue);
    this.syncTokenPlacements(state.tokenPlacements);
    this.syncActiveSelections(state.digitSelections);
    this.syncDigitResult(state.lastDigitResult);
    this.syncDigitSum(state.lastDigitSum, state.lastDigitResult);
    this.syncBalance(state.walletBalance);

    this.unsubscribeState = subscribe((nextState) => {
      this.applyConfigOdds(nextState.config);
      this.updateTokenStyleMap(nextState.config);
      this.syncSelectedToken(nextState.selectedTokenValue);
      this.syncTokenPlacements(nextState.tokenPlacements);
      this.syncActiveSelections(nextState.digitSelections);
      this.syncDigitResult(nextState.lastDigitResult);
      this.syncDigitSum(nextState.lastDigitSum, nextState.lastDigitResult);
      this.syncBalance(nextState.walletBalance);
    });

    if (typeof window !== 'undefined') {
      this.statusListener = (event) => {
        const detail = (event as CustomEvent<{ message: string; isError?: boolean }>)
          .detail;
        if (!detail) return;
        this.statusText?.setText(detail.message);
        this.statusText?.setColor(detail.isError ? '#ff7675' : '#00ffb2');
      };
      window.addEventListener('app:status', this.statusListener);

      this.audioSettingsListener = (event) => {
        const detail = (event as CustomEvent<{ musicEnabled?: boolean }>).detail;
        if (!detail || typeof detail.musicEnabled !== 'boolean') return;
        this.setMusicEnabled(detail.musicEnabled);
      };
      window.addEventListener('app:audio-settings', this.audioSettingsListener);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeState?.();
      if (this.statusListener && typeof window !== 'undefined') {
        window.removeEventListener('app:status', this.statusListener);
      }
      if (this.audioSettingsListener && typeof window !== 'undefined') {
        window.removeEventListener('app:audio-settings', this.audioSettingsListener);
      }
    });
  }

  private startBackgroundMusic() {
    if (this.bgm) return;
    this.bgm = this.sound.add('bgm', { loop: true, volume: 0.35 });

    const tryPlay = () => {
      if (!this.bgm || this.bgm.isPlaying) return;
      if (!this.desiredMusicEnabled) return;
      this.bgm.play();
    };

    this.desiredMusicEnabled = this.readMusicEnabledFromStorage();

    if (this.sound.locked) {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, tryPlay);
      this.input.once('pointerdown', tryPlay);
    } else {
      tryPlay();
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.bgm?.stop();
      this.bgm?.destroy();
      this.bgm = undefined;
    });
  }

  private readMusicEnabledFromStorage() {
    if (typeof window === 'undefined') return true;
    try {
      const raw = window.localStorage.getItem('audioSettings');
      if (!raw) return true;
      const parsed = JSON.parse(raw) as { musicEnabled?: boolean } | null;
      return parsed?.musicEnabled !== false;
    } catch {
      return true;
    }
  }

  private setMusicEnabled(enabled: boolean) {
    this.desiredMusicEnabled = enabled;
    if (!this.bgm) return;
    if (enabled) {
      if (this.sound.locked) return;
      if (this.bgm.isPaused) {
        this.bgm.resume();
      } else if (!this.bgm.isPlaying) {
        this.bgm.play();
      }
      this.bgm.setVolume(0.35);
    } else if (this.bgm.isPlaying) {
      this.bgm.pause();
    }
  }

  private createMainLayout() {
    const addImage = (
      x: number,
      y: number,
      key: string,
      scaleX = 1,
      scaleY = scaleX,
    ) => this.add.image(x, y, key).setScale(scaleX, scaleY);

    const bg = addImage(this.scale.width / 2, this.scale.height * 1.1, 'bg', 1.1, 1.5);
    bg.setDepth(-100);
    this.lockedBackground = addImage(
      this.scale.width / 2,
      this.scale.height * 1.1,
      'bg_lockedphase',
      1.1,
      1.5,
    );
    this.lockedBackground.setDepth(-95).setVisible(false).setScrollFactor(0);

    const buttonAnyTriple = addImage(543, 868, 'button_any triple', 0.75);
    const buttonBig = addImage(950, 868, 'button_big', 0.75);
    const buttonEven = addImage(739, 868, 'button_even', 0.75);
    const buttonOdd = addImage(347, 868, 'button_odd', 0.75);
    const buttonSmall = addImage(135, 868, 'button_small', 0.75);

    addImage(529, 1155, 'title_bigbox_yellow', 0.75);
    const titleOnDouble = addImage(535, 1014, 'title_on_double', 0.75);
    const titleDoubleInset = titleOnDouble.displayWidth * 0.37;
    this.doublePayoutText = this.add
      .text(
        titleOnDouble.x - titleOnDouble.displayWidth / 2 + titleDoubleInset,
        titleOnDouble.y,
        '',
        {
          fontFamily: 'Rajdhani',
          fontSize: '22px',
          color: '#f8fafc',
          fontStyle: 'bold',
        },
      )
      .setOrigin(1, 0.5)
      .setDepth(6);
    addImage(530, 1372, 'title_bigbox_yellow', 0.75);
    const titleOnTriple = addImage(532, 1231, 'title_on_triple', 0.75);
    const titleTripleInset = titleOnTriple.displayWidth * 0.39;
    this.triplePayoutText = this.add
      .text(
        titleOnTriple.x - titleOnTriple.displayWidth / 2 + titleTripleInset,
        titleOnTriple.y,
        '',
        {
          fontFamily: 'Rajdhani',
          fontSize: '22px',
          color: '#f8fafc',
          fontStyle: 'bold',
        },
      )
      .setOrigin(1, 0.5)
      .setDepth(6);
    addImage(531, 1600, 'title_bigbox_purple', 0.75);
    addImage(536, 1459, 'title_sum', 0.75);
    const titleOnSingle = addImage(535, 1909, 'title_on_single', 0.75);
    const singleTitleSectionWidth = titleOnSingle.displayWidth / 3;
    const singleTitleLeft = titleOnSingle.x - titleOnSingle.displayWidth / 2;
    const singleTitleInset = singleTitleSectionWidth * 0.69;
    this.singlePayoutText = this.add
      .text(
        singleTitleLeft + singleTitleInset,
        titleOnSingle.y,
        '',
        {
          fontFamily: 'Rajdhani',
          fontSize: '22px',
          color: '#f8fafc',
          fontStyle: 'bold',
        },
      )
      .setOrigin(1, 0.5)
      .setDepth(6);
    const singleMultiplierOffset = singleTitleSectionWidth + singleTitleInset;
    this.singleDoubleMultiplierText = this.add
      .text(
        singleTitleLeft + singleMultiplierOffset - 115,
        titleOnSingle.y,
        '',
        {
          fontFamily: 'Rajdhani',
          fontSize: '22px',
          color: '#ffd166',
          fontStyle: 'bold',
        },
      )
      .setOrigin(1, 0.5)
      .setDepth(6);
    this.singleTripleMultiplierText = this.add
      .text(
        singleTitleLeft + singleTitleSectionWidth * 2 + singleTitleInset - 225,
        titleOnSingle.y,
        '',
        {
          fontFamily: 'Rajdhani',
          fontSize: '22px',
          color: '#ffd166',
          fontStyle: 'bold',
        },
      )
      .setOrigin(1, 0.5)
      .setDepth(6);

    const doubleDigits: Array<[string, number, number]> = [
      ['00', 141, 1084],
      ['11', 335, 1082],
      ['22', 529, 1082],
      ['33', 725, 1082],
      ['44', 921, 1082],
      ['55', 139, 1154],
      ['66', 331, 1154],
      ['77', 527, 1154],
      ['88', 724, 1154],
      ['99', 920, 1154],
    ];
    doubleDigits.forEach(([value, x, y]) => {
      const image = addImage(Number(x), Number(y), `number_${value}`, 0.75);
      this.registerDigitCell(image, 'DOUBLE', value);
    });

    const tripleDigits: Array<[string, number, number]> = [
      ['000', 138, 1311],
      ['111', 331, 1311],
      ['222', 526, 1311],
      ['333', 724, 1311],
      ['444', 922, 1311],
      ['555', 138, 1383],
      ['666', 331, 1383],
      ['777', 528, 1382],
      ['888', 725, 1383],
      ['999', 921, 1382],
    ];
    tripleDigits.forEach(([value, x, y]) => {
      const image = addImage(Number(x), Number(y), `number_${value}`, 0.75);
      this.registerDigitCell(image, 'TRIPLE', value);
    });

    const sumDigits: Array<[string, number, number]> = [
      ['03', 140, 1536],
      ['04', 335, 1536],
      ['05', 532, 1536],
      ['06', 730, 1536],
      ['07', 924, 1536],
      ['08', 140, 1613],
      ['09', 335, 1613],
      ['10', 532, 1613],
      ['11', 730, 1613],
      ['12', 924, 1613],
      ['13', 140, 1688],
      ['14', 335, 1688],
      ['15', 532, 1688],
      ['16', 730, 1688],
      ['17', 924, 1688],
      ['18', 140, 1761],
      ['19', 335, 1761],
      ['20', 532, 1761],
      ['21', 730, 1761],
      ['22', 924, 1761],
      ['23', 140, 1833],
      ['24', 335, 1833],
      ['25', 532, 1833],
      ['26', 730, 1833],
      ['27', 924, 1833],
    ];
    sumDigits.forEach(([value, x, y]) => {
      const selection = String(Number(value));
      const image = addImage(Number(x), Number(y), `number_sum_${value}`, 0.75);
      this.registerDigitCell(image, 'SUM', selection, 17, 16.5);
    });

    const singleDigits: Array<[string, number, number]> = [
      ['0', 137, 1987],
      ['1', 333, 1987],
      ['2', 533, 1987],
      ['3', 729, 1987],
      ['4', 925, 1987],
      ['5', 137, 2060],
      ['6', 333, 2060],
      ['7', 533, 2060],
      ['8', 729, 2060],
      ['9', 925, 2060],
    ];
    singleDigits.forEach(([value, x, y]) => {
      const image = addImage(Number(x), Number(y), `number_${value}`, 0.75);
      this.registerDigitCell(image, 'SINGLE', value);
    });

    const useFloatingTokenBar = true;
    if (!useFloatingTokenBar) {
      addImage(534, 2219, 'token_bar_box', 0.75);
      this.clearTokensButton = addImage(954, 2157, 'token_bar_clean', 0.75);

      const chipPositions: Array<[number, number, number]> = [
        [10, 234, 2224],
        [100, 334, 2224],
        [150, 434, 2224],
        [200, 534, 2224],
        [300, 634, 2224],
        [50, 734, 2224],
        [500, 834, 2224],
      ];
      chipPositions.forEach(([value, x, y]) => {
        const image = addImage(x, y, `chip_${value}`, 0.65);
        this.registerChipButton(value, image);
      });

      this.settingButton = addImage(1022, 2262, 'setting', 0.75);
    } else {
      // Invisible hit target over the gear area so mobile taps open the DOM menu.
      this.menuHitButton = this.add.image(1022, 2262, 'setting', 1.0);
      this.menuHitButton.setAlpha(0.001).setDepth(1000);
      this.makeInteractive(this.menuHitButton, () => this.openMenu());
    }

    this.bgLightOverlay = addImage(540, 973, 'bg_light', 0.72);
    addImage(936, 115, 'bg_line_right', 0.7);
    addImage(539, 66, 'logo_combi3', 0.7);
    addImage(141, 115, 'bg_line_left', 0.7);

    addImage(420, 181, '3N_box', 0.7);
    addImage(538, 181, '3N_box', 0.7);
    addImage(655, 181, '3N_box', 0.7);

    addImage(274, 209, 'time', 0.7);
    addImage(130, 199, 'box_round', 0.7);
    addImage(894, 200, 'box_amount', 0.7);

    addImage(543, 743, 'odd_box_mid', 0.7);
    addImage(277, 742, 'odd_box_left', 0.7);
    addImage(808, 742, 'odd_box_right', 0.7);

    this.oddsLeftText = this.add
      .text(134, 740, '', {
        fontFamily: 'Rajdhani',
        fontSize: '22px',
        color: '#f8fafc',
        fontStyle: 'bold',
      })
      .setScale(1.3)
      .setOrigin(0, 0.5);
    this.oddsRightText = this.add
      .text(659, 740, '', {
        fontFamily: 'Rajdhani',
        fontSize: '22px',
        color: '#f8fafc',
        fontStyle: 'bold',
      })
      .setScale(1.3)
      .setOrigin(0, 0.5);
    this.oddsCenterText = this.add
      .text(540, 740, '', {
        fontFamily: 'Rajdhani',
        fontSize: '24px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setScale(1.3)
      .setOrigin(0.5, 0.5);

    this.roundText = this.add
      .text(180, 199, `--`, {
        fontFamily: 'Rajdhani',
        fontSize: '20px',
        color: '#f8fafc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.sumTriangleText = this.add
      .text(535, 290, '--', {
        fontFamily: 'Rajdhani',
        fontSize: '50px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(45)
      .setVisible(false);

    this.timerText = this.add
      .text(298, 209, '--s', {
        fontFamily: 'Roboto Mono',
        fontSize: '37px',
        color: '#00ffb2',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    this.bigCountdownText = this.add
      .text(290, 285, '', {
        fontFamily: 'Rajdhani',
        fontSize: '120px',
        color: '#ff4757',
        fontStyle: 'bold',
        stroke: '#1a0000',
        strokeThickness: 8,
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: 'rgba(255,60,60,0.6)',
          blur: 24,
          fill: true,
        },
      })
      .setOrigin(0.5, 0)
      .setDepth(55)
      .setAlpha(0)
      .setVisible(false);

    this.balanceText = this.add
      .text(974, 200, '0.00 USDT', {
        fontFamily: 'Roboto Mono',
        fontSize: '20px',
        color: '#00ffb2',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(540, 260, t(this.language, 'scene.connecting'), {
        fontFamily: 'Rajdhani',
        fontSize: '18px',
        color: '#b2bec3',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Price display split into 3 parts: prefix, last 3 digits (highlighted), decimal
    // Example: "75" + "830" + ".16" for price 75830.16
    this.priceText = this.add
      .text(540, this.priceTextY, '00', {
        fontFamily: 'Roboto Mono',
        fontSize: '54px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5); // Right-aligned to connect with highlight

    this.priceTextHighlight = this.add
      .text(540, this.priceTextY, '000', {
        fontFamily: 'Roboto Mono',
        fontSize: '54px',
        color: '#ffffff', // Will change to highlight color during locked phase
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5); // Left-aligned to connect with prefix

    this.priceTextDecimal = this.add
      .text(540, this.priceTextY, '.00', {
        fontFamily: 'Roboto Mono',
        fontSize: '54px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5); // Left-aligned after highlight

    this.priceArrowText = this.add
      .text(720, this.priceTextY, '▲', {
        fontFamily: 'Rajdhani',
        fontSize: '30px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // Create three separate digit text objects for each frame
    this.roundDigitsLeftText = this.add
      .text(420, 181, '0', {
        fontFamily: 'Roboto Mono',
        fontSize: '40px',
        color: '#f8fafc',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);

    this.roundDigitsCenterText = this.add
      .text(538, 181, '0', {
        fontFamily: 'Roboto Mono',
        fontSize: '40px',
        color: '#f8fafc',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);

    this.roundDigitsRightText = this.add
      .text(655, 181, '0', {
        fontFamily: 'Roboto Mono',
        fontSize: '40px',
        color: '#f8fafc',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);

    this.registerBetButton(buttonSmall, 'SMALL');
    this.registerBetButton(buttonOdd, 'ODD');
    this.registerBetButton(buttonAnyTriple, 'ANY_TRIPLE');
    this.registerBetButton(buttonEven, 'EVEN');
    this.registerBetButton(buttonBig, 'BIG');

    if (this.clearTokensButton) {
      this.makeInteractive(this.clearTokensButton, () => this.handleClearTokens());
    }
    if (this.settingButton) {
      this.makeInteractive(this.settingButton, () => this.openSettings());
    }

    this.fitBodyToViewport(500);
    this.alignLayoutToVisibleTop(8);
  }

  private getContentBounds(excludeBg = true) {
    const items = this.children.list.filter((item) => {
      if (!item || typeof (item as { getBounds?: () => Phaser.Geom.Rectangle }).getBounds !== 'function') {
        return false;
      }
      if (item === this.resultOverlay) return false;
      if (
        excludeBg &&
        item instanceof Phaser.GameObjects.Image &&
        (item.texture?.key === 'bg' ||
          item.texture?.key === 'bg_light' ||
          item.texture?.key === 'bg_lockedphase')
      ) {
        return false;
      }
      return true;
    });

    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    items.forEach((item) => {
      const bounds = (item as Phaser.GameObjects.GameObject & {
        getBounds: () => Phaser.Geom.Rectangle;
      }).getBounds();
      if (!Number.isFinite(bounds.top) || !Number.isFinite(bounds.bottom)) return;
      if (!Number.isFinite(bounds.left) || !Number.isFinite(bounds.right)) return;
      minY = Math.min(minY, bounds.top);
      maxY = Math.max(maxY, bounds.bottom);
      minX = Math.min(minX, bounds.left);
      maxX = Math.max(maxX, bounds.right);
    });

    if (!Number.isFinite(minY) || !Number.isFinite(maxY) || !Number.isFinite(minX) || !Number.isFinite(maxX)) {
      return undefined;
    }
    return { minY, maxY, minX, maxX };
  }

  private getTokenBarSafeHeight(viewHeight: number) {
    const fallback = Math.round(Math.max(viewHeight * 0.12, 240));
    if (typeof document === 'undefined') return fallback;
    const tokenBar = document.getElementById('token-bar-floating');
    if (!tokenBar) return fallback;
    if (tokenBar.parentElement?.id !== 'game-container') return fallback;
    const rect = tokenBar.getBoundingClientRect();
    if (!Number.isFinite(rect.height) || rect.height <= 0) return fallback;
    const displayHeight = this.scale.displaySize?.height ?? this.scale.height;
    if (!Number.isFinite(displayHeight) || displayHeight <= 0) return fallback;
    const pxToGame = viewHeight / displayHeight;
    return Math.max(fallback, Math.round(rect.height * pxToGame + 24));
  }

  private fitBodyToViewport(pivotY: number) {
    const bounds = this.getContentBounds();
    if (!bounds) return;

    const viewHeight = this.scale.height;
    const bottomSafe = this.getTokenBarSafeHeight(viewHeight);
    const available = viewHeight - pivotY - bottomSafe;
    const bodyHeight = bounds.maxY - pivotY;
    if (bodyHeight <= 0 || available <= 0) return;

    const scale = Phaser.Math.Clamp(available / bodyHeight, 0.68, 1);
    if (scale < 1) {
      this.compressBodyLayout(pivotY, scale);
    }
  }

  private compressBodyLayout(pivotY: number, scale: number) {
    this.children.each((child) => {
      const node = child as Phaser.GameObjects.GameObject & { y?: number };
      if (typeof node.y !== 'number') return;
      if (node.y < pivotY) return;
      node.y = pivotY + (node.y - pivotY) * scale;
    });
  }

  private alignLayoutToVisibleTop(padding = 8) {
    const layoutItems = this.children.list.filter((item) => {
      if (!item || typeof (item as { getBounds?: () => Phaser.Geom.Rectangle }).getBounds !== 'function') {
        return false;
      }
      if (item === this.resultOverlay) return false;
      if (
        item instanceof Phaser.GameObjects.Image &&
        (item.texture?.key === 'bg' ||
          item.texture?.key === 'bg_light' ||
          item.texture?.key === 'bg_lockedphase')
      ) {
        return false;
      }
      return true;
    });

    let minY = Number.POSITIVE_INFINITY;
    layoutItems.forEach((item) => {
      const bounds = (item as Phaser.GameObjects.GameObject & {
        getBounds: () => Phaser.Geom.Rectangle;
      }).getBounds();
      if (!Number.isFinite(bounds.top)) return;
      minY = Math.min(minY, bounds.top);
    });

    const headerTop = this.getHeaderTop();
    const targetTop = Number.isFinite(headerTop) ? (headerTop as number) : minY;
    if (!Number.isFinite(targetTop)) return;
    const delta = targetTop - padding;
    if (Math.abs(delta) < 0.5) return;

    this.shiftLayoutY(-delta);
    this.priceTextY -= delta;
  }

  private shiftLayoutY(delta: number) {
    this.children.each((child) => {
      if (child === this.resultOverlay) return;
      const node = child as Phaser.GameObjects.GameObject & { y?: number };
      if (typeof node.y !== 'number') return;
      node.y += delta;
    });
  }

  private getHeaderTop() {
    const headerKeys = new Set([
      'bg_line_left',
      'bg_line_right',
      'logo_combi3',
      'time',
      'box_round',
      'box_amount',
      '3N_box',
    ]);
    let top = Number.POSITIVE_INFINITY;
    this.children.list.forEach((item) => {
      if (!(item instanceof Phaser.GameObjects.Image)) return;
      const key = item.texture?.key;
      if (!key || !headerKeys.has(key) || typeof item.getBounds !== 'function') return;
      const bounds = item.getBounds();
      if (!Number.isFinite(bounds.top)) return;
      top = Math.min(top, bounds.top);
    });
    return Number.isFinite(top) ? top : undefined;
  }

  private updateCameraBounds() {
    const layoutItems = this.children.list.filter((item) => {
      if (!item || typeof (item as { getBounds?: () => Phaser.Geom.Rectangle }).getBounds !== 'function') {
        return false;
      }
      if (item === this.resultOverlay) return false;
      if (
        item instanceof Phaser.GameObjects.Image &&
        (item.texture?.key === 'bg' ||
          item.texture?.key === 'bg_light' ||
          item.texture?.key === 'bg_lockedphase')
      ) {
        return false;
      }
      return true;
    });

    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    layoutItems.forEach((item) => {
      const bounds = (item as Phaser.GameObjects.GameObject & {
        getBounds: () => Phaser.Geom.Rectangle;
      }).getBounds();
      if (!Number.isFinite(bounds.top) || !Number.isFinite(bounds.bottom)) return;
      minY = Math.min(minY, bounds.top);
      maxY = Math.max(maxY, bounds.bottom);
    });

    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return;
    const headerTop = this.getHeaderTop();
    const topPadding = 8;
    const topAnchor = Number.isFinite(headerTop)
      ? Math.max(0, (headerTop as number) - topPadding)
      : Math.max(0, minY);
    const viewHeight = this.scale.height;
    // Keep padding consistent with the floating token bar margin so content doesn't get hidden.
    const bottomPadding = this.getTokenBarSafeHeight(viewHeight);
    const contentHeight = Math.max(viewHeight, maxY - topAnchor + bottomPadding);
    this.scrollBounds = { minY: topAnchor, maxY: topAnchor + contentHeight };
    this.cameras.main.setBounds(0, topAnchor, this.scale.width, contentHeight);
    this.cameras.main.scrollY = topAnchor;
  }

  private fitCameraZoom() {
    // Keep camera zoom at 1 to avoid horizontal letterboxing.
    const cam = this.cameras.main;
    cam.setZoom(1);
    cam.setScroll(0, cam.scrollY);
  }

  private enableVerticalScroll() {
    const camera = this.cameras.main;
    const clampScroll = (value: number) => {
      const bounds = this.scrollBounds;
      if (!bounds) return value;
      const maxScroll = Math.max(bounds.minY, bounds.maxY - camera.height);
      return Phaser.Math.Clamp(value, bounds.minY, maxScroll);
    };

    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _dx: number,
      dy: number,
      _dz: number,
      event: WheelEvent,
    ) => {
      // Only try preventDefault if the event is cancelable (non-passive)
      if (event && event.cancelable && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      if (!this.scrollBounds) return;
      camera.scrollY = clampScroll(camera.scrollY + dy);
    });

    this.input.on('pointerdown', (
      pointer: Phaser.Input.Pointer,
      gameObjects: Phaser.GameObjects.GameObject[],
    ) => {
      if (gameObjects.length) return;
      this.dragScrollActive = true;
      this.dragScrollY = pointer.y;
    });

    this.input.on('pointerup', () => {
      this.dragScrollActive = false;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragScrollActive || !pointer.isDown) return;
      // Don't call preventDefault on passive touch events - it causes console errors
      // The CSS touch-action: pan-y on the canvas handles scroll behavior
      const delta = pointer.y - this.dragScrollY;
      if (Math.abs(delta) < 2) return;
      camera.scrollY = clampScroll(camera.scrollY - delta);
      this.dragScrollY = pointer.y;
    });
  }

  private enterLockedLayout() {
    if (this.isLockedLayoutMode) return;
    this.isLockedLayoutMode = true;
    this.isLockedLayoutPending = true;
    this.setLockedBackgroundVisible(true);

    // Disable scrolling during locked phase
    this.dragScrollActive = false;

    // Reset camera to top
    const camera = this.cameras.main;
    if (this.scrollBounds) {
      this.tweens.add({
        targets: camera,
        scrollY: this.scrollBounds.minY,
        duration: 400,
        ease: 'Sine.easeInOut',
      });
    }

    this.scheduleLockedLayoutTransform();
  }

  private scheduleLockedLayoutTransform() {
    if (!this.isLockedLayoutMode || !this.isLockedLayoutPending) return;
    this.lockedLayoutDelayTimer?.remove(false);
    this.lockedLayoutDelayTimer = this.time.delayedCall(
      this.LOCKED_LAYOUT_DELAY_MS,
      () => {
        this.lockedLayoutDelayTimer = undefined;
        if (!this.isLockedLayoutMode || !this.isLockedLayoutPending) return;
        this.applyLockedLayoutTransform();
      },
      undefined,
      this,
    );
  }

  private clearLockedLayoutDelay() {
    if (this.lockedLayoutDelayTimer) {
      this.lockedLayoutDelayTimer.remove(false);
      this.lockedLayoutDelayTimer = undefined;
    }
    this.isLockedLayoutPending = false;
  }

  private applyLockedLayoutTransform() {
    if (!this.isLockedLayoutMode || !this.isLockedLayoutPending) return;
    this.isLockedLayoutPending = false;

    // Expand chart only after the bonus visual window.
    const container = document.getElementById('game-container');
    container?.classList.add('locked-layout');

    // Animate all bet slot elements (elements below pivot Y)
    const pivotY = this.BET_SLOTS_PIVOT_Y;
    const viewHeight = this.scale.height;
    const viewWidth = this.scale.width;
    const centerX = viewWidth / 2;
    const bottomTop = viewHeight * 0.45 + this.LOCKED_BET_SLOTS_OFFSET_Y;
    const bottomHeight = viewHeight * 0.55;

    let minSlotY = Number.POSITIVE_INFINITY;
    let maxSlotY = Number.NEGATIVE_INFINITY;
    this.children.list.forEach((child) => {
      if (child === this.resultOverlay) return;
      const node = child as Phaser.GameObjects.GameObject & {
        y?: number;
        getBounds?: () => Phaser.Geom.Rectangle;
      };
      if (typeof node.y !== 'number' || node.y < pivotY) return;

      if (
        child instanceof Phaser.GameObjects.Image &&
        (child.texture?.key === 'bg' ||
          child.texture?.key === 'bg_light' ||
          child.texture?.key === 'bg_lockedphase')
      ) {
        return;
      }

      if (typeof node.getBounds !== 'function') return;
      const bounds = node.getBounds();
      if (!Number.isFinite(bounds.top) || !Number.isFinite(bounds.bottom)) return;
      minSlotY = Math.min(minSlotY, bounds.top);
      maxSlotY = Math.max(maxSlotY, bounds.bottom);
    });

    if (!Number.isFinite(minSlotY) || !Number.isFinite(maxSlotY)) {
      minSlotY = pivotY;
      maxSlotY = pivotY + bottomHeight;
    }

    const slotHeight = Math.max(1, maxSlotY - minSlotY);
    const targetScale = Math.min(1, bottomHeight / slotHeight);
    this.lockedLayoutScale = targetScale;

    this.children.each((child) => {
      if (child === this.resultOverlay) return;
      const node = child as Phaser.GameObjects.GameObject & {
        x?: number;
        y?: number;
        scaleX?: number;
        scaleY?: number;
        setScale?: (x: number, y?: number) => void;
        getData?: (key: string) => unknown;
        setData?: (key: string, value: unknown) => void;
      };
      if (typeof node.y !== 'number' || node.y < pivotY) return;

      // Skip background elements
      if (
        child instanceof Phaser.GameObjects.Image &&
        (child.texture?.key === 'bg' ||
          child.texture?.key === 'bg_light' ||
          child.texture?.key === 'bg_lockedphase')
      ) {
        return;
      }

      // Store original position and scale
      if (node.setData && node.getData) {
        if (node.getData('originalY') === undefined) {
          node.setData('originalX', node.x ?? centerX);
          node.setData('originalY', node.y);
          node.setData('originalScaleX', node.scaleX ?? 1);
          node.setData('originalScaleY', node.scaleY ?? 1);
        }
      }

      const originalX = (node.getData?.('originalX') as number) ?? node.x ?? centerX;
      const originalY = (node.getData?.('originalY') as number) ?? node.y;
      const relativeX = originalX - centerX;
      const relativeY = originalY - minSlotY;
      const newX = centerX + relativeX * targetScale;
      const newY = bottomTop + relativeY * targetScale;

      this.tweens.add({
        targets: node,
        x: newX,
        y: newY,
        scaleX: (node.getData?.('originalScaleX') as number ?? 1) * targetScale,
        scaleY: (node.getData?.('originalScaleY') as number ?? 1) * targetScale,
        duration: 400,
        ease: 'Sine.easeOut',
      });
    });

    // Also transform token placements
    this.tokenSprites.forEach((sprite) => {
      if (sprite.y < pivotY) return;
      if (!sprite.getData('originalY')) {
        sprite.setData('originalX', sprite.x);
        sprite.setData('originalY', sprite.y);
        sprite.setData('originalScaleX', sprite.scaleX);
        sprite.setData('originalScaleY', sprite.scaleY);
      }
      const originalX = sprite.getData('originalX') as number;
      const originalY = sprite.getData('originalY') as number;
      const relativeX = originalX - centerX;
      const relativeY = originalY - minSlotY;
      const newX = centerX + relativeX * targetScale;
      const newY = bottomTop + relativeY * targetScale;

      this.tweens.add({
        targets: sprite,
        x: newX,
        y: newY,
        scaleX: (sprite.getData('originalScaleX') as number) * targetScale,
        scaleY: (sprite.getData('originalScaleY') as number) * targetScale,
        duration: 400,
        ease: 'Sine.easeOut',
      });
    });

    // Pause bonus tweens and explicitly scale bonus slot images
    this.bonusTweens.forEach((tween, key) => {
      tween.pause();
      const image = this.betTargets.get(key);
      if (!image) return;
      
      // Get the base scale (before bonus pulse animation)
      const baseScale = image.getData('baseScale') as number | undefined;
      const origScale = baseScale ?? 0.75;
      
      // Store original values if not already stored
      if (image.getData('originalY') === undefined) {
        image.setData('originalX', image.x);
        image.setData('originalY', image.y);
        image.setData('originalScaleX', origScale);
        image.setData('originalScaleY', origScale);
      }
      
      const originalX = image.getData('originalX') as number;
      const originalY = image.getData('originalY') as number;
      const relativeX = originalX - centerX;
      const relativeY = originalY - minSlotY;
      const newX = centerX + relativeX * targetScale;
      const newY = bottomTop + relativeY * targetScale;
      
      // Kill any existing tweens on this image and apply new transform
      this.tweens.killTweensOf(image);
      this.tweens.add({
        targets: image,
        x: newX,
        y: newY,
        scaleX: origScale * targetScale,
        scaleY: origScale * targetScale,
        duration: 400,
        ease: 'Sine.easeOut',
      });
    });

    if (this.bonusOddsByKey.size) {
      this.time.delayedCall(
        420,
        () => {
          if (!this.isLockedLayoutMode || this.isLockedLayoutPending) return;
          this.applyBonusHighlights();
        },
        undefined,
        this,
      );
    }
  }

  private exitLockedLayout() {
    if (!this.isLockedLayoutMode && !this.isLockedLayoutPending) return;
    const wasPending = this.isLockedLayoutPending;
    const wasLocked = this.isLockedLayoutMode;
    this.clearLockedLayoutDelay();
    this.isLockedLayoutMode = false;
    this.isLockedLayoutPending = false;
    this.setLockedBackgroundVisible(false);
    this.lockedLayoutScale = 1;

    // Remove CSS class from game container
    const container = document.getElementById('game-container');
    container?.classList.remove('locked-layout');

    if (!wasLocked || wasPending) {
      return;
    }

    const restoreDuration = 400;
    this.layoutRestoreEndsAt = this.time.now + restoreDuration;

    // Restore all bet slot elements to original positions
    this.children.each((child) => {
      if (child === this.resultOverlay) return;
      const node = child as Phaser.GameObjects.GameObject & {
        y?: number;
        getData?: (key: string) => unknown;
      };
      if (typeof node.y !== 'number') return;

      const originalX = node.getData?.('originalX') as number | undefined;
      const originalY = node.getData?.('originalY') as number | undefined;
      const originalScaleX = node.getData?.('originalScaleX') as number | undefined;
      const originalScaleY = node.getData?.('originalScaleY') as number | undefined;

      if (originalY === undefined) return;

      this.tweens.add({
        targets: node,
        x: originalX,
        y: originalY,
        scaleX: originalScaleX ?? 1,
        scaleY: originalScaleY ?? 1,
        duration: restoreDuration,
        ease: 'Sine.easeOut',
      });
    });

    // Restore token placements
    this.tokenSprites.forEach((sprite) => {
      const originalX = sprite.getData('originalX') as number | undefined;
      const originalY = sprite.getData('originalY') as number | undefined;
      const originalScaleX = sprite.getData('originalScaleX') as number | undefined;
      const originalScaleY = sprite.getData('originalScaleY') as number | undefined;

      if (originalY === undefined) return;

      this.tweens.add({
        targets: sprite,
        x: originalX,
        y: originalY,
        scaleX: originalScaleX ?? 1,
        scaleY: originalScaleY ?? 1,
        duration: restoreDuration,
        ease: 'Sine.easeOut',
      });
    });

    // Restore bonus slot images and resume their pulse animation
    this.bonusTweens.forEach((tween, key) => {
      const image = this.betTargets.get(key);
      if (!image) {
        tween.resume();
        return;
      }
      
      const originalX = image.getData('originalX') as number | undefined;
      const originalY = image.getData('originalY') as number | undefined;
      const baseScale = image.getData('baseScale') as number | undefined;
      const origScale = baseScale ?? 0.75;
      
      if (originalX === undefined || originalY === undefined) {
        tween.resume();
        return;
      }
      
      // Restore position and scale, then resume pulse animation
      this.tweens.add({
        targets: image,
        x: originalX,
        y: originalY,
        scaleX: origScale,
        scaleY: origScale,
        duration: restoreDuration,
        ease: 'Sine.easeOut',
        onComplete: () => {
          tween.resume();
        },
      });
    });
  }

  private setResultLayoutVisible(visible: boolean) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('game-container');
    container?.classList.toggle('result-layout', visible);
  }

  private setPendingLayoutVisible(visible: boolean) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('game-container');
    container?.classList.toggle('pending-layout', visible);
  }

  private clearPendingRoundState() {
    if (this.pendingRoundStateTimer) {
      this.pendingRoundStateTimer.remove(false);
      this.pendingRoundStateTimer = undefined;
    }
    this.pendingRoundState = undefined;
  }

  private deferRoundState(state: RoundStatePayload, delayMs: number) {
    this.pendingRoundState = state;
    if (this.pendingRoundStateTimer) {
      this.pendingRoundStateTimer.remove(false);
    }
    this.pendingRoundStateTimer = this.time.delayedCall(
      delayMs,
      () => {
        this.pendingRoundStateTimer = undefined;
        const pending = this.pendingRoundState;
        this.pendingRoundState = undefined;
        if (!pending) return;
        if (this.round?.id !== pending.id || this.round?.status !== pending.status) {
          return;
        }
        this.applyRoundState(pending);
      },
      undefined,
      this,
    );
  }

  private clearChartRevealTimer() {
    if (this.chartRevealTimer) {
      this.chartRevealTimer.remove(false);
      this.chartRevealTimer = undefined;
    }
    this.chartRevealExpectedStatus = undefined;
  }

  private scheduleChartReveal(
    delayMs: number,
    roundId: number,
    expectedStatus: RoundStatePayload['status'],
  ) {
    this.clearChartRevealTimer();
    this.chartRevealExpectedStatus = expectedStatus;
    this.chartRevealTimer = this.time.delayedCall(
      delayMs,
      () => {
        this.chartRevealTimer = undefined;
        this.chartRevealExpectedStatus = undefined;
        if (this.round?.status !== expectedStatus || this.round.id !== roundId) return;
        this.setResultLayoutVisible(false);
      },
      undefined,
      this,
    );
  }

  private buildDigitKey(digitType: DigitBetType, selection?: string) {
    return `DIGIT|${digitType}|${selection ?? ''}`;
  }

  private makeInteractive(
    image: Phaser.GameObjects.Image,
    handler: () => void,
  ) {
    image.setInteractive({ useHandCursor: true });
    let lastTapTime = 0;
    const debounceMs = 300; // Prevent double-tap on mobile
    image.on('pointerdown', () => {
      const now = Date.now();
      if (now - lastTapTime < debounceMs) return;
      lastTapTime = now;
      handler();
    });
  }

  private registerBetButton(image: Phaser.GameObjects.Image, digitType: DigitBetType) {
    const key = this.buildDigitKey(digitType);
    this.betTargets.set(key, image);
    image.setData('baseScale', image.scaleX);
    this.makeInteractive(image, () => this.handlePlaceDigitBet(digitType));
    // Payout ratios for SMALL, ODD, ANY_TRIPLE, EVEN, BIG are shown in title area
  }

  private registerDigitCell(
    image: Phaser.GameObjects.Image,
    digitType: DigitBetType,
    selection: string,
    oddsOffsetY = 22,
    fontSize = 15,
  ) {
    const key = this.buildDigitKey(digitType, selection);
    this.betTargets.set(key, image);
    image.setData('baseScale', image.scaleX);
    this.makeInteractive(image, () =>
      this.handlePlaceDigitBet(digitType, selection),
    );
    this.registerOddsText(key, image.x, image.y + oddsOffsetY, fontSize);
  }

  private registerChipButton(value: number, image: Phaser.GameObjects.Image) {
    this.chipButtons.set(value, { image, baseScale: image.scaleX });
    this.makeInteractive(image, () => this.handleSelectToken(value));
  }

  private registerOddsText(
    key: string,
    x: number,
    y: number,
    fontSize = 12,
  ) {
    const text = this.add
      .text(x, y, '', {
        fontFamily: 'Roboto Mono',
        fontSize: `${fontSize}px`,
        color: '#f8fafc',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
    text.setDepth(6);
    this.oddsTextByKey.set(key, text);
  }

  private handleSelectToken(value: number) {
    if (!this.handlers?.onSelectToken) return;
    this.handlers.onSelectToken(value);
  }

  private handleClearTokens() {
    if (!this.handlers?.onClearTokens) return;
    this.runHandler(() => this.handlers?.onClearTokens());
  }

  private setLockedBackgroundVisible(visible: boolean) {
    if (!this.lockedBackground) return;
    this.lockedBackground.setVisible(visible);
    if (visible) {
      this.lockedBackground
        .setDisplaySize(this.scale.width, this.scale.height)
        .setPosition(this.scale.width / 2, this.scale.height / 2)
        .setScrollFactor(0);
    }
    if (this.bgLightOverlay) {
      this.bgLightOverlay.setVisible(!visible);
    }
  }

  private openSettings() {
    if (this.handlers?.onOpenSettings) {
      this.handlers.onOpenSettings();
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:open-settings'));
    }
  }

  private openMenu() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:open-menu'));
    }
  }

  private handlePlaceDigitBet(digitType: DigitBetType, selection?: string) {
    if (!this.handlers?.onPlaceDigitBet) return;
    this.playBetChipSound();
    this.runHandler(() =>
      this.handlers?.onPlaceDigitBet({ digitType, selection }),
    );
  }

  private playBetChipSound() {
    if (!this.sound || !this.cache.audio.exists('bet_chip')) {
      return;
    }
    if (this.sound.locked) {
      return;
    }
    this.sound.play('bet_chip', { volume: 0.7 });
  }

  private playWinningCoinSound() {
    if (!this.sound || !this.cache.audio.exists('wining_gold_coin')) {
      return;
    }
    if (this.sound.locked) {
      return;
    }
    this.sound.play('wining_gold_coin', { volume: 0.85 });
  }

  private runHandler(action: () => Promise<void> | void) {
    try {
      const result = action();
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).catch((error) =>
          setStatus(
            error instanceof Error ? error.message : 'Action failed',
            true,
          ),
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Action failed', true);
    }
  }

  private applyConfigOdds(config?: GameConfig) {
    const smallBigOdds = config?.digitPayouts?.smallBigOddEven ?? 1;
    const anyTripleOdds = config?.digitPayouts?.anyTriple ?? 30;
    const commonText = `${formatPayoutRatio(smallBigOdds)} LOSE IF ANY TRIPLE`;
    this.oddsLeftText?.setText(commonText);
    this.oddsRightText?.setText(commonText);
    this.oddsCenterText?.setText(formatPayoutRatio(anyTripleOdds));
    this.updateBaseOdds(config);
    this.updateBonusOddsFromRound(this.round);
  }

  private updateTokenStyleMap(config?: GameConfig) {
    const tokenValues = Array.isArray(config?.tokenValues)
      ? config?.tokenValues
      : null;
    const normalized =
      tokenValues &&
      tokenValues.length === this.tokenStyleValues.length &&
      tokenValues.every((value) => Number.isFinite(value) && value > 0)
        ? tokenValues
        : this.tokenStyleValues;
    this.tokenStyleByValue.clear();
    normalized.forEach((value, index) => {
      const styleValue =
        this.tokenStyleValues[index] ?? this.tokenStyleValues[0];
      this.tokenStyleByValue.set(value, styleValue);
    });
  }

  private getTokenStyleValue(value: number) {
    return this.tokenStyleByValue.get(value) ?? value;
  }

  private updateBaseOdds(config?: GameConfig) {
    const payouts = config?.digitPayouts;
    const smallBig = payouts?.smallBigOddEven ?? 1;
    const anyTriple = payouts?.anyTriple ?? 30;
    const doubleOdds = payouts?.double ?? 1;
    const tripleOdds = payouts?.triple ?? 1;
    const singleOdds = payouts?.single?.single ?? 1;
    const singleDouble = payouts?.single?.double ?? 0;
    const singleTriple = payouts?.single?.triple ?? 0;

    this.doublePayoutText?.setText(formatPayoutRatio(doubleOdds));
    this.triplePayoutText?.setText(formatPayoutRatio(tripleOdds));
    this.singlePayoutText?.setText(formatPayoutRatio(singleOdds));
    this.singleDoubleMultiplierText?.setText(
      singleDouble > 0 ? formatMultiplierRatio(singleDouble) : '',
    );
    this.singleTripleMultiplierText?.setText(
      singleTriple > 0 ? formatMultiplierRatio(singleTriple) : '',
    );

    this.baseOddsByKey.set(this.buildDigitKey('SMALL'), smallBig);
    this.baseOddsByKey.set(this.buildDigitKey('BIG'), smallBig);
    this.baseOddsByKey.set(this.buildDigitKey('ODD'), smallBig);
    this.baseOddsByKey.set(this.buildDigitKey('EVEN'), smallBig);
    this.baseOddsByKey.set(this.buildDigitKey('ANY_TRIPLE'), anyTriple);

    ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'].forEach((value) => {
      this.baseOddsByKey.set(this.buildDigitKey('DOUBLE', value), doubleOdds);
    });

    [
      '000',
      '111',
      '222',
      '333',
      '444',
      '555',
      '666',
      '777',
      '888',
      '999',
    ].forEach((value) => {
      this.baseOddsByKey.set(this.buildDigitKey('TRIPLE', value), tripleOdds);
    });

    for (let digit = 0; digit <= 9; digit += 1) {
      this.baseOddsByKey.set(
        this.buildDigitKey('SINGLE', String(digit)),
        singleOdds,
      );
    }

    for (let sum = 3; sum <= 27; sum += 1) {
      const odds =
        (payouts?.sum as Record<string, number> | undefined)?.[String(sum)] ??
        DEFAULT_SUM_PAYOUTS[sum] ??
        0;
      this.baseOddsByKey.set(this.buildDigitKey('SUM', String(sum)), odds);
    }
  }

  private updateBonusOddsFromRound(round?: RoundStatePayload) {
    this.bonusOddsByKey.clear();
    const bonusEnabled = state.config?.bonusModeEnabled !== false;
    if (!round || !bonusEnabled || round.status !== 'RESULT_PENDING') {
      this.clearBonusHighlights();
      this.syncOddsText();
      return;
    }

    round.digitBonus?.slots?.forEach((slot) => {
      if (
        typeof slot.bonusRatio !== 'number' ||
        !Number.isFinite(slot.bonusRatio)
      ) {
        return;
      }
      const key = this.buildDigitKey(slot.digitType, slot.selection ?? '');
      this.bonusOddsByKey.set(key, slot.bonusRatio);
    });
    this.applyBonusHighlights();
    this.syncOddsText();
  }

  private getLockedLayoutScale() {
    return this.isLockedLayoutMode && !this.isLockedLayoutPending
      ? this.lockedLayoutScale
      : 1;
  }

  private clearBonusHighlights() {
    this.bonusTweens.forEach((tween) => tween.stop());
    this.bonusTweens.clear();
    this.bonusLightTweens.forEach((tween) => tween.stop());
    this.bonusLightTweens.clear();
    this.bonusLightSprites.forEach((sprite) => sprite.destroy());
    this.bonusLightSprites.clear();
    
    // When clearing highlights, respect locked layout mode
    const lockedScale = this.getLockedLayoutScale();
    
    this.betTargets.forEach((image) => {
      const baseScale = image.getData('baseScale');
      if (typeof baseScale === 'number') {
        image.setScale(baseScale * lockedScale);
      }
      image.setAlpha(1);
    });
  }

  private applyBonusHighlights() {
    this.clearBonusHighlights();
    if (this.textures.exists('number_light_box_2')) {
      this.ensureNumberLightAnimation();
    }
    
    // If in locked layout mode, use scaled values
    const lockedScale = this.getLockedLayoutScale();
    const shouldPause = this.isLockedLayoutMode && !this.isLockedLayoutPending;
    
    this.bonusOddsByKey.forEach((_ratio, key) => {
      const image = this.betTargets.get(key);
      if (!image) return;
      const baseScale = image.getData('baseScale') as number | undefined;
      const scale = typeof baseScale === 'number' ? baseScale : 0.75;
      
      // Apply locked scale to the pulse animation
      const effectiveScale = scale * lockedScale;
      
      const tween = this.tweens.add({
        targets: image,
        scaleX: effectiveScale * 1.04,
        scaleY: effectiveScale * 1.04,
        alpha: 0.75,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      
      // If in locked mode, pause the tween immediately
      if (shouldPause) {
        tween.pause();
      }
      
      this.bonusTweens.set(key, tween);

      if (this.textures.exists('number_light_box_2')) {
        const light =
          this.bonusLightSprites.get(key) ??
          this.add.sprite(image.x, image.y, 'number_light_box_2', 0);
        const frameWidth = 270;
        const frameHeight = 109;
        const scaleX = (image.displayWidth / frameWidth) * 1.08;
        const scaleY = (image.displayHeight / frameHeight) * 1.08;
        light.setPosition(image.x, image.y);
        light.setScale(scaleX, scaleY);
        light.setAlpha(0.85);
        light.setDepth(19);
        light.setBlendMode(Phaser.BlendModes.ADD);
        if (!light.anims.isPlaying) {
          light.play('number-light-box');
        }
        this.bonusLightSprites.set(key, light);

        const lightTween = this.tweens.add({
          targets: light,
          alpha: 1,
          scaleX: scaleX * 1.03,
          scaleY: scaleY * 1.03,
          duration: 520,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.bonusLightTweens.set(key, lightTween);
      }
    });
  }

  private syncOddsText() {
    this.oddsTextByKey.forEach((text, key) => {
      const bonusValue = this.bonusOddsByKey.get(key);
      const baseValue = this.baseOddsByKey.get(key);
      if (
        (key.startsWith('DIGIT|TRIPLE|') ||
          key.startsWith('DIGIT|DOUBLE|') ||
          key.startsWith('DIGIT|SINGLE|')) &&
        bonusValue === undefined
      ) {
        text.setText('');
        text.setColor('#f8fafc');
        return;
      }
      const value =
        typeof bonusValue === 'number' && Number.isFinite(bonusValue)
          ? bonusValue
          : baseValue ?? 0;
      text.setText(value ? formatPayoutRatio(value) : '');
      if (bonusValue !== undefined) {
        text.setColor('#ffd166');
      } else {
        text.setColor('#f8fafc');
      }
    });
  }
  private syncSelectedToken(selectedTokenValue: number) {
    this.chipButtons.forEach(({ image, baseScale }, value) => {
      const isSelected = value === selectedTokenValue;
      image.setScale(isSelected ? baseScale * 1.12 : baseScale);
      if (isSelected) {
        image.setTint(0xffffff);
      } else {
        image.clearTint();
      }
    });
  }

  private syncTokenPlacements(
    placements: Record<string, { value: number; count: number }>,
  ) {
    const activeKeys = new Set(Object.keys(placements ?? {}));
    this.tokenSprites.forEach((sprite, key) => {
      if (!activeKeys.has(key)) {
        sprite.destroy();
        this.tokenSprites.delete(key);
      }
    });

    Object.entries(placements ?? {}).forEach(([key, placement]) => {
      const target = this.betTargets.get(key);
      if (!target) return;
      const total = placement.value * placement.count;
      let container = this.tokenSprites.get(key);
      const styleValue = this.getTokenStyleValue(placement.value);
      if (!container) {
        const chip = this.add.image(0, 0, `chip_${styleValue}`);
        chip.setScale(0.78); // 50% larger than previous 0.52
        const label = this.add
          .text(0, 0, String(total), {
            fontFamily: 'Rajdhani',
            fontSize: '35px', // 50% larger than 23px
            color: '#00ff88', // bright green
            fontStyle: 'bold',
            stroke: '#003311',
            strokeThickness: 3,
          })
          .setOrigin(0.5);
        container = this.add.container(target.x + 58, target.y, [chip, label]);
        container.setDepth(20);
        this.tokenSprites.set(key, container);
      } else {
        const chip = container.list[0] as Phaser.GameObjects.Image;
        const label = container.list[1] as Phaser.GameObjects.Text;
        chip.setTexture(`chip_${styleValue}`);
        label.setText(String(total));
      }
    });
  }

  private syncActiveSelections(
    selections: Array<{ digitType: DigitBetType; selection: string | null }>,
  ) {
    const activeKeys = new Set(
      selections.map((selection) =>
        this.buildDigitKey(selection.digitType, selection.selection ?? ''),
      ),
    );
    this.betTargets.forEach((image, key) => {
      if (activeKeys.has(key)) {
        image.setTint(0x00ffb2);
      } else {
        image.clearTint();
      }
    });
  }

  private syncDigitResult(digits: string | null) {
    if (!digits || !/^\d{3}$/.test(digits)) {
      return;
    }
    this.setRoundDigitText(digits);
  }

  private syncDigitSum(sum: number | null, digits?: string | null) {
    let resolved: number | null =
      typeof sum === 'number' && Number.isFinite(sum) ? sum : null;
    if (resolved === null && digits && /^\d{3}$/.test(digits)) {
      resolved = digits.split('').reduce((acc, digit) => acc + Number(digit), 0);
    }
    const display = resolved === null ? '--' : String(resolved);
    if (this.sumTriangleText) {
      this.sumTriangleText.setText(display);
    }
    if (this.round?.status === 'COMPLETED' && resolved !== null) {
      this.lastSumTriangleValue = display;
    }
  }

  private setRoundDigitText(digits: string) {
    if (!/^\d{3}$/.test(digits)) return;
    if (this.roundDigitsLeftText && this.roundDigitsCenterText && this.roundDigitsRightText) {
      this.roundDigitsLeftText.setText(digits[0]);
      this.roundDigitsCenterText.setText(digits[1]);
      this.roundDigitsRightText.setText(digits[2]);
    }
  }

  private syncLiveDigitsFromPrice(price: number) {
    if (!Number.isFinite(price)) return;
    const priceStr = price.toFixed(2);
    const [intPart, decPart = '00'] = priceStr.split('.');
    const lastDigit = intPart.slice(-1) || '0';
    const decimals = decPart.padEnd(2, '0').slice(0, 2);
    this.setRoundDigitText(`${lastDigit}${decimals}`);
  }

  private syncBalance(balance: number) {
    if (!this.balanceText) return;
    this.balanceText.setText(`${balance.toFixed(2)} USDT`);
  }

  update() {
    this.updateTimerText();
  }

  private updateTimerText() {
    if (!this.round || !this.timerText) return;
    const now = Date.now();
    const isBetting = this.round.status === 'BETTING';
    const targetTime = isBetting
      ? new Date(this.round.lockTime).getTime()
      : new Date(this.round.endTime).getTime();
    const remaining = Math.max(targetTime - now, 0);
    const seconds = Math.ceil(remaining / 1000);
    this.timerText.setText(`${seconds}s`);

    // Urgency effect when 5 seconds or less
    const isUrgent = seconds <= 5 && seconds > 0;
    const showBigCountdown =
      isUrgent &&
      (this.round.status === 'BETTING' || this.round.status === 'RESULT_PENDING');

    if (isUrgent) {
      // Set urgent color (red/orange)
      this.timerText.setColor('#ff4757');

      // Start blinking tween if not already running or if seconds changed
      if (!this.timerUrgencyTween || !this.timerUrgencyTween.isPlaying() || this.lastTimerSeconds !== seconds) {
        if (this.timerUrgencyTween) {
          this.timerUrgencyTween.stop();
        }

        this.timerText.setScale(1);
        this.timerUrgencyTween = this.tweens.add({
          targets: this.timerText,
          scaleX: 1.15,
          scaleY: 1.15,
          alpha: 0.6,
          duration: 200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    } else {
      // Normal state - stop urgency effects
      if (this.timerUrgencyTween) {
        this.timerUrgencyTween.stop();
        this.timerUrgencyTween = undefined;
      }
      this.timerText.setScale(1);
      this.timerText.setAlpha(1);
      this.timerText.setColor(isBetting ? '#00ffb2' : '#ff8f70');
    }

    // ── Big countdown overlay ────────────────────────────────────
    if (showBigCountdown && this.bigCountdownText) {
      this.bigCountdownText.setVisible(true);

      if (this.lastBigCountdownSec !== seconds) {
        // Color gradient: 5→yellow, 4→orange, 3→red-orange, 2→red, 1→bright red
        const urgencyColors: Record<number, string> = {
          5: '#ffd166',
          4: '#ff9f43',
          3: '#ff6b6b',
          2: '#ff4757',
          1: '#ff1744',
        };
        const shadowColors: Record<number, string> = {
          5: 'rgba(255,209,102,0.55)',
          4: 'rgba(255,159,67,0.55)',
          3: 'rgba(255,107,107,0.55)',
          2: 'rgba(255,71,87,0.55)',
          1: 'rgba(255,23,68,0.7)',
        };
        const col = urgencyColors[seconds] ?? '#ff4757';
        const shd = shadowColors[seconds] ?? 'rgba(255,71,87,0.55)';

        this.bigCountdownText.setText(`${seconds}`);
        this.bigCountdownText.setColor(col);
        this.bigCountdownText.setShadow(0, 0, shd, 24, true, true);

        // Pop-in animation for each new digit
        if (this.bigCountdownTween) {
          this.bigCountdownTween.stop();
        }
        this.bigCountdownText.setScale(2.2);
        this.bigCountdownText.setAlpha(0.2);
        this.bigCountdownTween = this.tweens.add({
          targets: this.bigCountdownText,
          scale: 1,
          alpha: 1,
          duration: 300,
          ease: 'Back.Out',
        });

        this.lastBigCountdownSec = seconds;
      }
    } else if (this.bigCountdownText && this.bigCountdownText.visible) {
      // Hide big countdown
      if (this.bigCountdownTween) {
        this.bigCountdownTween.stop();
        this.bigCountdownTween = undefined;
      }
      this.bigCountdownText.setVisible(false);
      this.bigCountdownText.setAlpha(0);
      this.lastBigCountdownSec = -1;
    }

    this.lastTimerSeconds = seconds;

    // Sync sonar dot color on the TradingView chart
    setSonarUrgent(showBigCountdown);
  }

  setLanguage(lang: LanguageCode) {
    this.language = lang;
    if (!this.uiReady) return;
    if (this.round) {
      this.roundText?.setText(`${this.round.id}`);
      if (this.round.status === 'BETTING') {
        this.statusText?.setText(t(this.language, 'scene.betsOpen'));
      } else if (this.round.status === 'RESULT_PENDING') {
        this.statusText?.setText(t(this.language, 'scene.locked'));
      }
    } else {
      this.roundText?.setText(`--`);
      this.statusText?.setText(t(this.language, 'scene.connecting'));
    }
  }

  setPrice(update: PriceUpdate) {
    const previous = this.lastPrice?.price;
    this.lastPrice = update;

    if (!this.round || this.round.status !== 'COMPLETED') {
      this.syncLiveDigitsFromPrice(update.price);
    }

    // Split price into parts: prefix, last 3 digits (1 before decimal + 2 after decimal)
    // Example: "75649.99" -> "7564" + "9.99"
    const priceStr = update.price.toFixed(2);
    const [intPart, decPart] = priceStr.split('.');
    const lastDigit = intPart.slice(-1); // Last digit before decimal
    const prefix = intPart.slice(0, -1); // All digits except last one
    const highlight = `${lastDigit}.${decPart}`; // e.g., "9.99"
    
    // Update text content
    this.priceText?.setText(prefix);
    this.priceTextHighlight?.setText(highlight);
    this.priceTextDecimal?.setText(''); // Not used anymore
    
    // Position the text elements to form continuous price display
    const centerX = 540;
    const prefixWidth = this.priceText?.width ?? 0;
    const highlightWidth = this.priceTextHighlight?.width ?? 0;
    const totalWidth = prefixWidth + highlightWidth;
    
    const startX = centerX - totalWidth / 2;
    this.priceText?.setX(startX + prefixWidth);
    this.priceTextHighlight?.setX(startX + prefixWidth);

    if (previous !== undefined && this.priceArrowText) {
      const isUp = update.price >= previous;
      const baseColor = isUp ? '#00ffb2' : '#ff7675';
      const arrow = isUp ? '▲' : '▼';
      const offset = isUp ? -6 : 6;

      // Set colors - highlight last 3 digits during locked/result phase
      this.priceText?.setColor(baseColor);
      
      // Highlight color for last 3 digits (1 digit + decimal + 2 digits) during locked phase
      if (this.isLockedLayoutMode) {
        this.priceTextHighlight?.setColor('#ffff00'); // Bright yellow highlight
      } else {
        this.priceTextHighlight?.setColor(baseColor);
      }
      
      this.priceArrowText.setText(arrow).setColor(baseColor).setAlpha(1);

      this.tweens.killTweensOf(this.priceArrowText);
      this.priceArrowText.y = this.priceTextY;
      this.tweens.add({
        targets: this.priceArrowText,
        y: this.priceTextY + offset,
        alpha: 0.5,
        duration: 400,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    }
  }

  setRoundState(state: RoundStatePayload) {
    const shouldDefer =
      state.status === 'BETTING' &&
      !!this.resultOverlay &&
      this.resultOverlayEndsAt > this.time.now;

    if (
      this.pendingRoundState &&
      (state.status !== 'BETTING' || state.id !== this.pendingRoundState.id)
    ) {
      this.clearPendingRoundState();
    }

    if (shouldDefer) {
      this.round = state;
      const delay = Math.max(0, this.resultOverlayEndsAt - this.time.now);
      this.deferRoundState(state, delay);
      return;
    }

    this.applyRoundState(state);
  }

  private applyRoundState(state: RoundStatePayload) {
    const enteringLocked = state.status === 'RESULT_PENDING' && !this.isLockedLayoutMode;
    this.clearPendingRoundState();
    this.round = state;
    this.roundText?.setText(`${state.id}`);
    this.setPendingLayoutVisible(state.status === 'PENDING');
    const isNewRound = this.lastSeenRoundId !== state.id;

    if (this.chartRevealTimer && this.chartRevealExpectedStatus !== state.status) {
      this.clearChartRevealTimer();
    }
    if (state.status !== 'RESULT_PENDING') {
      this.clearLockedBanners();
    }

    if (state.status === 'COMPLETED') {
      this.setResultLayoutVisible(true);
    } else if (state.status === 'BETTING') {
      if (isNewRound) {
        this.setResultLayoutVisible(true);
        this.scheduleChartReveal(1000, state.id, 'BETTING');
      } else if (!this.chartRevealTimer) {
        this.setResultLayoutVisible(false);
      }
    } else if (state.status === 'RESULT_PENDING') {
      if (enteringLocked) {
        this.setResultLayoutVisible(true);
        this.scheduleChartReveal(this.LOCKED_LAYOUT_DELAY_MS, state.id, 'RESULT_PENDING');
      }
    } else {
      this.setResultLayoutVisible(false);
    }
    
    // Handle layout transitions BEFORE updating bonus odds
    // so that applyBonusHighlights knows the correct layout mode
    if (state.status === 'BETTING') {
      this.clearWinnerHighlights();
      this.exitLockedLayout();
      this.sumTriangleText?.setVisible(false);
      this.lastSumTriangleValue = null;
      this.sumTriangleTimer?.remove(false);
      this.sumTriangleTimer = undefined;
      this.winnerHighlightTimer?.remove(false);
      this.winnerHighlightTimer = undefined;
      this.statusText?.setText(t(this.language, 'scene.betsOpen'));
      this.statusText?.setColor('#00ffb2');

      // Show "Round Start!" banner once per new round
      if (this.lastSeenRoundId !== state.id) {
        this.lastSeenRoundId = state.id;
        this.showRoundStartBanner();
      }
    } else if (state.status === 'RESULT_PENDING') {
      if (enteringLocked) {
        this.showLockedPhaseBanners();
      }
      this.enterLockedLayout();
      this.sumTriangleText?.setVisible(false);
      this.statusText?.setText(t(this.language, 'scene.locked'));
      this.statusText?.setColor('#ffd166');
    } else if (state.status === 'COMPLETED') {
      // Restore open layout during result display phase
      this.exitLockedLayout();
      this.sumTriangleText?.setVisible(false);
      this.statusText?.setText(t(this.language, 'scene.roundResult'));
      this.statusText?.setColor('#b2bec3');
    } else {
      this.sumTriangleText?.setVisible(false);
      this.statusText?.setText(t(this.language, 'scene.roundResult'));
      this.statusText?.setColor('#b2bec3');
    }
    
    // Update bonus odds after layout mode is set
    this.updateBonusOddsFromRound(state);
  }

  handleRoundLock(payload: RoundLockPayload) {
    if (!this.round || this.round.id !== payload.roundId) return;
    this.round = {
      ...this.round,
      status: 'RESULT_PENDING',
      lockedPrice: payload.lockedPrice,
      digitBonus: payload.digitBonus ?? this.round.digitBonus,
    };
    this.setRoundState(this.round);
  }

  clearPlayerBets() {
    this.tokenSprites.forEach((sprite) => sprite.destroy());
    this.tokenSprites.clear();
    this.betTargets.forEach((image) => image.clearTint());
  }

  setBalance(amount: number) {
    this.syncBalance(amount);
  }

  handleRoundResult(payload: RoundResultPayload) {
    if (!this.round || this.round.id !== payload.roundId) return;

    this.round = {
      ...this.round,
      status: 'COMPLETED',
      finalPrice: payload.finalPrice ?? null,
      winningSide: payload.winningSide,
    };

    if (payload.digitResult && /^\d{3}$/.test(payload.digitResult)) {
      this.syncDigitResult(payload.digitResult);
    }
    this.syncDigitSum(payload.digitSum, payload.digitResult);
    this.setRoundState(this.round);
    this.showResultOverlay('SKIPPED', payload);
    this.playResultPlusLight();
  }

  private clearWinnerHighlights() {
    this.clearWinnerEffects();
    this.winnerTweens.forEach((tween) => tween.stop());
    this.winnerTweens.clear();
    this.winnerLightTweens.forEach((tween) => tween.stop());
    this.winnerLightTweens.clear();
    this.winnerLightSprites.forEach((sprite) => sprite.destroy());
    this.winnerLightSprites.clear();
    this.betTargets.forEach((image) => {
      image.setAlpha(1);
      image.clearTint();
      const baseScaleX = image.getData('winnerBaseScaleX') as number | undefined;
      const baseScaleY = image.getData('winnerBaseScaleY') as number | undefined;
      const baseBlend = image.getData('winnerBaseBlend') as number | undefined;
      if (typeof baseScaleX === 'number' && typeof baseScaleY === 'number') {
        image.setScale(baseScaleX, baseScaleY);
      }
      if (typeof baseBlend === 'number') {
        image.setBlendMode(baseBlend);
      }
    });
  }

  setResultDisplayDuration(durationMs: number) {
    if (!Number.isFinite(durationMs)) {
      return;
    }
    this.resultDisplayDurationMs = Math.max(durationMs, 0);
  }

  setPlayerPayout(roundId: number, totalStake: number, totalPayout: number) {
    // Store net win for floating payout text during coin animation
    this.pendingWinPayout = Math.max(totalPayout - totalStake, 0);

    if (!this.resultOverlay || this.resultRoundId !== roundId || !this.resultPayoutText || !this.resultTitleText) return;

    const net = totalPayout - totalStake;

    if (totalStake === 0) {
      this.resultTitleText.setText(t(this.language, 'scene.skippedRound')).setColor('#636e72');
      this.resultPayoutText.setText(t(this.language, 'scene.noBetsPlaced')).setColor('#b2bec3');
    } else {
      const sign = net >= 0 ? '+' : '-';
      this.resultPayoutText.setText(
        `${t(this.language, 'scene.payout')}: ${totalPayout.toFixed(2)} (${sign}${Math.abs(net).toFixed(2)})`,
      );
      this.resultPayoutText.setColor(net >= 0 ? '#00b894' : '#d63031');
    }
  }

  setRoundOutcome(roundId: number, outcome: 'WIN' | 'LOSE' | 'PUSH' | 'SKIPPED') {
    if (!this.resultOverlay || this.resultRoundId !== roundId || !this.resultTitleText) return;

    let titleStr = t(this.language, 'scene.roundResult');
    let color = '#b2bec3';
    if (outcome === 'WIN') {
      titleStr = t(this.language, 'scene.youWin');
      color = '#00b894';
    } else if (outcome === 'PUSH') {
      titleStr = t(this.language, 'scene.push');
      color = '#b2bec3';
    } else if (outcome === 'SKIPPED') {
      titleStr = t(this.language, 'scene.skippedRound');
      color = '#636e72';
    } else {
      titleStr = t(this.language, 'scene.roundResult');
      color = '#b2bec3';
    }

    this.resultTitleText.setText(titleStr).setColor(color);
  }

  setWinningBets(
    roundId: number,
    bets: Array<{
      betType: string;
      side: string | null;
      digitType: string | null;
      selection: string | null;
      result: string;
    }>,
  ) {
    if (!this.resultOverlay || this.resultRoundId !== roundId) return;

    const wins = bets.filter((b) => b.result === 'WIN');
    const labels = wins.map((b) => {
      if (!b.digitType) return 'DIGIT';
      const sel = b.selection ?? '';
      switch (b.digitType) {
        case 'ANY_TRIPLE':
          return 'ANY TRIPLE';
        case 'SMALL':
        case 'BIG':
        case 'ODD':
        case 'EVEN':
          return b.digitType;
        case 'SUM':
          return `SUM ${sel}`;
        case 'SINGLE':
          return `SINGLE ${sel}`;
        case 'DOUBLE':
          return `DOUBLE ${sel}`;
        case 'TRIPLE':
          return `TRIPLE ${sel}`;
        default:
          return `${b.digitType}${sel ? ` ${sel}` : ''}`;
      }
    });

    const winKeys = new Set(
      wins
        .filter((b) => b.digitType)
        .map((b) => this.buildDigitKey(b.digitType as DigitBetType, b.selection ?? '')),
    );
    const triggerHighlights = () => {
      this.applyWinnerHighlights(winKeys);
    };
    const delay = Math.max(0, this.layoutRestoreEndsAt - this.time.now);
    if (delay > 0) {
      this.winnerHighlightTimer?.remove(false);
      this.winnerHighlightTimer = this.time.delayedCall(
        delay,
        triggerHighlights,
        undefined,
        this,
      );
    } else {
      triggerHighlights();
    }

    const text = labels.length ? `YOUR WINNING BETS: ${labels.join(' • ')}` : '';

    if (!this.resultPlayerWinsText) {
      this.resultPlayerWinsText = this.add
        .text(0, 95, text, {
          fontFamily: 'Rajdhani',
          fontSize: '20px',
          color: '#00ffb2',
          align: 'center',
          wordWrap: { width: 440, useAdvancedWrap: true },
        })
        .setOrigin(0.5)
        .setLineSpacing(6);
      const modal = this.resultOverlay.getAt(0);
      if (modal && modal instanceof Phaser.GameObjects.Container) {
        modal.add(this.resultPlayerWinsText);
      } else {
        this.resultOverlay.add(this.resultPlayerWinsText);
      }
      if (this.resultPayoutText) {
        this.resultPayoutText.setY(text ? 130 : 110);
      }
      return;
    }

    this.resultPlayerWinsText.setText(text);

    if (this.resultPayoutText) {
      this.resultPayoutText.setY(text ? 130 : 110);
    }
  }

  private applyWinnerHighlights(winKeys: Set<string>) {
    this.clearWinnerHighlights();
    this.ensureNumberLightAnimation();
    winKeys.forEach((key) => {
      const image = this.betTargets.get(key);
      if (!image) return;
      const baseY = image.y;
      const baseScaleX = image.scaleX;
      const baseScaleY = image.scaleY;
      if (image.getData('winnerBaseScaleX') === undefined) {
        image.setData('winnerBaseScaleX', baseScaleX);
        image.setData('winnerBaseScaleY', baseScaleY);
        image.setData('winnerBaseBlend', image.blendMode);
      }
      image.setTint(0x00ffb2);
      image.setBlendMode(Phaser.BlendModes.ADD);
      const tween = this.tweens.add({
        targets: image,
        y: baseY - 6,
        alpha: 0.5,
        scaleX: baseScaleX * 1.08,
        scaleY: baseScaleY * 1.08,
        duration: 180,
        yoyo: true,
        repeat: 16,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          image.setAlpha(1);
          image.setTint(0x00ffb2);
          image.y = baseY;
          image.setScale(baseScaleX, baseScaleY);
          const baseBlend = image.getData('winnerBaseBlend') as number | undefined;
          if (typeof baseBlend === 'number') {
            image.setBlendMode(baseBlend);
          }
        },
      });
      this.winnerTweens.set(key, tween);

      const light =
        this.winnerLightSprites.get(key) ??
        this.add.sprite(image.x, image.y, 'number_light_box_2', 0);
      const frameWidth = 270;
      const frameHeight = 109;
      const scaleX = (image.displayWidth / frameWidth) * 1.1;
      const scaleY = (image.displayHeight / frameHeight) * 1.1;
      light.setPosition(image.x, baseY);
      light.setScale(scaleX, scaleY);
      light.setAlpha(0.9);
      light.setDepth(26);
      light.setBlendMode(Phaser.BlendModes.ADD);
      if (!light.anims.isPlaying) {
        light.play('number-light-box');
      }
      this.winnerLightSprites.set(key, light);

      const lightTween = this.tweens.add({
        targets: light,
        y: baseY - 6,
        alpha: 1,
        scaleX: scaleX * 1.04,
        scaleY: scaleY * 1.04,
        duration: 180,
        yoyo: true,
        repeat: 16,
        ease: 'Sine.easeInOut',
      });
      this.winnerLightTweens.set(key, lightTween);
    });

    this.playWinnerLightningAndCoins(winKeys);
  }

  // ── Winner lightning-bolt & coin-explosion effects ─────────────────

  private clearWinnerEffects() {
    this.lightningBoltTweens.forEach((tw) => tw.stop());
    this.lightningBoltTweens = [];
    this.lightningGraphics.forEach((g) => g.destroy());
    this.lightningGraphics = [];
    this.lightningTimers.forEach((t) => t.remove(false));
    this.lightningTimers = [];
    this.coinSprites.forEach((s) => {
      if (s.scene) s.destroy();
    });
    this.coinSprites = [];
    if (this.payoutFloatText) {
      this.payoutFloatText.destroy();
      this.payoutFloatText = undefined;
    }
  }

  private ensureMoneyAnimation() {
    if (this.anims.exists('money-spin') || !this.textures.exists('money_anim')) return;
    this.anims.create({
      key: 'money-spin',
      frames: this.anims.generateFrameNumbers('money_anim', { start: 0, end: 15 }),
      frameRate: 24,
      repeat: -1,
    });
  }

  private ensureLightningDotTexture() {
    if (this.textures.exists('_lightning_dot')) return;
    const g = this.add.graphics();
    g.setVisible(false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 4);
    g.fillStyle(0x88ccff, 0.4);
    g.fillCircle(8, 8, 8);
    g.generateTexture('_lightning_dot', 16, 16);
    g.destroy();
  }

  /**
   * Launch lightning bolts from the 3-digit / sum display area to each
   * winning bet slot, then spawn a coin explosion on impact.
   */
  private playWinnerLightningAndCoins(winKeys: Set<string>) {
    this.clearWinnerEffects();
    if (!this.textures.exists('money_anim')) return;
    this.ensureMoneyAnimation();
    this.ensureLightningDotTexture();

    // Source positions – digit result boxes vs sum triangle
    const digitSrcX = 538;
    const digitSrcY = 181;
    const sumSrcX = 535;
    const sumSrcY = 290;

    let idx = 0;
    winKeys.forEach((key) => {
      const img = this.betTargets.get(key);
      if (!img) return;
      const isSumBet = key.startsWith('DIGIT|SUM|');
      const srcX = isSumBet ? sumSrcX : digitSrcX;
      const srcY = isSumBet ? sumSrcY : digitSrcY;
      const staggerDelay = idx * 130;

      const timer = this.time.delayedCall(staggerDelay, () => {
        this.animateLightningBolt(srcX, srcY, img.x, img.y, 380, () => {
          this.spawnCoinExplosion(img.x, img.y, 12);
        });
      });
      this.lightningTimers.push(timer);
      idx++;
    });
  }

  /**
   * Animate a single lightning bolt traveling from (sx,sy) to (ex,ey).
   * Calls `onStrike` when the bolt reaches the target.
   */
  private animateLightningBolt(
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    duration: number,
    onStrike: () => void,
  ) {
    const gfx = this.add.graphics();
    gfx.setDepth(140);
    gfx.setBlendMode(Phaser.BlendModes.ADD);
    this.lightningGraphics.push(gfx);

    // Pre-compute full zigzag path from source to target
    const segments = 10;
    const displacement = 55;
    const fullPath: { x: number; y: number }[] = [{ x: sx, y: sy }];
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      fullPath.push({
        x: Phaser.Math.Linear(sx, ex, t) + (Math.random() - 0.5) * displacement,
        y: Phaser.Math.Linear(sy, ey, t) + (Math.random() - 0.5) * displacement * 0.35,
      });
    }
    fullPath.push({ x: ex, y: ey });

    let struck = false;
    const tracker = { progress: 0 };

    const tween = this.tweens.add({
      targets: tracker,
      progress: 1,
      duration,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        gfx.clear();
        const p = tracker.progress;
        const totalSegs = fullPath.length - 1;
        const drawEnd = p * totalSegs;
        const lastFull = Math.floor(drawEnd);
        const frac = drawEnd - lastFull;

        // Build the visible portion of the path
        const pts = fullPath.slice(0, lastFull + 1);
        if (lastFull < totalSegs && frac > 0) {
          const a = fullPath[lastFull];
          const b = fullPath[lastFull + 1];
          pts.push({
            x: a.x + (b.x - a.x) * frac,
            y: a.y + (b.y - a.y) * frac,
          });
        }
        if (pts.length < 2) return;

        // Draw bolt in multiple layers (glow → core)
        const strokePath = (w: number, c: number, al: number) => {
          gfx.lineStyle(w, c, al);
          gfx.beginPath();
          gfx.moveTo(pts[0].x, pts[0].y);
          for (let j = 1; j < pts.length; j++) gfx.lineTo(pts[j].x, pts[j].y);
          gfx.strokePath();
        };

        strokePath(10, 0x1a3366, 0.3);
        strokePath(5, 0x4488ff, 0.55);
        strokePath(2, 0xaaddff, 0.85);
        strokePath(1, 0xffffff, 1);

        // Random branch bolt for extra detail
        if (pts.length > 3 && Math.random() < 0.35) {
          const bi = 1 + Math.floor(Math.random() * (pts.length - 2));
          const ba = Math.random() * Math.PI * 2;
          const bl = 12 + Math.random() * 28;
          gfx.lineStyle(1.5, 0x66aaff, 0.4);
          gfx.beginPath();
          gfx.moveTo(pts[bi].x, pts[bi].y);
          gfx.lineTo(
            pts[bi].x + Math.cos(ba) * bl,
            pts[bi].y + Math.sin(ba) * bl,
          );
          gfx.strokePath();
        }

        // Glowing tip at the front of the bolt
        const tip = pts[pts.length - 1];
        gfx.fillStyle(0xffffff, 0.7);
        gfx.fillCircle(tip.x, tip.y, 5);

        // Trailing particle at tip
        if (this.textures.exists('_lightning_dot') && Math.random() < 0.5) {
          const dot = this.add.image(
            tip.x + (Math.random() - 0.5) * 10,
            tip.y + (Math.random() - 0.5) * 10,
            '_lightning_dot',
          );
          dot.setDepth(141).setBlendMode(Phaser.BlendModes.ADD);
          dot.setScale(0.3 + Math.random() * 0.4);
          this.tweens.add({
            targets: dot,
            alpha: 0,
            scale: 0.05,
            duration: 180,
            onComplete: () => dot.destroy(),
          });
        }
      },
      onComplete: () => {
        if (struck) return;
        struck = true;
        onStrike();

        // Bright impact flash at target
        const flash = this.add.graphics();
        flash.setDepth(142);
        flash.setBlendMode(Phaser.BlendModes.ADD);
        flash.fillStyle(0xffffff, 0.85);
        flash.fillCircle(ex, ey, 30);
        flash.fillStyle(0x66aaff, 0.4);
        flash.fillCircle(ex, ey, 55);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 250,
          onComplete: () => flash.destroy(),
        });

        // Hold bolt briefly then fade out
        const fadeTimer = this.time.delayedCall(100, () => {
          this.tweens.add({
            targets: gfx,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              gfx.destroy();
              const gi = this.lightningGraphics.indexOf(gfx);
              if (gi >= 0) this.lightningGraphics.splice(gi, 1);
            },
          });
        });
        this.lightningTimers.push(fadeTimer);
      },
    });

    this.lightningBoltTweens.push(tween);
  }

  /**
   * Spawn spinning coin sprites at (cx,cy). Phase 1 bursts them TOWARD
   * THE CAMERA (dramatic scale-up). Phase 2 sends them all flying to the
   * player-balance corner, shows a floating "+X.XX" payout, and pulses
   * the balance text.
   */
  private spawnCoinExplosion(cx: number, cy: number, count: number) {
    if (!this.textures.exists('money_anim')) return;
    const balX = this.balanceText?.x ?? 974;
    const balY = this.balanceText?.y ?? 200;

    for (let i = 0; i < count; i++) {
      const coin = this.add.sprite(
        cx,
        cy,
        'money_anim',
        Math.floor(Math.random() * 16),
      );
      coin.setScale(0.12);
      coin.setAlpha(0.9);
      coin.setDepth(145);
      coin.play('money-spin');
      this.coinSprites.push(coin);

      // Phase 1 – burst TOWARD CAMERA (scale up dramatically + slight drift)
      const burstScale = 1.2 + Math.random() * 0.6;
      const driftX = cx + (Math.random() - 0.5) * 90;
      const driftY = cy + (Math.random() - 0.5) * 70;
      const stagger = i * 22;

      this.tweens.add({
        targets: coin,
        x: driftX,
        y: driftY,
        scale: burstScale,
        alpha: 1,
        duration: 280 + Math.random() * 80,
        delay: stagger,
        ease: 'Back.Out',
        onComplete: () => {
          // Phase 2 – shrink & fly to balance display
          this.tweens.add({
            targets: coin,
            x: balX + (Math.random() - 0.5) * 22,
            y: balY + (Math.random() - 0.5) * 10,
            scale: 0.28,
            alpha: { from: 1, to: 0.6 },
            duration: 450 + Math.random() * 200,
            delay: Math.random() * 80,
            ease: 'Sine.easeIn',
            onComplete: () => {
              coin.destroy();
              const ci = this.coinSprites.indexOf(coin);
              if (ci >= 0) this.coinSprites.splice(ci, 1);
            },
          });
        },
      });
    }

    // ── Arrival effects (once per round, not per slot) ──────────
    const arrivalDelay = 650;

    // Pulse balance text when coins land
    if (this.balanceText) {
      const balRef = this.balanceText;
      this.time.delayedCall(arrivalDelay, () => {
        if (!balRef.scene) return;
        this.tweens.add({
          targets: balRef,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 90,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.easeInOut',
        });
      });
    }

    // Winning coin sound (play once per round)
    if (this.pendingWinPayout > 0 && !this.winCoinSoundPlayed) {
      this.winCoinSoundPlayed = true;
      this.time.delayedCall(arrivalDelay, () => {
        this.playWinningCoinSound();
      });
    }

    // Floating "+X.XX" payout text (show only once across all slots)
    if (this.pendingWinPayout > 0 && !this.payoutFloatText) {
      const payoutStr = `+${this.pendingWinPayout.toFixed(2)}`;
      this.time.delayedCall(arrivalDelay, () => {
        this.showPayoutFloatText(balX, balY, payoutStr);
      });
    }
  }

  /**
   * Pop-in a green "+X.XX" label near the balance, hold, then float up
   * and fade out.
   */
  private showPayoutFloatText(x: number, y: number, text: string) {
    if (this.payoutFloatText) {
      this.payoutFloatText.destroy();
      this.payoutFloatText = undefined;
    }

    const ft = this.add
      .text(x, y + 40, text, {
        fontFamily: 'Roboto Mono',
        fontSize: '34px',
        color: '#00ffb2',
        fontStyle: 'bold',
        stroke: '#003311',
        strokeThickness: 4,
        shadow: {
          offsetX: 0,
          offsetY: 2,
          color: 'rgba(0,0,0,0.55)',
          blur: 10,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setScale(0)
      .setAlpha(1);

    this.payoutFloatText = ft;

    // Pop in with overshoot
    this.tweens.add({
      targets: ft,
      scale: 1.15,
      duration: 280,
      ease: 'Back.Out',
      onComplete: () => {
        // Settle to normal size
        this.tweens.add({
          targets: ft,
          scale: 1,
          duration: 120,
          ease: 'Sine.easeOut',
          onComplete: () => {
            // Hold, then drift down and fade
            this.tweens.add({
              targets: ft,
              y: y + 90,
              alpha: 0,
              delay: 1800,
              duration: 700,
              ease: 'Sine.easeIn',
              onComplete: () => {
                ft.destroy();
                if (this.payoutFloatText === ft) {
                  this.payoutFloatText = undefined;
                }
              },
            });
          },
        });
      },
    });
  }

  private showRoundStartBanner() {
    // Clean up any existing banner
    if (this.roundStartTween) {
      this.roundStartTween.stop();
      this.roundStartTween = undefined;
    }
    if (this.roundStartText) {
      this.roundStartText.destroy();
      this.roundStartText = undefined;
    }

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2/3;

    this.roundStartText = this.add
      .text(cx, cy, 'Round Start!', {
        fontFamily: 'Rajdhani',
        fontSize: '92px',
        color: '#00ffb2',
        fontStyle: 'bold',
        stroke: '#003311',
        strokeThickness: 6,
        shadow: {
          offsetX: 0,
          offsetY: 4,
          color: 'rgba(0,0,0,0.6)',
          blur: 12,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setScrollFactor(0)
      .setScale(0.3)
      .setAlpha(0);

    // Scale-in & fade-in, hold, then fade-out
    this.tweens.add({
      targets: this.roundStartText,
      scale: 1,
      alpha: 1,
      duration: 250,
      ease: 'Back.Out',
      onComplete: () => {
        this.roundStartTween = this.tweens.add({
          targets: this.roundStartText,
          alpha: 0,
          scale: 1.15,
          delay: 550,
          duration: 200,
          ease: 'Sine.easeIn',
          onComplete: () => {
            this.roundStartText?.destroy();
            this.roundStartText = undefined;
            this.roundStartTween = undefined;
          },
        });
      },
    });
  }

  private clearLockedBanners() {
    this.lockedBannerTimers.forEach((timer) => timer.remove(false));
    this.lockedBannerTimers = [];
    if (this.lockedBannerTween) {
      this.lockedBannerTween.stop();
      this.lockedBannerTween = undefined;
    }
    if (this.lockedBannerText) {
      this.lockedBannerText.destroy();
      this.lockedBannerText = undefined;
    }
  }

  private showLockedPhaseBanners() {
    this.clearLockedBanners();
    const lockedDuration = 1000;
    const bonusDuration = 2500;
    this.showLockedBanner('Bets Locked', '#ffd166', lockedDuration);
    const timer = this.time.delayedCall(
      lockedDuration,
      () => {
        this.lockedBannerTimers = this.lockedBannerTimers.filter((item) => item !== timer);
        this.showLockedBanner('Bonus Slots', '#00d2ff', bonusDuration);
        // Re-apply as the bonus banner appears so pending-phase highlights are immediate.
        this.updateBonusOddsFromRound(this.round);
      },
      undefined,
      this,
    );
    this.lockedBannerTimers.push(timer);
  }

  private showLockedBanner(message: string, color: string, totalMs: number) {
    if (this.lockedBannerTween) {
      this.lockedBannerTween.stop();
      this.lockedBannerTween = undefined;
    }
    if (this.lockedBannerText) {
      this.lockedBannerText.destroy();
      this.lockedBannerText = undefined;
    }

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2/3;
    const introDuration = Math.min(250, Math.max(120, Math.floor(totalMs * 0.25)));
    const outroDuration = Math.min(200, Math.max(120, Math.floor(totalMs * 0.2)));
    const holdDuration = Math.max(0, totalMs - introDuration - outroDuration);

    this.lockedBannerText = this.add
      .text(cx, cy, message, {
        fontFamily: 'Rajdhani',
        fontSize: '92px',
        color,
        fontStyle: 'bold',
        stroke: '#003311',
        strokeThickness: 6,
        shadow: {
          offsetX: 0,
          offsetY: 4,
          color: 'rgba(0,0,0,0.6)',
          blur: 12,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setScrollFactor(0)
      .setScale(0.3)
      .setAlpha(0);

    this.lockedBannerTween = this.tweens.add({
      targets: this.lockedBannerText,
      scale: 1,
      alpha: 1,
      duration: introDuration,
      ease: 'Back.Out',
      onComplete: () => {
        this.lockedBannerTween = this.tweens.add({
          targets: this.lockedBannerText,
          alpha: 0,
          scale: 1.15,
          delay: holdDuration,
          duration: outroDuration,
          ease: 'Sine.easeIn',
          onComplete: () => {
            this.lockedBannerText?.destroy();
            this.lockedBannerText = undefined;
            this.lockedBannerTween = undefined;
          },
        });
      },
    });
  }

  private showResultOverlay(outcome: 'WIN' | 'LOSE' | 'PUSH' | 'SKIPPED', payload: RoundResultPayload) {
    const width = this.scale.width;
    const height = this.scale.height;

    this.clearResultOverlay();

    let color = 0xb2bec3;
    let titleStr = t(this.language, 'scene.roundResult');

    if (outcome === 'WIN') {
      color = 0x00b894;
      titleStr = t(this.language, 'scene.youWin');
    } else if (outcome === 'PUSH') {
      color = 0xb2bec3;
      titleStr = t(this.language, 'scene.push');
    }

    const modal = this.add.container(width / 2, height / 2 - 485); // Move up 80px during result display

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x1e272e, 1);
    cardBg.fillRoundedRect(-250, -150, 500, 300, 16);
    cardBg.lineStyle(4, color, 1);
    cardBg.strokeRoundedRect(-250, -150, 500, 300, 16);

    this.resultTitleText = this.add.text(0, -80, titleStr, {
      fontFamily: 'Rajdhani',
      fontSize: '56px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    if (outcome === 'WIN') this.resultTitleText.setColor('#00b894');
    else this.resultTitleText.setColor('#b2bec3');

    const final = payload.finalPrice?.toFixed(2) ?? '--';

    const statsText = this.add.text(
      0,
      -25,
      `${t(this.language, 'scene.finalLabel')}:  ${final}`,
      {
        fontFamily: 'Roboto Mono',
        fontSize: '24px',
        color: '#dfe6e9',
        align: 'center',
      },
    ).setOrigin(0.5).setLineSpacing(10);

    const digitResult =
      payload.digitResult && /^\d{3}$/.test(payload.digitResult)
        ? payload.digitResult
        : null;
    const digitSum = typeof payload.digitSum === 'number' ? payload.digitSum : null;
    const extraLines: string[] = [];
    if (digitResult) {
      extraLines.push(
        `DIGITS: ${digitResult}${digitSum !== null ? `  SUM: ${digitSum}` : ''}`,
      );
    }

    if (extraLines.length) {
      this.resultWinnersText = this.add
        .text(0, 50, extraLines.join('\n'), {
          fontFamily: 'Rajdhani',
          fontSize: '16px',
          color: '#dfe6e9',
          align: 'center',
          wordWrap: { width: 420, useAdvancedWrap: true },
        })
        .setOrigin(0.5)
        .setLineSpacing(6);
    }

    const payoutY = 110;

    this.resultPayoutText = this.add.text(0, payoutY, t(this.language, 'scene.calculating'), {
      fontFamily: 'Rajdhani',
      fontSize: '32px',
      color: '#fdcb6e',
    }).setOrigin(0.5);

    modal.add([cardBg, this.resultTitleText, statsText]);
    if (this.resultWinnersText) {
      modal.add(this.resultWinnersText);
    }
    if (this.resultPlayerWinsText) {
      modal.add(this.resultPlayerWinsText);
    }
    modal.add(this.resultPayoutText);

    this.resultOverlay = this.add.container(0, 0, [modal]);
    this.resultOverlay.setDepth(100);
    this.resultOverlay.setAlpha(0);

    this.resultRoundId = payload.roundId;

    modal.setScale(0.8);
    this.tweens.add({
      targets: this.resultOverlay,
      alpha: 1,
      duration: 200,
    });
    this.tweens.add({
      targets: modal,
      scale: 1,
      ease: 'Back.Out',
      duration: 400,
    });

    const fadeOutDuration = 300;
    this.resultOverlayEndsAt = this.time.now + this.resultDisplayDurationMs + fadeOutDuration;

    this.time.delayedCall(this.resultDisplayDurationMs, () => {
      if (this.resultOverlay) {
        this.tweens.add({
          targets: this.resultOverlay,
          alpha: 0,
          duration: fadeOutDuration,
          onComplete: () => {
            this.resultOverlay?.destroy();
            this.resultOverlay = undefined;
            this.resultOverlayEndsAt = 0;
          },
        });
      }
    });
  }

  private ensurePlusLightAnimation() {
    if (this.anims.exists('plus-light-anim')) {
      return;
    }
    this.anims.create({
      key: 'plus-light-anim',
      frames: this.anims.generateFrameNumbers('plus_light_anim', {
        start: 0,
        end: 19,
      }),
      frameRate: 20,
      repeat: 3,
    });
  }

  private ensureNumberLightAnimation() {
    if (this.anims.exists('number-light-box') || !this.textures.exists('number_light_box_2')) {
      return;
    }
    this.anims.create({
      key: 'number-light-box',
      frames: this.anims.generateFrameNumbers('number_light_box_2', {
        start: 0,
        end: 21,
      }),
      frameRate: 18,
      repeat: -1,
    });
  }

  private playResultPlusLight() {
    if (!this.textures.exists('plus_light_anim')) return;
    this.ensurePlusLightAnimation();

    if (this.plusLightSprite) {
      this.plusLightSprite.destroy();
      this.plusLightSprite = undefined;
    }

    const x = 540;
    const y = 185;
    const sprite = this.add.sprite(x, y, 'plus_light_anim', 0);
    sprite.setScale(0.6);
    sprite.setDepth(30);
    sprite.play('plus-light-anim');
    this.sumTriangleTimer?.remove(false);
    this.sumTriangleTimer = this.time.delayedCall(
      700,
      () => {
        if (this.sumTriangleText && this.lastSumTriangleValue !== null) {
          this.sumTriangleText.setText(this.lastSumTriangleValue);
          this.sumTriangleText.setVisible(true);
        }
      },
      undefined,
      this,
    );
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      sprite.destroy();
      if (this.plusLightSprite === sprite) {
        this.plusLightSprite = undefined;
      }
    });
    this.plusLightSprite = sprite;
  }

  private clearResultOverlay() {
    this.resultOverlay?.destroy();
    this.resultOverlay = undefined;
    this.resultTitleText = undefined;
    this.resultPayoutText = undefined;
    this.resultWinnersText = undefined;
    this.resultPlayerWinsText = undefined;
    this.resultRoundId = undefined;
    this.resultOverlayEndsAt = 0;
    this.pendingWinPayout = 0;
    this.winCoinSoundPlayed = false;
    if (this.payoutFloatText) {
      this.payoutFloatText.destroy();
      this.payoutFloatText = undefined;
    }
    if (this.plusLightSprite) {
      this.plusLightSprite.destroy();
      this.plusLightSprite = undefined;
    }
  }
}
