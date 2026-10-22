(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 480;
  const H = 320;

  function resizeCanvasResolution() {
    const cssWidth = canvas.getBoundingClientRect().width || W;
    const deviceScale = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.max(1, cssWidth / W) * deviceScale;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  resizeCanvasResolution();
  window.addEventListener('resize', resizeCanvasResolution);
  const COLORS = {
    ink: '#17182e',
    dark: '#22233f',
    panel: '#292943',
    muted: '#aaa6c3',
    cream: '#fff4d6',
    gold: '#f3ba58',
    orange: '#ef795f',
    pink: '#d879a9',
    lavender: '#aa9add',
    cyan: '#79d7d1',
    green: '#9be28b',
    red: '#ff777f',
    white: '#ffffff',
  };

  const PLATFORM_BASES = ['SynergiCloud', 'OmniStack', 'UnifiedHub', 'NorthstarCore', 'CloudifyFabric', 'HyperNexus', 'AcmeSphere', 'OnePlatform', 'SingleCloud', 'OneFabric', 'OmniWorks'];
  const PLATFORM_EDITIONS = ['360', 'Next', 'Plus', 'v2', 'One'];
  const FORK_PLATFORM_WIDTHS = [56, 60, 64, 68];
  const SOLO_PLATFORM_WIDTHS = [58, 68, 78, 90];
  const TYPE_TASKS = ['mv-prod', 'rm-legacy', 'one-stack'];
  const EVENT_LABELS = [
    ['downgrade', 'DOWNGRADE'],
    ['scopeCreep', 'SCOPE CREEP'],
    ['management', 'MGMT INTERVENTION'],
    ['framework', 'NEW FRAMEWORK'],
  ];
  const DANCE_TASKS = [
    ['left', 'up', 'right', 'down'],
    ['up', 'left', 'right', 'up'],
    ['right', 'right', 'down', 'left'],
  ];

  let state = 'menu';
  let lastFrame = 0;
  let elapsed = 0;
  let platforms = [];
  let choices = [];
  let currentPlatform = null;
  let previousPlatform = null;
  let downgradeState = null;
  let downJumpState = false;
  let player = null;
  let cameraY = 0;
  let round = 1;
  let forkCountdown = 0;
  let eventCooldown = 0;
  let scopeCreepPending = false;
  let scopeCreepRound = null;
  let controlsInverted = false;
  let score = 0;
  let compliance = 75;
  let sundown = 8;
  let sundownMax = 8;
  let screenAlert = null;
  let floatingNumbers = [];
  let eventStats = null;
  let hurdles = [];
  let activeTask = null;
  let taskProgress = 0;
  let taskErrorUntil = 0;
  let badge = null;
  let complianceHoop = null;
  let gameOverReason = 'The current platform reached sundown.';
  let bestScore = loadBestScore();
  let keysDown = new Set();

  function loadBestScore() {
    try {
      return Number(localStorage.getItem('oneplatforms-best') || 0);
    } catch (_) {
      return 0;
    }
  }

  function saveBestScore(value) {
    try {
      localStorage.setItem('oneplatforms-best', String(value));
    } catch (_) {
      // The game still works if storage is disabled.
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomInt(max) {
    return Math.floor(Math.random() * max);
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function changeCompliance(amount, x, y, display = null) {
    const before = compliance;
    compliance = clamp(compliance + amount, 0, 100);
    const change = compliance - before;
    if (change !== 0) {
      const stack = floatingNumbers.filter((item) => elapsed - item.startedAt < 0.12 && Math.abs(item.x - x) < 80).length;
      floatingNumbers.push({ amount: change, display: display || `${change > 0 ? '+' : ''}${change}`, x: x + (stack % 2 ? 12 : -12), y: y - stack * 8, startedAt: elapsed, duration: 1.1 });
    }
    return change;
  }

  function createEventStats() {
    return Object.fromEntries(EVENT_LABELS.map(([key]) => [key, { seen: 0, survived: 0 }]));
  }

  function recordEvent(type) {
    if (eventStats?.[type]) eventStats[type].seen += 1;
  }

  function markEventSurvived(type) {
    const event = eventStats?.[type];
    if (event && event.survived < event.seen) event.survived += 1;
  }

  function generatePlatformName(usedNames = new Set()) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const base = PLATFORM_BASES[randomInt(PLATFORM_BASES.length)];
      const editionName = `${base} ${PLATFORM_EDITIONS[randomInt(PLATFORM_EDITIONS.length)]}`;
      const name = editionName.length <= 20 && randomInt(2) === 0 ? editionName : base;
      if (name.length <= 20 && !usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }

    const fallback = `OnePlatform ${usedNames.size + 2}.0`;
    usedNames.add(fallback);
    return fallback;
  }

  function startGame() {
    state = 'playing';
    keysDown.clear();
    elapsed = 0;
    score = 0;
    compliance = 75;
    round = 1;
    forkCountdown = 5 + randomInt(4);
    eventCooldown = 0;
    scopeCreepPending = false;
    scopeCreepRound = null;
    controlsInverted = false;
    downgradeState = null;
    downJumpState = false;
    previousPlatform = null;
    sundownMax = randomBetween(5, 7);
    sundown = sundownMax;
    screenAlert = null;
    floatingNumbers = [];
    eventStats = createEventStats();
    platforms = [];
    choices = [];
    hurdles = [];
    activeTask = null;
    taskProgress = 0;
    taskErrorUntil = 0;
    badge = null;
    complianceHoop = null;
    cameraY = 48;
    player = {
      x: W / 2,
      y: 248,
      vy: 0,
      grounded: true,
      facing: 1,
      walkFrame: 0,
      dancePose: null,
      danceUntil: 0,
    };
    currentPlatform = makePlatform(W / 2, 248, true, 0, 'Legacy Landing', SOLO_PLATFORM_WIDTHS[randomInt(SOLO_PLATFORM_WIDTHS.length)]);
    platforms.push(currentPlatform);
    createChoices();
    canvas.focus({ preventScroll: true });
  }

  function makePlatform(x, y, isTrue, targetRound, name = generatePlatformName(), width = 68) {
    return {
      x,
      y,
      width,
      name,
      isTrue,
      targetRound,
      settled: false,
      flash: null,
    };
  }

  function flashPlatform(platform, kind, duration = 0.8) {
    if (!platform) return;
    platform.flash = { kind, startedAt: elapsed, expiresAt: elapsed + duration };
  }

  function flashScreenAlert(message, options = {}) {
    const persistent = options.persistent ?? false;
    const duration = options.duration ?? 0.8;
    screenAlert = {
      message,
      startedAt: elapsed,
      expiresAt: persistent ? Infinity : elapsed + duration,
      persistent,
      tint: options.tint || 'rgba(238, 45, 63, 0.2)',
      color: options.color || COLORS.cream,
      shadow: options.shadow || '#7b263c',
      y: options.y ?? 90,
      border: options.border || COLORS.red,
    };
  }

  function createChoices() {
    const isFork = forkCountdown <= 0;
    const scopeCreepFork = isFork && scopeCreepPending;
    const optionCount = isFork ? (scopeCreepFork || randomInt(5) === 0 ? 3 : 2) : 1;
    if (isFork) {
      forkCountdown = 5 + randomInt(4);
      if (scopeCreepFork) scopeCreepRound = round;
      scopeCreepPending = false;
    } else {
      forkCountdown -= 1;
    }
    const sourceX = currentPlatform.x;
    const edge = optionCount === 1 ? 50 : 42;
    const slots = [-140, -70, 0, 70, 140]
      .map((offset) => clamp(sourceX + offset, edge, W - edge))
      .filter((x, index, list) => list.findIndex((other) => Math.abs(other - x) < 68) === index);
    const selected = slots
      .map((x) => ({ x, order: Math.random() }))
      .sort((a, b) => a.order - b.order)
      .slice(0, optionCount)
      .map(({ x }) => x)
      .sort((a, b) => a - b);
    const trueIndex = randomInt(selected.length);
    const targetY = currentPlatform.y - 60;
    const usedNames = new Set();
    choices = selected.map((x, index) => {
      const isTrue = index === trueIndex;
      const widths = optionCount === 1 ? SOLO_PLATFORM_WIDTHS : FORK_PLATFORM_WIDTHS;
      const width = widths[randomInt(widths.length)];
      const platform = makePlatform(x, targetY, isTrue, round, generatePlatformName(usedNames), width);
      platforms.push(platform);
      return platform;
    });

    const truePlatform = choices[trueIndex];
    badge = Math.random() < 0.3
      ? {
        x: (currentPlatform.x + truePlatform.x) / 2,
        y: (currentPlatform.y + targetY) / 2,
        collected: false,
      }
      : null;

    const direction = Math.sign(truePlatform.x - currentPlatform.x);
    complianceHoop = Math.random() < 0.22
      ? { x: clamp(currentPlatform.x + direction * 24, currentPlatform.x - 32, currentPlatform.x + 32), y: currentPlatform.y - 43, status: 'burning', expiresAt: Infinity }
      : null;
  }

  function jump() {
    if (!player.grounded || activeTask || state !== 'playing' || downgradeState?.phase === 'falling') return;
    if (keysDown.has('arrowdown') || keysDown.has('s')) {
      if (!previousPlatform) return;
      downJumpState = true;
      player.grounded = false;
      player.vy = 40;
      player.walkFrame = 0;
      return;
    }
    downJumpState = false;
    player.grounded = false;
    player.vy = -296;
    player.walkFrame = 0;
  }

  function addHurdle() {
    const kind = (round + hurdles.length) % 2 === 0 ? 'type' : 'dance';
    const taskIndex = Math.floor((round + hurdles.length) / 2) % 3;
    hurdles.push({
      kind,
      prompt: kind === 'type' ? TYPE_TASKS[taskIndex] : DANCE_TASKS[taskIndex],
    });
  }

  function openHurdleTask() {
    if (!player.grounded || !hurdles.length || activeTask) return;
    activeTask = hurdles[0];
    taskProgress = 0;
    taskErrorUntil = 0;
  }

  function resolveTask() {
    hurdles.shift();
    activeTask = null;
    taskProgress = 0;
    taskErrorUntil = 0;
    flashPlatform(currentPlatform, 'success', 0.7);
  }

  function handleTaskKey(key) {
    if (!activeTask) return;
    if (activeTask.kind === 'type') {
      if (key === 'backspace') {
        taskProgress = Math.max(0, taskProgress - 1);
        return;
      }
      if (key.length !== 1) return;
      const expected = activeTask.prompt[taskProgress];
      if (key.toLowerCase() === expected) {
        taskProgress += 1;
        taskErrorUntil = 0;
        if (taskProgress >= activeTask.prompt.length) resolveTask();
      } else {
        taskProgress = 0;
        taskErrorUntil = elapsed + 0.45;
        sundown = Math.max(0, sundown - 0.65);
      }
      return;
    }

    const direction = ({
      arrowleft: 'left', a: 'left',
      arrowright: 'right', d: 'right',
      arrowup: 'up', w: 'up',
      arrowdown: 'down', s: 'down',
    })[key];
    if (!direction) return;
    player.dancePose = direction;
    player.danceUntil = elapsed + 0.3;
    if (direction === activeTask.prompt[taskProgress]) {
      taskProgress += 1;
      taskErrorUntil = 0;
      if (taskProgress >= activeTask.prompt.length) resolveTask();
    } else {
      taskProgress = 0;
      taskErrorUntil = elapsed + 0.45;
      sundown = Math.max(0, sundown - 0.65);
    }
  }

  function landOn(platform) {
    player.y = platform.y;
    player.vy = 0;
    player.grounded = true;
    if (controlsInverted && platform !== currentPlatform) {
      controlsInverted = false;
      markEventSurvived('management');
      if (screenAlert?.persistent && screenAlert.message === 'MANAGEMENT INTERVENTION') screenAlert = null;
    }
    player.x = clamp(player.x, platform.x - platform.width / 2 + 8, platform.x + platform.width / 2 - 8);

    if (downgradeState?.phase === 'falling' && platform === downgradeState.target) {
      const downgrade = downgradeState;
      platform.settled = true;
      markEventSurvived('downgrade');
      currentPlatform = downgrade.target;
      previousPlatform = null;
      choices = [];
      complianceHoop = null;
      downJumpState = false;
      round = downgrade.retryRound;
      downgradeState = null;
      sundownMax = randomBetween(5, 7);
      sundown = sundownMax;
      flashPlatform(currentPlatform, 'success', 0.7);
      createChoices();
      return;
    }

    if (platform === previousPlatform && platform !== currentPlatform) {
      platform.settled = true;
      currentPlatform = platform;
      previousPlatform = null;
      choices = [];
      complianceHoop = null;
      badge = null;
      downJumpState = false;
      round = Math.max(1, round - 1);
      changeCompliance(-Math.round(compliance * 0.75), platform.x, platform.y - 22);
      flashScreenAlert('COMPLIANCE VIOLATION', { y: 108, duration: 1.3 });
      sundownMax = randomBetween(4, 5.5);
      sundown = sundownMax;
      flashPlatform(platform, 'error', 1.2);
      if (compliance <= 0) {
        endGame('Dropping to the previous platform cost 75% compliance, leaving none.');
        return;
      }
      createChoices();
      return;
    }

    if (platform === currentPlatform) return;
    downJumpState = false;

    platform.settled = true;
    const wasTrue = platform.isTrue;
    const scopeCreepChoice = scopeCreepRound !== null && choices.includes(platform) && platform.targetRound === scopeCreepRound;
    const scoreBeforeLanding = score;
    const complianceBeforeLanding = compliance;
    const platformBeforeLanding = currentPlatform;
    currentPlatform = platform;
    previousPlatform = platformBeforeLanding;
    choices = [];
    if (eventCooldown > 0) eventCooldown -= 1;

    if (wasTrue) {
      const award = 8 + Math.min(round, 8);
      changeCompliance(award, platform.x, platform.y - 22);
      score += 100 + round * 15;
      sundownMax = randomBetween(5, 7);
      sundown = sundownMax;
      flashPlatform(platform, 'success');
    } else {
      changeCompliance(-18, platform.x, platform.y - 22);
      score = Math.max(0, score - 25);
      addHurdle();
      sundownMax = randomBetween(4, 5.5);
      sundown = sundownMax;
      flashScreenAlert('BAD CHOICE', { y: 248, duration: 1.1 });
      flashPlatform(platform, 'error');
    }

    round += 1;
    if (compliance <= 0) {
      endGame('A decoy platform cost the last compliance points.');
      return;
    }
    if (scopeCreepChoice) {
      markEventSurvived('scopeCreep');
      scopeCreepRound = null;
    }

    if (wasTrue && platformBeforeLanding && !hurdles.length && eventCooldown === 0 && Math.random() < 0.04) {
      eventCooldown = 8 + randomInt(5);
      if (randomInt(12) === 0) {
        recordEvent('framework');
        const frameworkLoss = Math.max(1, Math.round(compliance * 0.5));
        changeCompliance(-frameworkLoss, platform.x, platform.y - 22, '-50%');
        flashPlatform(platform, 'error', 1.4);
        flashScreenAlert('NEW COMPLIANCE FRAMEWORK', { duration: 1.4, y: 108 });
        if (compliance <= 0) {
          endGame('A new compliance framework cut compliance by 50%, leaving none.');
          return;
        }
        markEventSurvived('framework');
        createChoices();
        return;
      }

      const eventType = randomInt(3);
      if (eventType === 0) {
        recordEvent('downgrade');
        const leftSpace = platform.x - 50;
        const rightSpace = W - 50 - platform.x;
        const side = leftSpace < 45 ? 1 : rightSpace < 45 ? -1 : Math.random() < 0.5 ? -1 : 1;
        const maxOffset = Math.min(96, side < 0 ? leftSpace : rightSpace);
        const offset = 45 + randomInt(Math.max(1, Math.floor(maxOffset - 44)));
        const recoveryX = clamp(platform.x + side * offset, 50, W - 50);
        const retryRound = Math.max(1, round - 1);
        const recoveryPlatform = makePlatform(
          recoveryX,
          platform.y + 190,
          true,
          retryRound,
          generatePlatformName(),
          SOLO_PLATFORM_WIDTHS[randomInt(SOLO_PLATFORM_WIDTHS.length)],
        );
        recoveryPlatform.flash = { kind: 'target', startedAt: elapsed, expiresAt: elapsed + 1.6 };
        platforms = [recoveryPlatform];
        choices = [];
        complianceHoop = null;
        badge = null;
        score = scoreBeforeLanding;
        changeCompliance(complianceBeforeLanding - compliance, platform.x, platform.y - 22);
        round = retryRound;
        player.grounded = false;
        player.vy = 0;
        cameraY = player.y - 82;
        downgradeState = {
          phase: 'falling',
          target: recoveryPlatform,
          retryRound,
          revealAt: elapsed + 0.25,
        };
        flashScreenAlert('DOWNGRADE', { y: 108, duration: 1.2 });
        return;
      }

      if (eventType === 1) {
        recordEvent('scopeCreep');
        scopeCreepPending = true;
        flashPlatform(platform, 'event', 1.2);
      } else {
        recordEvent('management');
        controlsInverted = true;
        flashPlatform(platform, 'event', 1.2);
        flashScreenAlert('MANAGEMENT INTERVENTION', {
          duration: Infinity,
          persistent: true,
          tint: 'rgba(243, 186, 88, 0.07)',
          color: COLORS.cream,
          shadow: '#76501c',
          border: COLORS.gold,
        });
      }
    }

    createChoices();
    if (!wasTrue) openHurdleTask();
  }

  function endGame(reason) {
    state = 'gameover';
    activeTask = null;
    gameOverReason = reason;
    if (score > bestScore) {
      bestScore = score;
      saveBestScore(bestScore);
    }
  }

  function update(dt) {
    if (state === 'gameover') {
      elapsed += dt;
      return;
    }
    if (state !== 'playing') return;
    elapsed += dt;
    sundown = Math.max(0, sundown - dt);
    if (sundown <= 0) {
      endGame('Sundown. Your platform has entered end-of-life support.');
      return;
    }

    if (activeTask) return;

    const left = keysDown.has('arrowleft') || keysDown.has('a');
    const right = keysDown.has('arrowright') || keysDown.has('d');
    const requestedDirection = (right ? 1 : 0) - (left ? 1 : 0);
    const direction = controlsInverted ? -requestedDirection : requestedDirection;
    const jumpSpeed = Math.max(98, 184 - hurdles.length * 22);

    if (direction !== 0) {
      player.x += direction * jumpSpeed * dt;
      player.facing = direction;
      player.walkFrame += dt * 12;
    }
    player.x = clamp(player.x, 7, W - 7);

    const previousY = player.y;
    if (!player.grounded) {
      const downgradeFall = downgradeState?.phase === 'falling';
      player.vy += (downgradeFall ? 260 : 640) * dt;
      if (downgradeFall) player.vy = Math.min(player.vy, 230);
      player.y += player.vy * dt;
      if (complianceHoop?.status === 'burning' && previousY - 10 > complianceHoop.y && player.y - 10 <= complianceHoop.y) {
        if (Math.abs(player.x - complianceHoop.x) <= 9) {
          complianceHoop.status = 'cleared';
          changeCompliance(5, player.x, player.y - 20);
          score += 40;
          flashPlatform(currentPlatform, 'success', 0.65);
        } else {
          complianceHoop.status = 'hit';
          changeCompliance(-25, player.x, player.y - 20);
          sundown = Math.max(0, sundown - 0.65);
          flashPlatform(currentPlatform, 'error', 0.65);
        }
        complianceHoop.expiresAt = elapsed + 0.8;
        if (compliance <= 0) {
          endGame('A burning compliance hoop consumed the last compliance points.');
          return;
        }
      }

      if (badge && !badge.collected && Math.abs(player.x - badge.x) < 9 && Math.abs(player.y - badge.y) < 12) {
        badge.collected = true;
        changeCompliance(7, player.x, player.y - 22);
        score += 35;
        flashPlatform(currentPlatform, 'info', 0.65);
      }

      if (player.vy > 0) {
        const landingPlatforms = downgradeState?.phase === 'falling'
          ? [downgradeState.target]
          : downJumpState
            ? [previousPlatform].filter(Boolean)
            : [currentPlatform, previousPlatform, ...choices].filter(Boolean);
        const landed = landingPlatforms.find((platform) =>
          previousY <= platform.y && player.y >= platform.y &&
          player.x + 6 >= platform.x - platform.width / 2 &&
          player.x - 6 <= platform.x + platform.width / 2,
        );
        if (landed) landOn(landed);
      }
    } else if (player.x < currentPlatform.x - currentPlatform.width / 2 - 7 || player.x > currentPlatform.x + currentPlatform.width / 2 + 7) {
      player.grounded = false;
      player.vy = 0;
    }

    if (downgradeState?.phase === 'falling') {
      if (player.y > downgradeState.target.y + 60) {
        endGame('The recovery platform was missed. Q3 has been rescheduled.');
        return;
      }
    } else if (!player.grounded && player.y > currentPlatform.y + 115) {
      endGame('You missed every platform. The migration plan was “we will figure it out later.”');
      return;
    }

    const targetCamera = player.y - (downgradeState?.phase === 'falling' ? 82 : 200);
    cameraY += (targetCamera - cameraY) * Math.min(1, dt * 5);
    if (complianceHoop && complianceHoop.status !== 'burning' && elapsed >= complianceHoop.expiresAt) complianceHoop = null;
    const visiblePlatforms = downgradeState?.phase === 'falling'
      ? new Set([downgradeState.target])
      : new Set([currentPlatform, previousPlatform, ...choices]);
    platforms = platforms.filter((platform) => platform.y - cameraY < H + 70 && visiblePlatforms.has(platform));
  }

  function rect(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function text(value, x, y, color = COLORS.cream, size = 8, align = 'left') {
    ctx.font = `700 ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.fillText(value, Math.round(x), Math.round(y));
  }

  function wrappedText(value, x, y, maxWidth, color, size, lineHeight) {
    ctx.font = `700 ${size}px Arial, Helvetica, sans-serif`;
    const lines = [];
    let line = '';
    for (const word of value.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    lines.forEach((part, index) => text(part, x, y + index * lineHeight, color, size, 'center'));
  }

  function drawBackground() {
    rect(0, 0, W, H, '#20203d');
    rect(0, 0, W, 86, '#292643');
    rect(0, 86, W, 58, '#45304d');
    rect(0, 144, W, 45, '#7b4056');
    rect(0, 189, W, 34, '#b95a5c');
    rect(0, 223, W, H - 223, '#e88762');

    const sunY = 245 - (cameraY % 120) * 0.1;
    rect(355, sunY, 52, 8, '#ffd27a');
    rect(347, sunY + 8, 68, 20, '#ffd27a');
    rect(355, sunY + 28, 52, 8, '#ffd27a');
    rect(365, sunY + 36, 32, 5, '#ffd27a');
    rect(356, sunY + 45, 50, 3, '#ffd27a');

    for (let i = 0; i < 19; i += 1) {
      const x = (i * 83 + 21) % W;
      const y = (i * 47 + Math.floor(cameraY * 0.3)) % 185;
      rect(x, y, 2, 2, i % 3 === 0 ? '#ffd27a' : '#d2a4b5');
    }

    // Distant rooftops make the climb feel like an increasingly questionable enterprise.
    for (let i = 0; i < 8; i += 1) {
      const x = i * 68 - ((cameraY * 0.16) % 68);
      const height = 18 + ((i * 17) % 35);
      rect(x, 273 - height, 38, height + 47, '#34304c');
      rect(x + 8, 283 - height, 4, 3, '#efb866');
      rect(x + 23, 294 - height, 4, 3, '#efb866');
    }
  }

  function drawPlatform(platform) {
    if (downgradeState?.phase === 'falling' && platform === downgradeState.target && elapsed < downgradeState.revealAt) return;
    const x = Math.round(platform.x - platform.width / 2);
    const y = Math.round(platform.y - cameraY);
    if (y < -36 || y > H + 10) return;
    const burning = platform === currentPlatform && sundown < 3;
    const flash = platform.flash;
    const flashing = flash && elapsed < flash.expiresAt && Math.floor((elapsed - flash.startedAt) * 5) % 2 === 0;
    const flashColor = flash?.kind === 'error' ? COLORS.red : flash?.kind === 'success' ? COLORS.green : flash?.kind === 'target' ? COLORS.cyan : flash?.kind === 'info' ? COLORS.gold : COLORS.orange;

    rect(x - 3, y + 5, platform.width + 6, 8, '#302344');
    rect(x, y, platform.width, 8, flashing ? flashColor : burning ? '#d46159' : '#53b6b1');
    rect(x + 3, y + 2, platform.width - 6, 3, flashing ? COLORS.cream : burning ? '#ffc16b' : '#9af0cf');
    rect(x + 7, y + 8, 4, 5, '#73547b');
    rect(x + platform.width - 11, y + 8, 4, 5, '#73547b');
    if (burning && Math.floor(elapsed * 8) % 2 === 0) {
      rect(x + 10, y - 3, 3, 3, '#ffb05f');
      rect(x + platform.width - 15, y - 2, 2, 2, '#ff8060');
    }

    const nameSize = clamp(Math.floor((platform.width - 10) / (platform.name.length * 0.58)), 5, 8);
    rect(x - 2, y - 15, platform.width + 4, 12, '#20203d');
    rect(x - 2, y - 15, platform.width + 4, 1, '#f3ba58');
    text(platform.name, platform.x, y - 6, COLORS.cream, nameSize, 'center');
  }

  function drawComplianceHoop() {
    if (!complianceHoop) return;
    const cx = Math.round(complianceHoop.x);
    const cy = Math.round(complianceHoop.y - cameraY);
    if (cy < -36 || cy > H + 36) return;

    const burning = complianceHoop.status === 'burning';
    const ringColor = complianceHoop.status === 'cleared' ? COLORS.green : complianceHoop.status === 'hit' ? COLORS.red : null;
    if (burning) {
      rect(cx - 49, cy - 43, 98, 11, '#17182e');
      text('COMPLIANCE HOOP', cx, cy - 35, COLORS.cyan, 8, 'center');
    }

    for (let i = 0; i < 20; i += 1) {
      const angle = (Math.PI * 2 * i) / 20;
      const x = cx + Math.cos(angle) * 27;
      const y = cy + Math.sin(angle) * 27;
      rect(x - 3, y - 3, 6, 6, ringColor || COLORS.lavender);
    }

    const segments = 20;
    for (let i = 0; i < segments; i += 1) {
      const angle = (Math.PI * 2 * i) / segments;
      const radius = 22;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const flame = burning && (i + Math.floor(elapsed * 12)) % 3 === 0;
      const color = ringColor || (flame ? '#fff0a0' : i % 2 === 0 ? COLORS.orange : COLORS.gold);
      const size = flame ? 7 : 5;
      rect(x - size / 2, y - size / 2, size, size, color);
    }

    if (burning) {
      // Cool-colored ticks outline the safe opening; the hot rim is the hazard.
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8;
        rect(cx + Math.cos(angle) * 13 - 1, cy + Math.sin(angle) * 13 - 1, 3, 3, COLORS.cyan);
      }
      if (Math.floor(elapsed * 10) % 2 === 0) {
        rect(cx - 2, cy - 29, 4, 5, COLORS.orange);
        rect(cx + 5, cy - 27, 3, 4, COLORS.gold);
      }
    }
  }

  function drawDirectionArrow(cx, cy, direction, color) {
    rect(cx - 2, cy - 5, 4, 10, color);
    if (direction === 'down') {
      rect(cx - 6, cy + 1, 12, 3, color);
      rect(cx - 4, cy + 4, 8, 3, color);
      rect(cx - 2, cy + 7, 4, 2, color);
    } else {
      rect(cx - 6, cy - 4, 12, 3, color);
      rect(cx - 4, cy - 7, 8, 3, color);
      rect(cx - 2, cy - 9, 4, 2, color);
    }
  }

  function drawDowngradeCue() {
    if (!downgradeState || elapsed < downgradeState.revealAt) return;
    const target = downgradeState.target;
    const y = Math.round(target.y - cameraY);
    drawDirectionArrow(target.x, y - 37, 'down', COLORS.cyan);
  }

  function drawScreenAlert() {
    if (!screenAlert) return;
    if (!screenAlert.persistent && elapsed >= screenAlert.expiresAt) {
      screenAlert = null;
      return;
    }
    const pulseSpeed = screenAlert.persistent ? 2 : 12;
    const pulse = Math.floor((elapsed - screenAlert.startedAt) * pulseSpeed) % 2 === 0;
    if (pulse) rect(0, 0, W, H, screenAlert.tint);
    const boxY = screenAlert.y;
    rect(42, boxY, W - 84, 38, '#17182e');
    rect(42, boxY, W - 84, 3, screenAlert.border);
    text(screenAlert.message, W / 2 + 1, boxY + 25, screenAlert.shadow, 18, 'center');
    text(screenAlert.message, W / 2, boxY + 23, screenAlert.color, 17, 'center');
  }

  function drawHurdleIcon(cx, cy, kind, scale = 1) {
    const color = kind === 'type' ? COLORS.orange : COLORS.pink;
    rect(cx - 7 * scale, cy - 5 * scale, 14 * scale, 10 * scale, '#33213d');
    rect(cx - 5 * scale, cy - 3 * scale, 5 * scale, 6 * scale, color);
    rect(cx + 1 * scale, cy - 3 * scale, 5 * scale, 6 * scale, color);
    rect(cx - 2 * scale, cy - 1 * scale, 4 * scale, 2 * scale, '#fff4d6');
    rect(cx - 1 * scale, cy - 6 * scale, 2 * scale, 2 * scale, COLORS.gold);
    rect(cx + 4 * scale, cy + 4 * scale, 3 * scale, 2 * scale, color);
  }

  function drawHurdles() {
    if (!player || !hurdles.length) return;
    const shown = Math.min(hurdles.length, 8);
    for (let i = 0; i < shown; i += 1) {
      const ring = Math.floor(i / 4);
      const inRing = Math.min(shown - ring * 4, 4);
      const angle = elapsed * 2.6 + (i % 4) * (Math.PI * 2 / inRing) + ring * 0.7;
      const centerX = player.x + Math.cos(angle) * (22 + ring * 10);
      const centerY = player.y - cameraY - 12 + Math.sin(angle) * (15 + ring * 6);
      drawHurdleIcon(centerX, centerY, hurdles[i].kind);
    }
  }

  function drawBadge() {
    if (!badge || badge.collected) return;
    const x = Math.round(badge.x);
    const y = Math.round(badge.y - cameraY);
    rect(x - 4, y - 7, 8, 14, '#fff1ad');
    rect(x - 7, y - 4, 14, 8, '#fff1ad');
    rect(x - 2, y - 4, 4, 8, '#f3ba58');
    rect(x - 4, y - 2, 8, 4, '#f3ba58');
  }

  function drawNerd() {
    if (!player) return;
    const x = Math.round(player.x);
    const feet = Math.round(player.y - cameraY);
    const dancing = player.danceUntil > elapsed;
    const walkBob = player.grounded && (keysDown.has('a') || keysDown.has('d') || keysDown.has('arrowleft') || keysDown.has('arrowright'))
      ? Math.round(Math.sin(player.walkFrame) * 2)
      : 0;
    const bob = dancing ? Math.round(Math.sin(elapsed * 32) * 2) : walkBob;
    const top = feet - 21 + bob;
    const flip = player.facing < 0;
    const px = (offset) => x + (flip ? -offset : offset);

    // Backpack, body, limbs, and the mandatory thick-rimmed glasses.
    rect(px(-8), top + 9, 5, 8, '#8c5d9a');
    rect(px(-6), top + 8, 12, 9, '#5574b9');
    const leftLeg = dancing && player.dancePose === 'left' ? -8 : -6;
    const rightLeg = dancing && player.dancePose === 'right' ? 4 : 2;
    rect(px(leftLeg), top + 17, 4, 4, '#30314f');
    rect(px(rightLeg), top + 17, 4, 4, '#30314f');
    rect(px(-7), top + 3, 14, 7, '#efc49a');
    rect(px(-8), top, 16, 4, '#5b3b3d');
    rect(px(-7), top + 3, 6, 4, '#30314f');
    rect(px(1), top + 3, 6, 4, '#30314f');
    rect(px(-6), top + 4, 4, 2, '#86e4da');
    rect(px(2), top + 4, 4, 2, '#86e4da');
    rect(px(-1), top + 4, 2, 1, '#30314f');
    rect(px(-2), top + 8, 4, 1, '#aa4f53');

    if (!dancing) {
      rect(px(-9), top + 10, 3, 6, '#efc49a');
      rect(px(6), top + 10, 3, 6, '#efc49a');
    } else if (player.dancePose === 'up') {
      rect(px(-10), top + 1, 3, 8, '#efc49a');
      rect(px(7), top + 1, 3, 8, '#efc49a');
      rect(px(-11), top, 4, 3, COLORS.gold);
      rect(px(7), top, 4, 3, COLORS.gold);
    } else if (player.dancePose === 'left') {
      rect(px(-12), top + 9, 8, 3, '#efc49a');
      rect(px(6), top + 5, 3, 7, '#efc49a');
      rect(px(-13), top + 8, 3, 4, COLORS.gold);
    } else if (player.dancePose === 'right') {
      rect(px(-9), top + 5, 3, 7, '#efc49a');
      rect(px(4), top + 9, 8, 3, '#efc49a');
      rect(px(10), top + 8, 3, 4, COLORS.gold);
    } else {
      rect(px(-10), top + 9, 5, 4, '#efc49a');
      rect(px(5), top + 9, 5, 4, '#efc49a');
      rect(px(-8), top + 12, 3, 4, COLORS.gold);
      rect(px(5), top + 12, 3, 4, COLORS.gold);
    }
  }

  function drawHud() {
    rect(0, 0, W, 36, '#17182e');
    rect(0, 35, W, 2, '#5b456d');
    text(`SCORE ${String(score).padStart(5, '0')}`, 12, 15, COLORS.cream, 10);
    text(`COMPLIANCE ${compliance}%`, 164, 15, compliance <= 30 ? COLORS.red : COLORS.cyan, 10);
    text('SUNDOWN', W - 12, 15, sundown <= 2 ? COLORS.red : COLORS.gold, 10, 'right');

    rect(12, 22, 112, 8, '#39364f');
    rect(14, 24, 108 * (compliance / 100), 4, compliance <= 30 ? COLORS.red : COLORS.cyan);
    drawSundownBar(W - 140, 21, 128, 10);

    rect(9, 43, W - 18, 18, '#25243e');
    text(`ROUND ${String(round).padStart(2, '0')}`, 16, 55, COLORS.cream, 9);
    hurdles.slice(0, 8).forEach((hurdle, index) => {
      drawHurdleIcon(W - 15 - index * 17, 73, hurdle.kind, 0.8);
    });
  }

  function drawSundownBar(x, y, width, height) {
    const progress = clamp(sundown / sundownMax, 0, 1);
    const fill = sundown <= 2 ? COLORS.red : sundown <= sundownMax * 0.45 ? COLORS.orange : COLORS.gold;
    rect(x, y, width, height, '#39364f');
    rect(x + 2, y + 2, Math.max(0, (width - 4) * progress), height - 4, fill);
    for (let tick = 1; tick < 8; tick += 1) {
      rect(x + Math.round((width * tick) / 8), y, 1, height, '#17182e');
    }
  }

  function drawTaskOverlay() {
    rect(0, 0, W, H, 'rgba(15, 16, 34, 0.22)');
    drawHud();
    const panelX = 56;
    const panelY = 68;
    const panelW = W - 112;
    const panelH = 76;
    const error = taskErrorUntil > elapsed;
    rect(panelX, panelY, panelW, panelH, '#292943');
    rect(panelX, panelY, panelW, 3, error ? COLORS.red : COLORS.orange);
    const danceTask = activeTask.kind === 'dance';
    if (danceTask) text('COMPLIANCE DANCE', W / 2, panelY + 13, COLORS.cream, 8, 'center');
    drawHurdleIcon(panelX + 22, panelY + 39, activeTask.kind, 1.25);

    // A sequence of keycaps is the whole instruction: type the keys or follow the arrows.
    const symbols = activeTask.kind === 'type'
      ? [...activeTask.prompt].map((key) => key.toUpperCase())
      : activeTask.prompt.map((direction) => ({ left: '←', right: '→', up: '↑', down: '↓' }[direction]));
    const gap = 4;
    const tileW = activeTask.kind === 'type' ? 26 : 32;
    const tileH = 29;
    const sequenceWidth = symbols.length * tileW + (symbols.length - 1) * gap;
    const startX = panelX + 48 + (panelW - 48 - sequenceWidth) / 2;
    const tileY = panelY + (danceTask ? 24 : 17);

    symbols.forEach((symbol, index) => {
      const x = startX + index * (tileW + gap);
      const done = index < taskProgress;
      const current = index === taskProgress;
      const face = error && current ? COLORS.red : done ? COLORS.green : current ? COLORS.gold : '#625c79';
      rect(x, tileY + 2, tileW, tileH, '#17182e');
      rect(x, tileY, tileW, tileH - 2, face);
      rect(x + 3, tileY + 3, tileW - 6, 2, '#fff4d6');
      text(symbol, x + tileW / 2, tileY + 20, '#17182e', activeTask.kind === 'type' ? 11 : 16, 'center');
    });

    const progressX = panelX + 18;
    const progressY = panelY + 61;
    const progressW = panelW - 36;
    rect(progressX, progressY, progressW, 4, '#17182e');
    if (taskProgress > 0) {
      rect(progressX, progressY, progressW * (taskProgress / symbols.length), 4, error ? COLORS.red : COLORS.green);
    }
  }

  function drawFloatingNumbers() {
    floatingNumbers = floatingNumbers.filter((item) => elapsed - item.startedAt < item.duration);
    for (const item of floatingNumbers) {
      const progress = clamp((elapsed - item.startedAt) / item.duration, 0, 1);
      const x = state === 'gameover' ? W - 58 : item.x + ((item.startedAt * 10) % 2 ? 1 : -1);
      const y = state === 'gameover' ? 58 - progress * 18 : item.y - cameraY - progress * 26;
      const previousAlpha = Number.isFinite(ctx.globalAlpha) ? ctx.globalAlpha : 1;
      ctx.globalAlpha = 1 - progress * 0.8;
      text(item.display, x + 1, y + 1, '#17182e', 13, 'center');
      text(item.display, x, y, item.amount > 0 ? COLORS.green : COLORS.red, 13, 'center');
      ctx.globalAlpha = previousAlpha;
    }
  }

  function drawBottomHint() {
    rect(0, H - 20, W, 20, '#17182e');
    rect(0, H - 20, W, 1, '#59476e');
    if (activeTask) return;
    const jumpHint = previousPlatform ? 'SPACE JUMP  |  ↓+SPACE DROP' : 'SPACE JUMP';
    if (controlsInverted) {
      text('A / ← = RIGHT', 10, H - 7, COLORS.gold, 7);
      text('D / → = LEFT', 155, H - 7, COLORS.gold, 7);
      text(jumpHint, W - 10, H - 7, COLORS.cream, 7, 'right');
    } else {
      text('A / D OR ← →  MOVE', 10, H - 7, COLORS.cream, 8);
      text(jumpHint, W - 10, H - 7, COLORS.cream, 7, 'right');
    }
  }

  function drawMenu() {
    drawBackground();
    // Tiny scene preview.
    const demo = [
      makePlatform(128, 242, true, 0, 'OneFabric 2.0', 74),
      makePlatform(250, 184, false, 0, 'OmniStack Next', 60),
      makePlatform(348, 184, true, 0, 'SynergiCloud 360', 84),
    ];
    demo.forEach(drawPlatform);
    player = { x: 214, y: 228, facing: 1, grounded: false, walkFrame: 0 };
    drawNerd();
    rect(0, 0, W, H, 'rgba(17, 18, 38, 0.25)');
    rect(31, 39, W - 62, 207, '#20203d');
    rect(31, 39, W - 62, 4, COLORS.gold);
    text('1PLATFORMS', W / 2, 82, COLORS.cream, 25, 'center');
    text('WE’LL BE DOWN TO ONE BY Q3.', W / 2, 105, COLORS.cyan, 9, 'center');
    text('GOAL: MIGRATE TO THE ONE TRUE PLATFORM', W / 2, 140, COLORS.gold, 8, 'center');
    text('A / D OR ← →  MOVE', W / 2, 162, COLORS.cream, 10, 'center');
    text('SPACE  JUMP', W / 2, 184, COLORS.cream, 10, 'center');
    text('↓ + SPACE  DROP TO LAST PLATFORM', W / 2, 202, COLORS.gold, 8, 'center');
    text('PRESS ENTER TO START', W / 2, 226, COLORS.green, 11, 'center');
    player = null;
  }

  function drawGameOver() {
    rect(0, 0, W, H, 'rgba(17, 18, 38, 0.78)');
    rect(30, 24, W - 60, H - 48, '#292943');
    rect(30, 24, W - 60, 4, COLORS.red);
    text('RUN ENDED', W / 2, 54, COLORS.red, 14, 'center');
    wrappedText(gameOverReason, W / 2, 82, W - 104, COLORS.cream, 8, 12);
    text(`SCORE ${score}     COMPLIANCE ${compliance}%`, W / 2, 121, COLORS.cyan, 10, 'center');
    text(`BEST ${bestScore}`, W / 2, 142, COLORS.gold, 9, 'center');
    text('EVENTS SURVIVED / SEEN', W / 2, 169, COLORS.cream, 8, 'center');

    EVENT_LABELS.forEach(([key, label], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column === 0 ? 130 : W - 130;
      const y = 193 + row * 24;
      const stats = eventStats?.[key] || { seen: 0, survived: 0 };
      text(`${label}  ${stats.survived} / ${stats.seen}`, x, y, COLORS.muted, 7, 'center');
    });

    text('PRESS ENTER OR R TO MIGRATE AGAIN', W / 2, 278, COLORS.green, 9, 'center');
  }

  function draw() {
    drawBackground();
    if (state === 'menu') {
      drawMenu();
      return;
    }

    platforms.forEach(drawPlatform);
    drawBadge();
    drawComplianceHoop();
    drawNerd();
    drawHurdles();
    drawDowngradeCue();
    drawHud();
    drawBottomHint();

    if (activeTask) drawTaskOverlay();
    drawScreenAlert();
    if (state === 'gameover') drawGameOver();
    drawFloatingNumbers();
  }

  function normalizeKey(event) {
    return event.key.toLowerCase();
  }

  window.addEventListener('keydown', (event) => {
    const key = normalizeKey(event);
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(key)) event.preventDefault();

    if (state === 'menu' && (key === 'enter' || key === ' ')) {
      startGame();
      return;
    }
    if (state === 'gameover' && (key === 'enter' || key === 'r')) {
      startGame();
      return;
    }
    if (state !== 'playing') return;

    if (activeTask) {
      event.preventDefault();
      handleTaskKey(key === ' ' ? ' ' : key);
      return;
    }

    keysDown.add(key);
    if (key === ' ' || key === 'arrowup' || key === 'w') jump();
  });

  window.addEventListener('keyup', (event) => {
    keysDown.delete(normalizeKey(event));
  });

  window.addEventListener('blur', () => keysDown.clear());

  function frame(timestamp) {
    const dt = Math.min(0.04, (timestamp - lastFrame) / 1000 || 0);
    lastFrame = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
