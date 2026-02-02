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
};

export class HiLoScene extends Phaser.Scene {
  private language: LanguageCode = getInitialLanguage();
  private uiReady = false;
  private handlers: BetHandlers | null = null;

  private round?: RoundStatePayload;
  private lastPrice?: PriceUpdate;

  private priceText?: Phaser.GameObjects.Text;
  private priceArrowText?: Phaser.GameObjects.Text;
  private priceLabelText?: Phaser.GameObjects.Text;
  private priceTextY = 465;
  private timerText?: Phaser.GameObjects.Text;
  private roundText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private balanceText?: Phaser.GameObjects.Text;
  private oddsLeftText?: Phaser.GameObjects.Text;
  private oddsCenterText?: Phaser.GameObjects.Text;
  private oddsRightText?: Phaser.GameObjects.Text;
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

  private chipButtons = new Map<number, { image: Phaser.GameObjects.Image; baseScale: number }>();
  private betTargets = new Map<string, Phaser.GameObjects.Image>();
  private tokenSprites = new Map<string, Phaser.GameObjects.Container>();
  private oddsTextByKey = new Map<string, Phaser.GameObjects.Text>();
  private baseOddsByKey = new Map<string, number>();
  private bonusOddsByKey = new Map<string, number>();
  private bonusTweens = new Map<string, Phaser.Tweens.Tween>();
  private winnerTweens = new Map<string, Phaser.Tweens.Tween>();
  private bonusEmitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();

  private clearTokensButton?: Phaser.GameObjects.Image;
  private settingButton?: Phaser.GameObjects.Image;

  private resultOverlay?: Phaser.GameObjects.Container;
  private resultTitleText?: Phaser.GameObjects.Text;
  private resultPayoutText?: Phaser.GameObjects.Text;
  private resultWinnersText?: Phaser.GameObjects.Text;
  private resultPlayerWinsText?: Phaser.GameObjects.Text;
  private resultRoundId?: number;
  private resultDisplayDurationMs = 8000;

  private unsubscribeState?: () => void;
  private statusListener?: (event: Event) => void;
  private audioSettingsListener?: (event: Event) => void;
  private dragScrollActive = false;
  private dragScrollY = 0;
  private scrollBounds?: { minY: number; maxY: number };
  private desiredMusicEnabled = true;

  constructor() {
    super('HiLoScene');
  }

  setBetHandlers(handlers: BetHandlers) {
    this.handlers = handlers;
  }

  preload() {
    this.cameras.main.setBackgroundColor('#050505');
    this.load.audio('bgm', 'audio/BGM_Hi_Lo.mp3');
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

    for (let i = 0; i <= 9; i += 1) {
      loadImage(`number_${i}`);
      loadImage(`number_${i}${i}`);
      loadImage(`number_${i}${i}${i}`);
    }

    for (let sum = 3; sum <= 27; sum += 1) {
      loadImage(`number_sum_${String(sum).padStart(2, '0')}`);
    }
  }

  create() {
    this.createMainLayout();
    this.updateCameraBounds();
    this.enableVerticalScroll();
    this.startBackgroundMusic();

    this.uiReady = true;
    this.setLanguage(this.language);
    this.applyConfigOdds(state.config);
    this.syncSelectedToken(state.selectedTokenValue);
    this.syncTokenPlacements(state.tokenPlacements);
    this.syncActiveSelections(state.digitSelections);
    this.syncDigitResult(state.lastDigitResult);
    this.syncBalance(state.walletBalance);

    this.unsubscribeState = subscribe((nextState) => {
      this.applyConfigOdds(nextState.config);
      this.syncSelectedToken(nextState.selectedTokenValue);
      this.syncTokenPlacements(nextState.tokenPlacements);
      this.syncActiveSelections(nextState.digitSelections);
      this.syncDigitResult(nextState.lastDigitResult);
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
    }

    addImage(540, 973, 'bg_light', 0.72);
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

    this.timerText = this.add
      .text(320, 209, '--s', {
        fontFamily: 'Roboto Mono',
        fontSize: '20px',
        color: '#00ffb2',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

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

    this.priceText = this.add
      .text(540, this.priceTextY, '00000.00', {
        fontFamily: 'Roboto Mono',
        fontSize: '54px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

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

    this.compressBodyLayout(500, 0.82);
    this.alignLayoutToVisibleTop(8);
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
        (item.texture?.key === 'bg' || item.texture?.key === 'bg_light')
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
        (item.texture?.key === 'bg' || item.texture?.key === 'bg_light')
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
    const bottomPadding = Math.round(viewHeight * 0.13);
    const contentHeight = Math.max(viewHeight, maxY - topAnchor + bottomPadding);
    this.scrollBounds = { minY: topAnchor, maxY: topAnchor + contentHeight };
    this.cameras.main.setBounds(0, topAnchor, this.scale.width, contentHeight);
    this.cameras.main.scrollY = topAnchor;
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

  private buildDigitKey(digitType: DigitBetType, selection?: string) {
    return `DIGIT|${digitType}|${selection ?? ''}`;
  }

  private makeInteractive(
    image: Phaser.GameObjects.Image,
    handler: () => void,
  ) {
    image.setInteractive({ useHandCursor: true });
    image.on('pointerdown', handler);
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

  private openSettings() {
    if (this.handlers?.onOpenSettings) {
      this.handlers.onOpenSettings();
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:open-settings'));
    }
  }

  private handlePlaceDigitBet(digitType: DigitBetType, selection?: string) {
    if (!this.handlers?.onPlaceDigitBet) return;
    this.runHandler(() =>
      this.handlers?.onPlaceDigitBet({ digitType, selection }),
    );
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
        payouts?.sum?.[sum] ??
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

  private clearBonusHighlights() {
    this.bonusTweens.forEach((tween) => tween.stop());
    this.bonusTweens.clear();
    this.bonusEmitters.forEach((emitter) => {
      emitter.stop(true);
      emitter.destroy();
    });
    this.bonusEmitters.clear();
    this.betTargets.forEach((image) => {
      const baseScale = image.getData('baseScale');
      if (typeof baseScale === 'number') {
        image.setScale(baseScale);
      }
      image.setAlpha(1);
    });
  }

  private applyBonusHighlights() {
    this.clearBonusHighlights();
    this.ensureBonusSparkTexture();
    this.bonusOddsByKey.forEach((_ratio, key) => {
      const image = this.betTargets.get(key);
      if (!image) return;
      const baseScale = image.getData('baseScale');
      const scale = typeof baseScale === 'number' ? baseScale : image.scaleX;
      const tween = this.tweens.add({
        targets: image,
        scaleX: scale * 1.04,
        scaleY: scale * 1.04,
        alpha: 0.75,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.bonusTweens.set(key, tween);

      const emitter = this.add.particles(0, 0, 'bonusSpark', {
        follow: image,
        lifespan: { min: 700, max: 1400 },
        speed: { min: 20, max: 80 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0.1 },
        alpha: { start: 1, end: 0 },
        tint: [0xfff1a8, 0xffd166, 0xffb703, 0xff7a18, 0xff4d4d],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 60,
        quantity: 2,
        emitZone: {
          type: 'edge',
          source: new Phaser.Geom.Rectangle(
            -image.displayWidth / 2,
            -image.displayHeight / 2,
            image.displayWidth,
            image.displayHeight,
          ),
          quantity: 48,
          yoyo: true,
        },
      });
      emitter.setDepth(20);
      this.bonusEmitters.set(key, emitter);
    });
  }

  private ensureBonusSparkTexture() {
    if (!this.textures.exists('bonusSpark')) {
      const spark = this.add.graphics();
      spark.fillStyle(0xffb703, 1);
      spark.fillCircle(6, 6, 6);
      spark.generateTexture('bonusSpark', 12, 12);
      spark.destroy();
    }
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
      if (!container) {
        const chip = this.add.image(0, 0, `chip_${placement.value}`);
        chip.setScale(0.45);
        const label = this.add
          .text(0, 0, String(total), {
            fontFamily: 'Rajdhani',
            fontSize: '20px',
            color: '#0b0b0b',
            fontStyle: 'bold',
          })
          .setOrigin(0.5);
        container = this.add.container(target.x + 58, target.y, [chip, label]);
        container.setDepth(20);
        this.tokenSprites.set(key, container);
      } else {
        const chip = container.list[0] as Phaser.GameObjects.Image;
        const label = container.list[1] as Phaser.GameObjects.Text;
        chip.setTexture(`chip_${placement.value}`);
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
    if (this.roundDigitsLeftText && this.roundDigitsCenterText && this.roundDigitsRightText) {
      this.roundDigitsLeftText.setText(digits[0]);
      this.roundDigitsCenterText.setText(digits[1]);
      this.roundDigitsRightText.setText(digits[2]);
    }
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
    this.timerText.setColor(isBetting ? '#00ffb2' : '#ff8f70');
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

    this.priceText?.setText(update.price.toFixed(2));

    if (previous !== undefined && this.priceArrowText) {
      const isUp = update.price >= previous;
      const color = isUp ? '#00ffb2' : '#ff7675';
      const arrow = isUp ? '▲' : '▼';
      const offset = isUp ? -6 : 6;

      this.priceText?.setColor(color);
      this.priceArrowText.setText(arrow).setColor(color).setAlpha(1);

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
    this.round = state;
    this.roundText?.setText(`${state.id}`);
    if (state.status === 'BETTING') {
      this.clearWinnerHighlights();
    }
    this.updateBonusOddsFromRound(state);

    if (state.status === 'BETTING') {
      this.statusText?.setText(t(this.language, 'scene.betsOpen'));
      this.statusText?.setColor('#00ffb2');
    } else if (state.status === 'RESULT_PENDING') {
      this.statusText?.setText(t(this.language, 'scene.locked'));
      this.statusText?.setColor('#ffd166');
    } else {
      this.statusText?.setText(t(this.language, 'scene.roundResult'));
      this.statusText?.setColor('#b2bec3');
    }
  }

  handleRoundLock(payload: RoundLockPayload) {
    if (!this.round || this.round.id !== payload.roundId) return;
    this.round = {
      ...this.round,
      status: 'RESULT_PENDING',
      lockedPrice: payload.lockedPrice,
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

    this.updateBonusOddsFromRound(this.round);
    this.showResultOverlay('SKIPPED', payload);
  }

  private clearWinnerHighlights() {
    this.winnerTweens.forEach((tween) => tween.stop());
    this.winnerTweens.clear();
    this.betTargets.forEach((image) => {
      image.setAlpha(1);
      image.clearTint();
    });
  }

  setResultDisplayDuration(durationMs: number) {
    if (!Number.isFinite(durationMs)) {
      return;
    }
    this.resultDisplayDurationMs = Math.max(durationMs, 0);
  }

  setPlayerPayout(roundId: number, totalStake: number, totalPayout: number) {
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
    this.applyWinnerHighlights(winKeys);

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
    winKeys.forEach((key) => {
      const image = this.betTargets.get(key);
      if (!image) return;
      const baseY = image.y;
      image.setTint(0x00ffb2);
      const tween = this.tweens.add({
        targets: image,
        y: baseY - 6,
        alpha: 0.5,
        duration: 180,
        yoyo: true,
        repeat: 8,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          image.setAlpha(1);
          image.setTint(0x00ffb2);
          image.y = baseY;
        },
      });
      this.winnerTweens.set(key, tween);
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

    const modal = this.add.container(width / 2, height / 2 - 520);

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

    this.time.delayedCall(this.resultDisplayDurationMs, () => {
      if (this.resultOverlay) {
        this.tweens.add({
          targets: this.resultOverlay,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            this.resultOverlay?.destroy();
            this.resultOverlay = undefined;
          },
        });
      }
    });
  }

  private clearResultOverlay() {
    this.resultOverlay?.destroy();
    this.resultOverlay = undefined;
    this.resultTitleText = undefined;
    this.resultPayoutText = undefined;
    this.resultWinnersText = undefined;
    this.resultPlayerWinsText = undefined;
    this.resultRoundId = undefined;
  }
}
