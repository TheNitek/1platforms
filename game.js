(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
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

  const PUZZLES = [
    {
      clue: 'THE CANONICAL PLATFORM',
      truth: 'CANON',
      decoys: ['LEGACY', 'SHADOW'],
    },
    {
      clue: 'FIND THE SOURCE OF TRUTH',
      truth: 'SOURCE',
      decoys: ['MIRROR', 'SHADOW COPY'],
    },
    {
      clue: 'ONLY ONE IDENTITY PROVIDER',
      truth: 'SINGLE SSO',
      decoys: ['LEGACY AUTH', 'VENDOR SSO'],
    },
    {
      clue: 'WHICH DASHBOARD IS NOT A COPY?',
      truth: 'PRIMARY',
      decoys: ['DASHBOARD 2', 'DASHBOARD 3'],
    },
    {
      clue: 'FIND DATA WITHOUT A SYNC COPY',
      truth: 'GOLDEN DATA',
      decoys: ['SYNC MIRROR', 'STALE CACHE'],
    },
    {
      clue: 'PICK THE ACTUAL PLATFORM TEAM',
      truth: 'CORE TEAM',
      decoys: ['ENABLEMENT', 'EXPERIENCE'],
    },
    {
      clue: 'ONE RUNTIME. NOT THREE “TEMPORARY” ONES.',
      truth: 'PRODUCTION',
      decoys: ['TEMP PROD', 'PROD FINAL'],
    },
  ];

  const TYPE_TASKS = ['git-mv-everything', 'delete-old-prod', 'one-platform-pls'];
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
  let player = null;
  let cameraY = 0;
  let round = 1;
  let score = 0;
  let compliance = 75;
  let sunset = 11;
  let sunsetMax = 11;
  let hurdles = [];
  let activeTask = null;
  let taskProgress = 0;
  let taskMessage = '';
  let badge = null;
  let notice = '';
  let noticeTimer = 0;
  let gameOverReason = 'The platform sunsetted.';
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

  function startGame() {
    state = 'playing';
    keysDown.clear();
    elapsed = 0;
    score = 0;
    compliance = 75;
    round = 1;
    sunsetMax = 11;
    sunset = sunsetMax;
    platforms = [];
    choices = [];
    hurdles = [];
    activeTask = null;
    taskProgress = 0;
    badge = null;
    notice = '';
    cameraY = 48;
    player = {
      x: W / 2,
      y: 248,
      vy: 0,
      grounded: true,
      facing: 1,
      walkFrame: 0,
    };
    currentPlatform = makePlatform(W / 2, 248, 'START', true, 0);
    platforms.push(currentPlatform);
    createChoices();
    canvas.focus({ preventScroll: true });
  }

  function makePlatform(x, y, label, isTrue, targetRound) {
    return {
      x,
      y,
      width: 68,
      label,
      isTrue,
      targetRound,
      settled: false,
    };
  }

  function createChoices() {
    const puzzle = PUZZLES[(round - 1) % PUZZLES.length];
    const optionCount = round === 1 ? 1 : round >= 4 && round % 2 === 0 ? 3 : 2;
    const sourceX = currentPlatform.x;
    const slots = [-140, -70, 0, 70, 140]
      .map((offset) => clamp(sourceX + offset, 42, W - 42))
      .filter((x, index, list) => list.findIndex((other) => Math.abs(other - x) < 68) === index);
    const selected = slots
      .map((x) => ({ x, order: Math.random() }))
      .sort((a, b) => a.order - b.order)
      .slice(0, optionCount)
      .map(({ x }) => x)
      .sort((a, b) => a - b);
    const trueIndex = randomInt(selected.length);
    const targetY = currentPlatform.y - 60;
    choices = selected.map((x, index) => {
      const isTrue = index === trueIndex;
      const label = isTrue ? puzzle.truth : puzzle.decoys[(index + round) % puzzle.decoys.length];
      const platform = makePlatform(x, targetY, label, isTrue, round);
      platforms.push(platform);
      return platform;
    });

    const truePlatform = choices[trueIndex];
    badge = {
      x: (currentPlatform.x + truePlatform.x) / 2,
      y: (currentPlatform.y + targetY) / 2,
      collected: false,
    };
  }

  function jump() {
    if (!player.grounded || activeTask || state !== 'playing') return;
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

  function beginTask() {
    if (!player.grounded || !hurdles.length || activeTask) return;
    activeTask = hurdles[0];
    taskProgress = 0;
    taskMessage = '';
  }

  function resolveTask() {
    hurdles.shift();
    activeTask = null;
    taskProgress = 0;
    taskMessage = '';
    showNotice('HURDLE CLEARED. JUMP SPEED RESTORED.');
  }

  function handleTaskKey(key) {
    if (!activeTask) return;
    if (key === 'escape') {
      activeTask = null;
      taskProgress = 0;
      taskMessage = '';
      return;
    }

    if (activeTask.kind === 'type') {
      if (key === 'backspace') {
        taskProgress = Math.max(0, taskProgress - 1);
        taskMessage = '';
        return;
      }
      if (key.length !== 1) return;
      const expected = activeTask.prompt[taskProgress];
      if (key.toLowerCase() === expected) {
        taskProgress += 1;
        taskMessage = '';
        if (taskProgress >= activeTask.prompt.length) resolveTask();
      } else {
        taskProgress = 0;
        taskMessage = 'WRONG. THE MIGRATION SCRIPT IS VERY FRAGILE.';
        sunset = Math.max(0, sunset - 0.65);
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
    if (direction === activeTask.prompt[taskProgress]) {
      taskProgress += 1;
      taskMessage = '';
      if (taskProgress >= activeTask.prompt.length) resolveTask();
    } else {
      taskProgress = 0;
      taskMessage = 'WRONG DANCE. PLEASE REPEAT THE ENTIRE CEREMONY.';
      sunset = Math.max(0, sunset - 0.65);
    }
  }

  function landOn(platform) {
    player.y = platform.y;
    player.vy = 0;
    player.grounded = true;
    player.x = clamp(player.x, platform.x - platform.width / 2 + 8, platform.x + platform.width / 2 - 8);

    if (platform === currentPlatform) return;

    platform.settled = true;
    const wasTrue = platform.isTrue;
    currentPlatform = platform;
    choices = [];
    if (wasTrue) {
      const award = 8 + Math.min(round, 8);
      compliance = Math.min(100, compliance + award);
      score += 100 + round * 15;
      sunsetMax = Math.max(7, 11 - round * 0.22);
      sunset = sunsetMax;
      showNotice(`TRUE PLATFORM! +${award} COMPLIANCE`);
    } else {
      compliance = Math.max(0, compliance - 18);
      score = Math.max(0, score - 25);
      addHurdle();
      sunsetMax = Math.max(6, 8 - hurdles.length * 0.45);
      sunset = sunsetMax;
      showNotice('DECOY! -18 COMPLIANCE. MIGRATION DEBT ADDED.');
    }

    round += 1;
    if (compliance <= 0) {
      endGame('Compliance reached zero. The auditors have logged off.');
      return;
    }
    createChoices();
  }

  function showNotice(message) {
    notice = message;
    noticeTimer = 2.1;
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
    if (state !== 'playing') return;
    elapsed += dt;
    sunset = Math.max(0, sunset - dt);
    if (noticeTimer > 0) noticeTimer -= dt;
    if (sunset <= 0) {
      endGame('Sunset. Your platform has entered end-of-life support.');
      return;
    }

    if (activeTask) return;

    const left = keysDown.has('arrowleft') || keysDown.has('a');
    const right = keysDown.has('arrowright') || keysDown.has('d');
    const direction = (right ? 1 : 0) - (left ? 1 : 0);
    const jumpSpeed = Math.max(98, 184 - hurdles.length * 22);

    if (direction !== 0) {
      player.x += direction * jumpSpeed * dt;
      player.facing = direction;
      player.walkFrame += dt * 12;
    }
    player.x = clamp(player.x, 7, W - 7);

    const previousY = player.y;
    if (!player.grounded) {
      player.vy += 640 * dt;
      player.y += player.vy * dt;
      if (badge && !badge.collected && Math.abs(player.x - badge.x) < 14 && Math.abs(player.y - badge.y) < 18) {
        badge.collected = true;
        compliance = Math.min(100, compliance + 7);
        score += 35;
        showNotice('COMPLIANCE STAMP COLLECTED! +7');
      }

      if (player.vy > 0) {
        const landingPlatforms = [currentPlatform, ...choices];
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

    if (!player.grounded && player.y > currentPlatform.y + 115) {
      endGame('You missed every platform. The migration plan was “we will figure it out later.”');
      return;
    }

    const targetCamera = player.y - 200;
    cameraY += (targetCamera - cameraY) * Math.min(1, dt * 5);
    platforms = platforms.filter((platform) => platform.y - cameraY < H + 70 && (platform === currentPlatform || choices.includes(platform)));
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
    const x = Math.round(platform.x - platform.width / 2);
    const y = Math.round(platform.y - cameraY);
    if (y < -36 || y > H + 10) return;
    const burning = platform === currentPlatform && sunset < 4;

    rect(x - 3, y + 5, platform.width + 6, 8, '#302344');
    rect(x, y, platform.width, 8, burning ? '#d46159' : '#53b6b1');
    rect(x + 3, y + 2, platform.width - 6, 3, burning ? '#ffc16b' : '#9af0cf');
    rect(x + 7, y + 8, 4, 5, '#73547b');
    rect(x + platform.width - 11, y + 8, 4, 5, '#73547b');
    if (burning && Math.floor(elapsed * 8) % 2 === 0) {
      rect(x + 10, y - 3, 3, 3, '#ffb05f');
      rect(x + platform.width - 15, y - 2, 2, 2, '#ff8060');
    }

    const label = platform.label;
    const fontSize = label.length > 11 ? 7 : label.length > 8 ? 8 : 9;
    rect(x - 2, y - 13, platform.width + 4, 10, '#20203d');
    rect(x - 2, y - 13, platform.width + 4, 1, '#f3ba58');
    text(label, platform.x, y - 5, COLORS.cream, fontSize, 'center');
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
    const bob = player.grounded && (keysDown.has('a') || keysDown.has('d') || keysDown.has('arrowleft') || keysDown.has('arrowright'))
      ? Math.round(Math.sin(player.walkFrame) * 2)
      : 0;
    const top = feet - 21 + bob;
    const flip = player.facing < 0;
    const px = (offset) => x + (flip ? -offset : offset);

    // Backpack, body, limbs, and the mandatory thick-rimmed glasses.
    rect(px(-8), top + 9, 5, 8, '#8c5d9a');
    rect(px(-6), top + 8, 12, 9, '#5574b9');
    rect(px(-6), top + 17, 4, 4, '#30314f');
    rect(px(2), top + 17, 4, 4, '#30314f');
    rect(px(-7), top + 3, 14, 7, '#efc49a');
    rect(px(-8), top, 16, 4, '#5b3b3d');
    rect(px(-7), top + 3, 6, 4, '#30314f');
    rect(px(1), top + 3, 6, 4, '#30314f');
    rect(px(-6), top + 4, 4, 2, '#86e4da');
    rect(px(2), top + 4, 4, 2, '#86e4da');
    rect(px(-1), top + 4, 2, 1, '#30314f');
    rect(px(-2), top + 8, 4, 1, '#aa4f53');
  }

  function drawHud() {
    rect(0, 0, W, 36, '#17182e');
    rect(0, 35, W, 2, '#5b456d');
    text(`SCORE ${String(score).padStart(5, '0')}`, 12, 15, COLORS.cream, 10);
    text(`COMPLIANCE ${compliance}%`, 164, 15, compliance <= 30 ? COLORS.red : COLORS.cyan, 10);
    text(`SUNSET ${sunset.toFixed(1)}s`, W - 12, 15, sunset <= 3 ? COLORS.red : COLORS.gold, 10, 'right');

    rect(12, 23, 92, 5, '#39364f');
    rect(12, 23, 92 * (compliance / 100), 5, compliance <= 30 ? COLORS.red : COLORS.cyan);
    rect(W - 104, 23, 92, 5, '#39364f');
    rect(W - 104, 23, 92 * (sunset / sunsetMax), 5, sunset <= 3 ? COLORS.red : COLORS.gold);

    const puzzle = PUZZLES[(round - 1) % PUZZLES.length];
    rect(9, 43, W - 18, 18, '#25243e');
    text(`ROUND ${String(round).padStart(2, '0')}  //  ${puzzle.clue}`, 16, 55, COLORS.cream, 9);
    if (hurdles.length) {
      text(`MIGRATION DEBT x${hurdles.length}  -  JUMP CONTROL ${Math.round(Math.max(53, 100 - hurdles.length * 12))}%`, W - 12, 73, COLORS.orange, 8, 'right');
    }
  }

  function drawTaskOverlay() {
    rect(0, 0, W, H, 'rgba(15, 16, 34, 0.82)');
    rect(44, 74, W - 88, 176, '#292943');
    rect(44, 74, W - 88, 4, COLORS.orange);
    text('MIGRATION HURDLE', W / 2, 99, COLORS.orange, 13, 'center');
    text(`SUNSET ${sunset.toFixed(1)}s`, W - 57, 99, sunset <= 3 ? COLORS.red : COLORS.gold, 8, 'right');
    if (activeTask.kind === 'type') {
      text('TYPE THE VERY IMPORTANT COMMAND:', W / 2, 124, COLORS.cream, 9, 'center');
      text(activeTask.prompt, W / 2, 149, COLORS.cyan, 14, 'center');
      const typed = activeTask.prompt.slice(0, taskProgress);
      const remaining = activeTask.prompt.slice(taskProgress);
      const totalWidth = activeTask.prompt.length * 7;
      const startX = (W - totalWidth) / 2;
      text(typed, startX, 177, COLORS.green, 12);
      text(remaining, startX + typed.length * 7, 177, COLORS.muted, 12);
      text('BACKSPACE FIXES A TYPO. ESC HIDES THIS WINDOW.', W / 2, 204, COLORS.muted, 8, 'center');
    } else {
      text('PERFORM THE COMPLIANCE DANCE:', W / 2, 124, COLORS.cream, 9, 'center');
      activeTask.prompt.forEach((direction, index) => {
        const glyph = { left: '←', right: '→', up: '↑', down: '↓' }[direction];
        const step = 28;
        const start = W / 2 - ((activeTask.prompt.length - 1) * step) / 2;
        text(glyph, start + index * step, 157, index < taskProgress ? COLORS.green : COLORS.cyan, 17, 'center');
      });
      text(`${taskProgress} / ${activeTask.prompt.length} APPROVALS`, W / 2, 183, COLORS.gold, 10, 'center');
      text('ARROW KEYS OR WASD. ESC HIDES THIS WINDOW.', W / 2, 204, COLORS.muted, 8, 'center');
    }
    if (taskMessage) text(taskMessage, W / 2, 229, COLORS.red, 8, 'center');
    text('THE SUNSET TIMER KEEPS RUNNING, OBVIOUSLY.', W / 2, 239, COLORS.orange, 8, 'center');
  }

  function drawBottomHint() {
    rect(0, H - 20, W, 20, '#17182e');
    rect(0, H - 20, W, 1, '#59476e');
    text('A / D OR ← →  MOVE', 10, H - 7, COLORS.cream, 8);
    text('SPACE  JUMP', 154, H - 7, COLORS.cream, 8);
    if (hurdles.length) {
      text('C  CLEAR HURDLE', W - 10, H - 7, COLORS.orange, 8, 'right');
    } else {
      text('COLLECT COMPLIANCE STAMPS', W - 10, H - 7, COLORS.cyan, 8, 'right');
    }
  }

  function drawMenu() {
    drawBackground();
    // Tiny scene preview.
    const demo = [
      makePlatform(128, 242, 'SOURCE', true, 0),
      makePlatform(250, 184, 'SHADOW', false, 0),
      makePlatform(348, 184, 'SINGLE SSO', true, 0),
    ];
    demo.forEach(drawPlatform);
    player = { x: 214, y: 228, facing: 1, grounded: false, walkFrame: 0 };
    drawNerd();
    rect(0, 0, W, H, 'rgba(17, 18, 38, 0.25)');
    rect(31, 39, W - 62, 207, '#20203d');
    rect(31, 39, W - 62, 4, COLORS.gold);
    text('1PLATFORMS', W / 2, 82, COLORS.cream, 25, 'center');
    text('ONE PLATFORM. MANY, MANY MIGRATIONS.', W / 2, 105, COLORS.cyan, 9, 'center');
    text('JUMP TO THE TRUE PLATFORM BEFORE SUNSET.', W / 2, 140, COLORS.cream, 10, 'center');
    text('DECOYS COST COMPLIANCE AND ADD MIGRATION DEBT.', W / 2, 158, COLORS.orange, 9, 'center');
    text('DEBT MAKES YOUR JUMPS SLOWER. CLEAR IT WITH TASKS.', W / 2, 174, COLORS.muted, 8, 'center');
    text('A / D OR ← → MOVE     SPACE JUMP     C CLEAR DEBT', W / 2, 202, COLORS.gold, 8, 'center');
    text('PRESS ENTER TO START', W / 2, 228, COLORS.green, 11, 'center');
    player = null;
  }

  function drawGameOver() {
    rect(0, 0, W, H, 'rgba(17, 18, 38, 0.78)');
    rect(47, 70, W - 94, 180, '#292943');
    rect(47, 70, W - 94, 4, COLORS.red);
    text('PLATFORM END-OF-LIFE', W / 2, 105, COLORS.red, 14, 'center');
    wrappedText(gameOverReason, W / 2, 135, W - 120, COLORS.cream, 9, 13);
    text(`SCORE ${score}     COMPLIANCE ${compliance}%`, W / 2, 165, COLORS.cyan, 11, 'center');
    text(`BEST ${bestScore}`, W / 2, 187, COLORS.gold, 10, 'center');
    text('PRESS ENTER OR R TO MIGRATE AGAIN', W / 2, 222, COLORS.green, 10, 'center');
  }

  function draw() {
    drawBackground();
    if (state === 'menu') {
      drawMenu();
      return;
    }

    platforms.forEach(drawPlatform);
    drawBadge();
    drawNerd();
    drawHud();
    if (noticeTimer > 0 && notice) {
      rect(70, 80, W - 140, 20, '#25243e');
      text(notice, W / 2, 93, notice.includes('DECOY') ? COLORS.orange : COLORS.green, 8, 'center');
    }
    drawBottomHint();

    if (activeTask) drawTaskOverlay();
    if (state === 'gameover') drawGameOver();
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
    if (key === 'c' || key === 'e') beginTask();
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
