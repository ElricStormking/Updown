import Phaser from 'phaser';
import type {
  BetSide,
  DigitBetType,
  PriceUpdate,
  RoundLockPayload,
  RoundResultPayload,
  RoundStatePayload,
} from '../types';
import { getInitialLanguage, t, type LanguageCode } from '../i18n';

export class HiLoScene extends Phaser.Scene {
  private language: LanguageCode = getInitialLanguage();
  private uiReady = false;
  // -- Containers --
  private mainContainer!: Phaser.GameObjects.Container;
  private phaseContainer!: Phaser.GameObjects.Container; // Groups betting/pending/result UI
  private backgroundContainer!: Phaser.GameObjects.Container;
  private resultOverlay?: Phaser.GameObjects.Container;

  // -- Background --
  private grid?: Phaser.GameObjects.TileSprite;
  private vignette?: Phaser.GameObjects.Rectangle;
  private particles?: Phaser.GameObjects.Particles.ParticleEmitter;

  // -- Top Bar --
  private roundIdText!: Phaser.GameObjects.Text;
  private statusBadge!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private statusBg!: Phaser.GameObjects.Graphics;
  private connectionDot!: Phaser.GameObjects.Arc;

  // -- Center Stage (Price) --
  private priceContainer!: Phaser.GameObjects.Container;
  private priceText!: Phaser.GameObjects.Text;
  private arrowText!: Phaser.GameObjects.Text;
  private priceLabel!: Phaser.GameObjects.Text;
  private timerRing!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private centerCardBg!: Phaser.GameObjects.Graphics;

  // -- Betting Phase UI --
  private bettingUI!: Phaser.GameObjects.Container;
  private bettingLabel!: Phaser.GameObjects.Text;
  private oddsContainer!: Phaser.GameObjects.Container;
  private oddsUpText!: Phaser.GameObjects.Text;
  private oddsDownText!: Phaser.GameObjects.Text;

  // -- Pending Phase UI --
  private pendingUI!: Phaser.GameObjects.Container;
  private lockedPriceText!: Phaser.GameObjects.Text;
  private lockedPriceLabel!: Phaser.GameObjects.Text;
  private comparisonLine!: Phaser.GameObjects.Rectangle;
  private playerBetCard!: Phaser.GameObjects.Container;
  private playerBetStatusText!: Phaser.GameObjects.Text;
  private playerBetDetailsText!: Phaser.GameObjects.Text;
  private playerBetBg!: Phaser.GameObjects.Graphics;

  // -- Footer (History) --
  private footerContainer!: Phaser.GameObjects.Container;
  private balanceLabelText!: Phaser.GameObjects.Text;
  private balanceText!: Phaser.GameObjects.Text;
  // We'll implement a simple placeholder for history or remove if not fed data yet.

  // -- Result Overlay --
  private resultTitleText?: Phaser.GameObjects.Text;
  private resultPayoutText?: Phaser.GameObjects.Text;
  private resultWinnersText?: Phaser.GameObjects.Text;
  private resultPlayerWinsText?: Phaser.GameObjects.Text;
  private resultRoundId?: number;
  private resultDisplayDurationMs = 8000;

  // -- State --
  private round?: RoundStatePayload;
  private lastPrice?: PriceUpdate;
  private playerBetSide?: BetSide;
  private playerBetLockedPrice: number | null = null;
  private playerBetAmount: number | null = null;
  private playerDigitSelections: Array<{
    digitType: DigitBetType;
    selection: string | null;
  }> = [];

  private ringRadius = 130;
  private ringThickness = 6;
  private priceFontSize = 56;
  private timerFontSize = 22;
  private priceLabelFontSize = 14;
  private arrowFontSize = 32;
  private priceLabelOffsetY = -60;
  private timerTextOffsetY = 70;
  private centerCardWidth = 400;
  private centerCardHeight = 280;
  private centerCardRadius = 24;
  private centerCardYOffset = -40;
  private phaseOffsetY = 100;
  
  private cx = 0;
  private cy = 0;

  constructor() {
    super('HiLoScene');
  }

  preload() {
    this.cameras.main.setBackgroundColor('#050505');
  }

  create() {
    this.cx = this.scale.width / 2;
    this.cy = this.scale.height / 2;
    this.setLayoutMetrics();

    // 1. Background
    this.createBackground();

    // 2. Main Structure
    this.mainContainer = this.add.container(0, 0);
    this.phaseContainer = this.add.container(0, 0);
    
    // 3. Top Bar
    this.createTopBar();

    // 4. Center Card (The "Hero")
    this.createCenterCard();

    // 5. Phase UIs
    this.createBettingUI();
    this.createPendingUI();
    
    // 6. Footer
    this.createFooter();
    this.createBalanceDisplay();

    // Assemble
    this.phaseContainer.add([this.bettingUI, this.pendingUI]);
    this.mainContainer.add([this.priceContainer, this.phaseContainer]);
    
    // Initial State
    this.bettingUI.setVisible(false);
    this.pendingUI.setVisible(false);
    this.bettingUI.setAlpha(0);
    this.pendingUI.setAlpha(0);

    // UI is now constructed; allow live language updates and apply current language.
    this.uiReady = true;
    this.setLanguage(this.language);
  }

  private setLayoutMetrics() {
    const isCompact = this.scale.width <= 420;
    if (!isCompact) {
      return;
    }

    const isShort = this.scale.height <= 260;
    const minDim = Math.min(this.scale.width, this.scale.height);
    const radiusFactor = isShort ? 0.36 : 0.42;
    const maxRadius = isShort ? 110 : 160;
    const minRadius = isShort ? 60 : 90;

    this.ringRadius = Math.round(minDim * radiusFactor);
    this.ringRadius = Math.max(minRadius, Math.min(maxRadius, this.ringRadius));
    this.ringThickness = isShort ? 5 : 7;
    this.priceFontSize = Math.round(this.ringRadius * (isShort ? 0.4 : 0.45));
    this.timerFontSize = Math.round(this.ringRadius * (isShort ? 0.2 : 0.18));
    this.priceLabelFontSize = isShort
      ? Math.max(10, Math.round(this.ringRadius * 0.14))
      : 14;
    this.arrowFontSize = Math.round(
      this.ringRadius * (isShort ? 0.18 : 0.22),
    );
    this.priceLabelOffsetY = Math.round(
      -this.ringRadius * (isShort ? 0.55 : 0.45),
    );
    this.timerTextOffsetY = Math.round(
      this.ringRadius * (isShort ? 0.52 : 0.55),
    );

    this.centerCardWidth = Math.min(400, Math.round(this.scale.width - 24));
    const desiredCardHeight = Math.round(
      this.ringRadius * (isShort ? 2.1 : 1.7),
    );
    const availableHeight = Math.round(this.scale.height - 16);
    const minCardHeight = isShort
      ? Math.min(150, availableHeight)
      : 240;
    this.centerCardHeight = Math.min(
      300,
      Math.min(availableHeight, Math.max(minCardHeight, desiredCardHeight)),
    );
    this.centerCardRadius = 20;
    this.centerCardYOffset = isShort ? -10 : -30;
    this.phaseOffsetY = Math.round(
      this.ringRadius * (isShort ? 0.95 : 1.05),
    );
  }

  private createBackground() {
    this.backgroundContainer = this.add.container(0, 0);

    // Grid
    const gridGraphics = this.make.graphics({ x: 0, y: 0, add: false } as any);
    gridGraphics.lineStyle(1, 0x1a2639, 1.0);
    gridGraphics.strokeRect(0, 0, 60, 60);
    gridGraphics.generateTexture('gridTexture', 60, 60);

    this.grid = this.add.tileSprite(this.cx, this.cy, this.scale.width, this.scale.height, 'gridTexture')
      .setAlpha(0.2)
      .setTint(0x0984e3); // Blue tint
    
    // Vignette (Radial Gradient simulation with alpha)
    const vignetteOverlay = this.add.graphics();
    vignetteOverlay.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.8, 0.8);
    vignetteOverlay.fillRect(0, 0, this.scale.width, this.scale.height);
    
    this.backgroundContainer.add([this.grid, vignetteOverlay]);
  }

  private createTopBar() {
    // Round ID
    this.roundIdText = this.add.text(
      30,
      30,
      `${t(this.language, 'scene.roundPrefix')} #--`,
      {
      fontFamily: 'Rajdhani',
      fontSize: '24px',
      color: '#dfe6e9',
      fontStyle: 'bold'
      },
    ).setOrigin(0, 0.5);

    // Status Badge (Top Right)
    this.statusBadge = this.add.container(this.scale.width - 130, 30);
    this.statusBg = this.add.graphics();
    
    this.connectionDot = this.add.circle(-45, 0, 4, 0xffffff);
    
    this.statusText = this.add.text(0, 0, t(this.language, 'scene.connecting'), {
      fontFamily: 'Rajdhani',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.statusBadge.add([this.statusBg, this.connectionDot, this.statusText]);
    this.drawStatusBadge(0x636e72, t(this.language, 'scene.connecting'));
  }

  private drawStatusBadge(color: number, text: string) {
    this.statusBg.clear();
    // No background fill, just text color and dot
    this.connectionDot.setFillStyle(color);
    this.statusText.setText(text).setColor('#ffffff');
    
    // Maybe a subtle pill background
    this.statusBg.fillStyle(0x000000, 0.3);
    this.statusBg.fillRoundedRect(-70, -15, 140, 30, 15);
    this.statusBg.lineStyle(1, color, 0.6);
    this.statusBg.strokeRoundedRect(-70, -15, 140, 30, 15);
  }

  private createCenterCard() {
    this.priceContainer = this.add.container(
      this.cx,
      this.cy + this.centerCardYOffset,
    );

    // Card Background
    this.centerCardBg = this.add.graphics();
    this.centerCardBg.fillStyle(0x1e272e, 0.8);
    this.centerCardBg.fillRoundedRect(
      -this.centerCardWidth / 2,
      -this.centerCardHeight / 2,
      this.centerCardWidth,
      this.centerCardHeight,
      this.centerCardRadius,
    );
    this.centerCardBg.lineStyle(2, 0x2d3436, 1);
    this.centerCardBg.strokeRoundedRect(
      -this.centerCardWidth / 2,
      -this.centerCardHeight / 2,
      this.centerCardWidth,
      this.centerCardHeight,
      this.centerCardRadius,
    );
    // Note: We might hide this bg or make it very subtle, focusing on the timer ring

    // Timer Ring (Behind everything)
    this.timerRing = this.add.graphics();
    this.timerText = this.add.text(0, this.timerTextOffsetY, '', {
      fontFamily: 'Roboto Mono',
      fontSize: `${this.timerFontSize}px`,
      color: '#b2bec3',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Price Label
    this.priceLabel = this.add.text(0, this.priceLabelOffsetY, t(this.language, 'scene.bitcoinPrice'), {
      fontFamily: 'Rajdhani',
      fontSize: `${this.priceLabelFontSize}px`,
      color: '#636e72',
      fontStyle: 'bold'
    }).setOrigin(0.5).setLetterSpacing(2);

    // Price Text
    this.priceText = this.add.text(0, 0, '00000.00', {
      fontFamily: 'Roboto Mono',
      fontSize: `${this.priceFontSize}px`,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Arrow
    this.arrowText = this.add.text(Math.round(this.ringRadius + 10), 0, '▲', {
      fontSize: `${this.arrowFontSize}px`,
      color: '#ffffff'
    }).setOrigin(0.5).setAlpha(0);

    this.priceContainer.add([
      this.timerRing,
      this.priceLabel,
      this.priceText,
      this.arrowText,
      this.timerText,
    ]);
  }

  private createBettingUI() {
    this.bettingUI = this.add.container(this.cx, this.cy + this.phaseOffsetY);

    this.bettingLabel = this.add.text(0, -20, t(this.language, 'scene.placeBets'), {
      fontFamily: 'Rajdhani',
      fontSize: '20px',
      color: '#00b894',
      fontStyle: 'bold'
    }).setOrigin(0.5).setLetterSpacing(1);

    // Odds
    this.oddsContainer = this.add.container(0, 30);
    
    // UP Odds
    const upBg = this.add.graphics();
    upBg.fillStyle(0x00b894, 0.1);
    upBg.fillRoundedRect(-140, -20, 120, 40, 8);
    upBg.lineStyle(1, 0x00b894, 0.5);
    upBg.strokeRoundedRect(-140, -20, 120, 40, 8);
    
    this.oddsUpText = this.add.text(-80, 0, `${t(this.language, 'hilo.up')} 1.95x`, {
      fontFamily: 'Rajdhani',
      fontSize: '18px',
      color: '#00b894',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // DOWN Odds
    const downBg = this.add.graphics();
    downBg.fillStyle(0xd63031, 0.1);
    downBg.fillRoundedRect(20, -20, 120, 40, 8);
    downBg.lineStyle(1, 0xd63031, 0.5);
    downBg.strokeRoundedRect(20, -20, 120, 40, 8);

    this.oddsDownText = this.add.text(80, 0, `${t(this.language, 'hilo.down')} 1.95x`, {
      fontFamily: 'Rajdhani',
      fontSize: '18px',
      color: '#d63031',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.oddsContainer.add([upBg, downBg, this.oddsUpText, this.oddsDownText]);
    this.bettingUI.add([this.bettingLabel, this.oddsContainer]);

    // Pulse animation for label
    this.tweens.add({
      targets: this.bettingLabel,
      alpha: 0.6,
      yoyo: true,
      duration: 1000,
      repeat: -1
    });
  }

  private createPendingUI() {
    this.pendingUI = this.add.container(this.cx, this.cy + this.phaseOffsetY);

    // Locked Price
    this.lockedPriceLabel = this.add.text(0, -40, t(this.language, 'scene.lockedPrice'), {
      fontFamily: 'Rajdhani',
      fontSize: '12px',
      color: '#636e72',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.lockedPriceText = this.add.text(0, -20, '00000.00', {
      fontFamily: 'Roboto Mono',
      fontSize: '24px',
      color: '#dfe6e9'
    }).setOrigin(0.5);

    // Comparison Line (Bar between Locked and Player Bet)
    this.comparisonLine = this.add.rectangle(0, 10, 2, 40, 0x636e72).setOrigin(0.5, 0);

    // Player Bet Card
    this.playerBetCard = this.add.container(0, 60);
    
    this.playerBetBg = this.add.graphics();
    // Draw function will be dynamic based on win/lose

    this.playerBetStatusText = this.add.text(0, -10, '', {
      fontFamily: 'Rajdhani',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.playerBetDetailsText = this.add.text(0, 14, '', {
      fontFamily: 'Rajdhani',
      fontSize: '14px',
      color: '#b2bec3'
    }).setOrigin(0.5);

    this.playerBetCard.add([this.playerBetBg, this.playerBetStatusText, this.playerBetDetailsText]);
    this.pendingUI.add([this.lockedPriceLabel, this.lockedPriceText, this.comparisonLine, this.playerBetCard]);
  }

  private createFooter() {
    this.footerContainer = this.add.container(this.cx, this.scale.height - 40);
    // Placeholder for history
  }

  private createBalanceDisplay() {
    const x = this.scale.width - 30;
    const y = this.scale.height - 30;

    this.balanceLabelText = this.add.text(x, y - 30, t(this.language, 'scene.walletBalance'), {
      fontFamily: 'Rajdhani',
      fontSize: '12px',
      color: '#636e72',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5);

    this.balanceText = this.add.text(x, y, '0.00 USDT', {
      fontFamily: 'Roboto Mono',
      fontSize: '28px',
      color: '#00b894',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5);
  }

  // -- Update Loop --

  update() {
    // Background animation
    if (this.grid) {
      this.grid.tilePositionY -= 0.2;
      this.grid.tilePositionX += 0.1;
    }

    if (!this.round) return;

    this.updateTimerRing();
    this.updatePendingLogic();
  }

  private updateTimerRing() {
    if (!this.round) return;

    const now = Date.now();
    const isBetting = this.round.status === 'BETTING';
    const targetTime = isBetting ? new Date(this.round.lockTime).getTime() : new Date(this.round.endTime).getTime();
    const totalDuration = isBetting
      ? Math.max(
          new Date(this.round.lockTime).getTime() -
            new Date(this.round.startTime).getTime(),
          1,
        )
      : Math.max(
          new Date(this.round.endTime).getTime() -
            new Date(this.round.lockTime).getTime(),
          1,
        );
    const remaining = Math.max(targetTime - now, 0);
    const progress = remaining / totalDuration;

    this.timerRing.clear();
    
    // Radius and Thickness
    const r = this.ringRadius;
    const t = this.ringThickness;

    // Background ring
    this.timerRing.lineStyle(t, 0x2d3436, 0.3);
    this.timerRing.beginPath();
    this.timerRing.arc(0, 0, r, 0, Math.PI * 2);
    this.timerRing.strokePath();

    // Progress ring
    const color = isBetting ? 0x00b894 : 0xe17055;
    this.timerRing.lineStyle(t, color, 1);
    this.timerRing.beginPath();
    // Start from top (-90 deg)
    this.timerRing.arc(0, 0, r, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + (360 * progress)), false);
    this.timerRing.strokePath();

    // Numeric countdown (seconds)
    const seconds = Math.ceil(remaining / 1000);
    this.timerText.setText(`${seconds}s`);
    this.timerText.setColor(isBetting ? '#00b894' : '#e17055');
  }

  private updatePendingLogic() {
    if (this.round?.status !== 'RESULT_PENDING' || !this.playerBetSide || !this.playerBetLockedPrice || !this.lastPrice) return;

    const current = this.lastPrice.price;
    const locked = this.playerBetLockedPrice;
    const side = this.playerBetSide;
    
    let isWinning = false;
    if (side === 'UP' && current > locked) isWinning = true;
    if (side === 'DOWN' && current < locked) isWinning = true;

    const color = isWinning ? 0x00b894 : 0xd63031;
    const label = isWinning ? 'WINNING' : 'LOSING';

    this.playerBetStatusText.setText(label).setColor(isWinning ? '#00ffb2' : '#ff7675');
    this.comparisonLine.setFillStyle(color);
    
    // Update Card BG
    this.playerBetBg.clear();
    this.playerBetBg.fillStyle(color, 0.1);
    this.playerBetBg.fillRoundedRect(-120, -35, 240, 70, 12);
    this.playerBetBg.lineStyle(2, color, 0.5);
    this.playerBetBg.strokeRoundedRect(-120, -35, 240, 70, 12);
  }

  // -- Public API (Called by main.ts) --

  setLanguage(lang: LanguageCode) {
    this.language = lang;
    if (!this.uiReady) return;

    // Static labels
    if (this.priceLabel) this.priceLabel.setText(t(this.language, 'scene.bitcoinPrice'));
    if (this.bettingLabel) this.bettingLabel.setText(t(this.language, 'scene.placeBets'));
    if (this.lockedPriceLabel) this.lockedPriceLabel.setText(t(this.language, 'scene.lockedPrice'));
    if (this.balanceLabelText) this.balanceLabelText.setText(t(this.language, 'scene.walletBalance'));

    // Round-dependent labels
    if (this.round) {
      this.roundIdText.setText(`${t(this.language, 'scene.roundPrefix')} #${this.round.id}`);
      if (this.round.status === 'BETTING') {
        this.drawStatusBadge(0x00b894, t(this.language, 'scene.betsOpen'));
        this.oddsUpText.setText(`${t(this.language, 'hilo.up')} ${this.round.oddsUp.toFixed(2)}x`);
        this.oddsDownText.setText(`${t(this.language, 'hilo.down')} ${this.round.oddsDown.toFixed(2)}x`);
      } else if (this.round.status === 'RESULT_PENDING') {
        this.drawStatusBadge(0xe17055, t(this.language, 'scene.locked'));
      }
    } else {
      this.roundIdText.setText(`${t(this.language, 'scene.roundPrefix')} #--`);
      this.drawStatusBadge(0x636e72, t(this.language, 'scene.connecting'));
    }
  }

  setPrice(update: PriceUpdate) {
    const previous = this.lastPrice?.price;
    this.lastPrice = update;
    
    this.priceText.setText(update.price.toFixed(2));

    if (previous !== undefined) {
      const isUp = update.price >= previous;
      const color = isUp ? '#00b894' : '#d63031';
      const arrow = isUp ? '▲' : '▼';
      const arrowY = isUp ? -10 : 10;

      this.priceText.setColor(color);
      this.arrowText.setText(arrow).setColor(color).setAlpha(1);
      
      // Arrow Animation
      this.tweens.killTweensOf(this.arrowText);
      this.arrowText.y = 0;
      this.tweens.add({
        targets: this.arrowText,
        y: arrowY,
        alpha: 0.5,
        duration: 400,
        yoyo: true,
        ease: 'Sine.easeInOut'
      });
    }
  }

  setRoundState(state: RoundStatePayload) {
    this.round = state;
    this.roundIdText.setText(`${t(this.language, 'scene.roundPrefix')} #${state.id}`);
    
    // Determine visuals based on phase
    if (state.status === 'BETTING') {
      this.drawStatusBadge(0x00b894, t(this.language, 'scene.betsOpen'));
      this.transitionToPhase('betting');
      
      // Update Odds
      this.oddsUpText.setText(`${t(this.language, 'hilo.up')} ${state.oddsUp.toFixed(2)}x`);
      this.oddsDownText.setText(`${t(this.language, 'hilo.down')} ${state.oddsDown.toFixed(2)}x`);

      // Reset Player Data
      this.playerBetSide = undefined;
      this.playerBetLockedPrice = null;
      this.playerBetAmount = null;
      this.playerDigitSelections = [];
      this.playerBetCard.setAlpha(0);
      this.comparisonLine.setVisible(false);

    } else if (state.status === 'RESULT_PENDING') {
      this.drawStatusBadge(0xe17055, t(this.language, 'scene.locked'));
      this.transitionToPhase('pending');
      
      if (state.lockedPrice) {
        this.lockedPriceText.setText(state.lockedPrice.toFixed(2));
      }
    } else {
       this.drawStatusBadge(0x0984e3, 'COMPLETED');
       // No specific UI for completed, waiting for next round or results overlay
    }
  }

  private transitionToPhase(phase: 'betting' | 'pending') {
    // Fade out current, Fade in new
    const showBetting = phase === 'betting';
    
    this.tweens.add({
      targets: this.bettingUI,
      alpha: showBetting ? 1 : 0,
      visible: showBetting, // visibility is toggled at start/end of tween often, but for simplicity:
      duration: 300,
      onStart: () => { if (showBetting) this.bettingUI.setVisible(true); },
      onComplete: () => { if (!showBetting) this.bettingUI.setVisible(false); }
    });

    this.tweens.add({
      targets: this.pendingUI,
      alpha: !showBetting ? 1 : 0,
      duration: 300,
      onStart: () => { if (!showBetting) this.pendingUI.setVisible(true); },
      onComplete: () => { if (showBetting) this.pendingUI.setVisible(false); }
    });
  }

  handleRoundLock(payload: RoundLockPayload) {
    if (!this.round || this.round.id !== payload.roundId) return;
    
    this.round = {
      ...this.round,
      status: 'RESULT_PENDING',
      lockedPrice: payload.lockedPrice
    };
    
    this.setRoundState(this.round);
    this.playerBetLockedPrice = payload.lockedPrice;
    
    if (this.playerBetSide && this.playerBetAmount) {
      const sideLabel =
        this.playerBetSide === 'UP'
          ? t(this.language, 'hilo.up')
          : t(this.language, 'hilo.down');
      this.playerBetDetailsText.setText(`${sideLabel} ${this.playerBetAmount.toFixed(2)} USDT`);
      this.playerBetCard.setAlpha(1);
      this.comparisonLine.setVisible(true);
    }
  }

  setPlayerBet(side: BetSide, amount: number) {
    this.playerBetSide = side;
    this.playerBetAmount = amount;
  }

  setBalance(amount: number) {
    if (this.balanceText) {
      this.balanceText.setText(`${amount.toFixed(2)} USDT`);
    }
  }

  handleRoundResult(payload: RoundResultPayload) {
    if (!this.round || this.round.id !== payload.roundId) return;

    // Client does NOT decide winners. We wait for server-settled results (round:user-settlement)
    this.playerDigitSelections = [];
    
    this.round = {
      ...this.round,
      status: 'COMPLETED',
      finalPrice: payload.finalPrice ?? null,
      winningSide: payload.winningSide
    };

    // Show a neutral overlay; outcome/payout/winning-bets are updated from server totals afterwards.
    this.showResultOverlay('SKIPPED', payload);
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

  setWinningBets(roundId: number, bets: Array<{ betType: string; side: string | null; digitType: string | null; selection: string | null; result: string }>) {
    if (!this.resultOverlay || this.resultRoundId !== roundId) return;

    const wins = bets.filter((b) => b.result === 'WIN');
    const labels = wins.map((b) => {
      if (b.betType === 'HILO') {
        return b.side ? `HILO ${b.side}` : 'HILO';
      }
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
      const modal = this.resultOverlay.getAt(1) as Phaser.GameObjects.Container;
      modal.add(this.resultPlayerWinsText);
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

  private showResultOverlay(outcome: 'WIN' | 'LOSE' | 'PUSH' | 'SKIPPED', payload: RoundResultPayload) {
    const width = this.scale.width;
    const height = this.scale.height;

    this.clearResultOverlay();
    
    // Color Determination (neutral until server-settled totals arrive)
    let color = 0xb2bec3;
    let titleStr = t(this.language, 'scene.roundResult');

    if (outcome === 'WIN') {
      color = 0x00b894;
      titleStr = t(this.language, 'scene.youWin');
    } else if (outcome === 'PUSH') {
      color = 0xb2bec3;
      titleStr = t(this.language, 'scene.push');
    }

    // Modal Card
    const modal = this.add.container(width/2, height/2);
    
    // Backdrop
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
    bg.setInteractive(); 
    
    // Card
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x1e272e, 1);
    cardBg.fillRoundedRect(-250, -150, 500, 300, 16);
    cardBg.lineStyle(4, color, 1);
    cardBg.strokeRoundedRect(-250, -150, 500, 300, 16);

    // Title
    this.resultTitleText = this.add.text(0, -80, titleStr, {
      fontFamily: 'Rajdhani',
      fontSize: '56px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    if (outcome === 'WIN') this.resultTitleText.setColor('#00b894');
    else this.resultTitleText.setColor('#b2bec3');

    // Stats
    const locked = payload.lockedPrice?.toFixed(2) ?? '--';
    const final = payload.finalPrice?.toFixed(2) ?? '--';
    
    const statsText = this.add.text(
      0,
      -25,
      `${t(this.language, 'scene.lockedLabel')}: ${locked}\n${t(this.language, 'scene.finalLabel')}:  ${final}`,
      {
      fontFamily: 'Roboto Mono',
      fontSize: '24px',
      color: '#dfe6e9',
      align: 'center'
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
    if (payload.winningSide) {
      extraLines.push(`HILO WINNER: ${payload.winningSide}`);
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

    // Payout Placeholder
    this.resultPayoutText = this.add.text(0, payoutY, t(this.language, 'scene.calculating'), {
      fontFamily: 'Rajdhani',
      fontSize: '32px',
      color: '#fdcb6e'
    }).setOrigin(0.5);

    modal.add([cardBg, this.resultTitleText, statsText]);
    if (this.resultWinnersText) {
      modal.add(this.resultWinnersText);
    }
    if (this.resultPlayerWinsText) {
      modal.add(this.resultPlayerWinsText);
    }
    modal.add(this.resultPayoutText);
    
    this.resultOverlay = this.add.container(0, 0, [bg, modal]);
    this.resultOverlay.setDepth(100);
    this.resultOverlay.setAlpha(0);
    
    this.resultRoundId = payload.roundId;

    // Pop in
    modal.setScale(0.8);
    this.tweens.add({
      targets: this.resultOverlay,
      alpha: 1,
      duration: 200
    });
    this.tweens.add({
      targets: modal,
      scale: 1,
      ease: 'Back.Out',
      duration: 400
    });

    // Auto hide
    this.time.delayedCall(this.resultDisplayDurationMs, () => {
       if (this.resultOverlay) {
         this.tweens.add({
           targets: this.resultOverlay,
           alpha: 0,
           duration: 300,
           onComplete: () => {
             this.resultOverlay?.destroy();
             this.resultOverlay = undefined;
           }
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
