// Fortune Cookie Ritual - auto wrapping paper version

const STATE = {
  IDLE: "IDLE",
  HOVER: "HOVER",
  GRAB: "GRAB",
  BREAK: "BREAK",
  FORTUNE: "FORTUNE",
  RESET: "RESET",
};

const FORTUNES = [
  "그 후로 나는 도착하지 않는 생각이다\n<미도착> 서윤후",
  "그건 내가 지워지는 재료로 만들어졌다는 뜻\n<미도착> 서운후",
  "매달려 있던 것들이 나를 놓아버리는 응원\n<조용히 분노하기> 서윤후",
  "나는 어디에 묻은 얼룩이라 지워지지도 않고 희박해지는 풍경 속을 헤매고 있을까\n<조용히 분노하기> 서윤후",
  "사람을 전혀 파괴하지 않고도 패배시킬 수 있는 달콤함\n<보편교양> 김기태",
  "결국 인격, 즉 사람다움은 인간의 삶에서 에피소드로 나타난다.\n<죽음을 철학하다> Steven Luper",
  "나에게 물을 주는 일도 생각해본다. 친구들과 빵을 나눠먹으며 잠시 갖는 정적, 공기 청정기 뒤쪽까지 쓱쓱 닦는 물티슈, 일기를 쓰는 10분 남짓의 시간. 자고 일어나 눈을 떴을 때 희동이 얼굴이 눈앞에 있길 바라며 침대 반대 방향으로 눕는 일\n<서윤후 시인 블로그>",
  "죽음은 우리를 어쩔 수 없게 만들고 슬픔도 그러하지만 우리가 할 수 있는 일은 그저 보이지 않는 오렌지를 나눠먹는 일.\n<26.2.7 <데카메론>보고 남긴 후기>"
];

let state = STATE.IDLE;

let videoEl;
let handsDetector;
let cookieIdleImg;
let cookieBrokenImg;

let leftHandPos = null;
let rightHandPos = null;
let leftLandmarks = null;
let rightLandmarks = null;

let cookieX, cookieY;
let glowAmount = 0;
let grabDistance = 0;
let crackProgress = 0;
let paperY = 0;
let paperOpen = 0;
let fortuneAlpha = 0;
let currentFortune = "";
let resetTimer = 0;

let shakeX = 0;
let shakeY = 0;

let particles = [];
let sparkles = [];
let paperSparkles = [];

function preload() {
  cookieIdleImg = loadImage("cookie_idle.png");
  cookieBrokenImg = loadImage("cookie_broken.png");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(window.devicePixelRatio || 2);
  textFont("Courier New");

  cookieX = width / 2;
  cookieY = height / 2;

  initMediaPipe();
}

function draw() {
  drawWebcamBackground();

  noStroke();
  fill(0, 85);
  rect(0, 0, width, height);

  if (state === STATE.BREAK) {
    shakeX = lerp(shakeX, random(-1.4, 1.4), 0.18);
    shakeY = lerp(shakeY, random(-1, 1), 0.18);
  } else {
    shakeX = lerp(shakeX, 0, 0.15);
    shakeY = lerp(shakeY, 0, 0.15);
  }

  push();
  translate(shakeX, shakeY);

  updateState();
  updateParticles();

  drawCookie();
  drawParticles();

  if (state === STATE.FORTUNE || state === STATE.RESET) {
    drawFortunePaper();
  }

  drawHandMarkers();
  pop();

  drawUI();
}

function drawWebcamBackground() {
  if (!videoEl || videoEl.readyState < 2) {
    background(0);
    return;
  }

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const scaleFactor = max(width / vw, height / vh);
  const sw = width / scaleFactor;
  const sh = height / scaleFactor;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;

  push();
  translate(width, 0);
  scale(-1, 1);
  drawingContext.drawImage(videoEl, sx, sy, sw, sh, 0, 0, width, height);
  pop();
}

function updateState() {
  const hasBothHands = leftHandPos && rightHandPos;

  const distance = hasBothHands
    ? dist(leftHandPos.x, leftHandPos.y, rightHandPos.x, rightHandPos.y)
    : 0;

  const nearCookie = (pos) =>
    pos && abs(pos.x - cookieX) < 260 && abs(pos.y - cookieY) < 220;

  const paperCX = cookieX;
  const paperCY = cookieY + paperY + 80;

  const handNearPaper = (pos) =>
    pos && dist(pos.x, pos.y, paperCX, paperCY) < 180;

  const fistNearPaper =
    (handNearPaper(leftHandPos) && isFist(leftLandmarks)) ||
    (handNearPaper(rightHandPos) && isFist(rightLandmarks));

  const openHandNearPaper =
    (handNearPaper(leftHandPos) && isOpenHand(leftLandmarks)) ||
    (handNearPaper(rightHandPos) && isOpenHand(rightLandmarks));

  switch (state) {
    case STATE.IDLE:
      glowAmount = lerp(glowAmount, 0, 0.06);

      if (hasBothHands && (nearCookie(leftHandPos) || nearCookie(rightHandPos))) {
        state = STATE.HOVER;
      }
      break;

    case STATE.HOVER:
      glowAmount = lerp(glowAmount, 1, 0.08);

      if (!hasBothHands) {
        state = STATE.IDLE;
        break;
      }

      const flanking =
        (leftHandPos.x < cookieX && rightHandPos.x > cookieX) ||
        (rightHandPos.x < cookieX && leftHandPos.x > cookieX);

      if (flanking) {
        state = STATE.GRAB;
        grabDistance = distance;
        sparkles = [];
      }
      break;

    case STATE.GRAB:
      glowAmount = lerp(glowAmount, 1.8, 0.08);

      if (!hasBothHands) {
        state = STATE.IDLE;
        grabDistance = 0;
        break;
      }

      if (frameCount % 2 === 0) {
        sparkles.push(new Sparkle(cookieX, cookieY));
      }

      if (grabDistance > 0 && distance > grabDistance * 1.45) {
        triggerBreak();
      }
      break;

    case STATE.BREAK:
      crackProgress = lerp(crackProgress, 1, 0.035);
      paperY = lerp(paperY, -50, 0.035);

      if (frameCount % 5 === 0 && crackProgress < 0.85) {
        particles.push(new CookieParticle(cookieX, cookieY));
      }

      if (crackProgress > 0.92) {
        state = STATE.FORTUNE;
      }
      break;

    case STATE.FORTUNE:
      crackProgress = lerp(crackProgress, 1, 0.06);
      paperY = lerp(paperY, -55, 0.05);

      if (fistNearPaper && frameCount % 2 === 0) {
        paperSparkles.push(new PaperSparkle(cookieX, cookieY + paperY + 80));
      }

      if (openHandNearPaper && !fistNearPaper) {
        paperOpen = lerp(paperOpen, 1, 0.07);
      }

      if (paperOpen > 0.65) {
        fortuneAlpha = lerp(fortuneAlpha, 255, 0.06);
      }

      if (fortuneAlpha > 240) {
        resetTimer++;
        if (resetTimer > 360) {
          state = STATE.RESET;
          resetTimer = 0;
        }
      }
      break;

    case STATE.RESET:
      crackProgress = lerp(crackProgress, 0, 0.04);
      paperY = lerp(paperY, 0, 0.05);
      paperOpen = lerp(paperOpen, 0, 0.06);
      fortuneAlpha = lerp(fortuneAlpha, 0, 0.06);
      glowAmount = lerp(glowAmount, 0, 0.05);

      if (crackProgress < 0.04) {
        resetScene();
      }
      break;
  }
}

function triggerBreak() {
  state = STATE.BREAK;
  crackProgress = 0;
  paperY = 0;
  paperOpen = 0;
  fortuneAlpha = 0;
  resetTimer = 0;
  currentFortune = random(FORTUNES);

  particles = [];
  sparkles = [];
  paperSparkles = [];

  for (let i = 0; i < 90; i++) {
    particles.push(new CookieParticle(cookieX, cookieY));
  }
}

function resetScene() {
  state = STATE.IDLE;
  crackProgress = 0;
  paperY = 0;
  paperOpen = 0;
  fortuneAlpha = 0;
  resetTimer = 0;

  particles = [];
  sparkles = [];
  paperSparkles = [];
}

function drawCookie() {
  imageMode(CENTER);

  if (state === STATE.IDLE || state === STATE.HOVER || state === STATE.GRAB) {
    const w = min(width * 0.42, 560);
    const h = w * (cookieIdleImg.height / cookieIdleImg.width);
    const scale = 1 + glowAmount * 0.035;

    tint(255, state === STATE.GRAB ? 255 : 235);
    image(cookieIdleImg, cookieX, cookieY, w * scale, h * scale);
    noTint();
    return;
  }

  drawBrokenCookie();
}

function drawBrokenCookie() {
  const img = cookieBrokenImg;
  const fullW = min(width * 0.62, 760);
  const fullH = fullW * (img.height / img.width);

  const p = constrain(easeOutBack(crackProgress), 0, 1.15);
  const spread = lerp(0, 150, p);
  const drop = lerp(-20, 30, p);

  tint(255, 245);

  push();
  translate(cookieX - spread, cookieY + drop);
  rotate(radians(lerp(0, -8, p)));
  image(
    img,
    0,
    0,
    fullW * 0.38,
    fullH,
    0,
    0,
    img.width * 0.38,
    img.height
  );
  pop();

  push();
  translate(cookieX + spread, cookieY + drop);
  rotate(radians(lerp(0, 8, p)));
  image(
    img,
    0,
    0,
    fullW * 0.38,
    fullH,
    img.width * 0.62,
    0,
    img.width * 0.38,
    img.height
  );
  pop();

  noTint();
}

// 핵심 수정 부분
function drawFortunePaper() {
  push();

  const cx = cookieX;
  const cy = cookieY + paperY + 80;

  translate(cx, cy);
  rectMode(CENTER);

  const fortuneTextSize = 20;
  const fortuneLeading = 30;

  textSize(fortuneTextSize);
  textLeading(fortuneLeading);

  const maxPaperW = min(width * 0.72, 560);
  const minPaperW = 130;
  const marginX = 44;
  const marginY = 34;

  const measured = measureWrappedFortune(
    currentFortune,
    maxPaperW - marginX * 2,
    fortuneTextSize,
    fortuneLeading
  );

  const targetPaperW = constrain(
    measured.maxLineWidth + marginX * 2,
    minPaperW,
    maxPaperW
  );

  const wrappedLines = wrapTextToLines(
    currentFortune,
    targetPaperW - marginX * 2
  );

  const targetPaperH = constrain(
    wrappedLines.length * fortuneLeading + marginY * 2,
    90,
    height * 0.58
  );

  const paperW = lerp(28, targetPaperW, paperOpen);
  const paperH = lerp(60, targetPaperH, paperOpen);

  noStroke();
  fill(255);
  rect(0, 0, paperW + 20, paperH + 20);

  stroke(0);
  strokeWeight(4);
  noFill();
  rect(0, 0, paperW, paperH);

  strokeWeight(2);
  rect(0, 0, max(4, paperW - 18), max(4, paperH - 18));

  if (paperOpen < 0.15) {
    noStroke();
    fill(255, 180);
    textAlign(CENTER, TOP);
    textSize(12);
    text("open your hand", 0, paperH / 2 + 18);
  }

  if (fortuneAlpha > 5) {
    noStroke();
    fill(0, fortuneAlpha);

    textAlign(CENTER, CENTER);
    textSize(fortuneTextSize);
    textLeading(fortuneLeading);

    const visibleLines = wrapTextToLines(
      currentFortune,
      paperW - marginX * 2
    );

    const totalTextH = visibleLines.length * fortuneLeading;
    let startY = -totalTextH / 2 + fortuneLeading / 2;

    for (let i = 0; i < visibleLines.length; i++) {
      text(visibleLines[i], 0, startY + i * fortuneLeading);
    }
  }

  pop();
}

function measureWrappedFortune(str, maxTextW, size, leading) {
  textSize(size);
  textLeading(leading);

  const lines = wrapTextToLines(str, maxTextW);

  let maxLineWidth = 0;
  for (let line of lines) {
    maxLineWidth = max(maxLineWidth, textWidth(line));
  }

  return {
    lines,
    maxLineWidth,
    height: lines.length * leading,
  };
}

function wrapTextToLines(str, maxTextW) {
  if (!str) return [""];

  const result = [];
  const paragraphs = str.split("\n");

  for (let paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      result.push("");
      continue;
    }

    let currentLine = "";

    for (let char of paragraph) {
      const testLine = currentLine + char;

      if (textWidth(testLine) > maxTextW && currentLine.length > 0) {
        result.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine.length > 0) {
      result.push(currentLine);
    }
  }

  return result;
}

function drawHandMarkers() {
  if (state === STATE.IDLE) return;

  [leftHandPos, rightHandPos].forEach((pos) => {
    if (!pos) return;

    noStroke();

    for (let i = 0; i < 12; i++) {
      const a = (TWO_PI / 12) * i + frameCount * 0.035;
      fill(255, 150);
      ellipse(pos.x + cos(a) * 18, pos.y + sin(a) * 18, 3, 3);
    }

    fill(255, 230);
    ellipse(pos.x, pos.y, 5, 5);
  });
}

function drawUI() {
  const messages = {
    IDLE: "hold the cookie with both hands",
    HOVER: "move hands to each side",
    GRAB: "pull apart to crack it",
    BREAK: "",
    FORTUNE: "open your hand near the paper",
    RESET: "",
  };

  const msg = messages[state];

  if (msg) {
    noStroke();
    fill(255, 150);
    textAlign(CENTER, BOTTOM);
    textSize(13);
    text(msg, width / 2, height - 32);
  }

  fill(255, 35);
  textAlign(LEFT, TOP);
  textSize(10);
  text("FORTUNE COOKIE RITUAL", 18, 18);
}

function updateParticles() {
  particles.forEach((p) => p.update());
  sparkles.forEach((s) => s.update());
  paperSparkles.forEach((p) => p.update());

  particles = particles.filter((p) => !p.isDead());
  sparkles = sparkles.filter((s) => !s.isDead());
  paperSparkles = paperSparkles.filter((p) => !p.isDead());
}

function drawParticles() {
  particles.forEach((p) => p.draw());
  sparkles.forEach((s) => s.draw());
  paperSparkles.forEach((p) => p.draw());
}

class CookieParticle {
  constructor(x, y) {
    this.x = x + random(-35, 35);
    this.y = y + random(-10, 25);
    this.vx = random(-2.2, 2.2);
    this.vy = random(-1.5, 0.6);
    this.life = random(150, 230);
    this.size = random(2, 5);
    this.rot = random(TWO_PI);
    this.rotSpeed = random(-0.08, 0.08);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.045;
    this.vx *= 0.985;
    this.rot += this.rotSpeed;
    this.life -= 2.2;
  }

  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.rot);

    noStroke();
    fill(255, this.life);
    rectMode(CENTER);
    rect(0, 0, this.size * 1.8, this.size);

    pop();
  }

  isDead() {
    return this.life <= 0;
  }
}

class Sparkle {
  constructor(x, y) {
    const a = random(TWO_PI);
    const r = random(90, 180);

    this.x = x + cos(a) * r;
    this.y = y + sin(a) * r * 0.55;
    this.life = random(100, 200);
    this.maxLife = this.life;
    this.size = random(2, 4);
    this.vy = random(-0.7, -0.1);
  }

  update() {
    this.y += this.vy;
    this.life -= 3.5;
  }

  draw() {
    const alpha = map(this.life, 0, this.maxLife, 0, 200);

    noStroke();
    fill(255, alpha);
    rectMode(CENTER);
    rect(this.x, this.y, this.size, this.size);
    rect(this.x, this.y, this.size * 3, this.size * 0.8);
    rect(this.x, this.y, this.size * 0.8, this.size * 3);
  }

  isDead() {
    return this.life <= 0;
  }
}

class PaperSparkle {
  constructor(x, y) {
    const a = random(TWO_PI);
    const r = random(35, 110);

    this.x = x + cos(a) * r;
    this.y = y + sin(a) * r * 0.5;
    this.life = random(80, 160);
    this.maxLife = this.life;
    this.size = random(2, 4);
  }

  update() {
    this.life -= 4;
  }

  draw() {
    const alpha = map(this.life, 0, this.maxLife, 0, 220);

    noStroke();
    fill(255, alpha);
    rectMode(CENTER);
    rect(this.x, this.y, this.size * 3, this.size);
    rect(this.x, this.y, this.size, this.size * 3);
  }

  isDead() {
    return this.life <= 0;
  }
}

function isFist(landmarks) {
  if (!landmarks) return false;

  const fingers = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];

  let folded = 0;

  for (const [tip, pip] of fingers) {
    if (landmarks[tip].y > landmarks[pip].y) folded++;
  }

  return folded >= 3;
}

function isOpenHand(landmarks) {
  if (!landmarks) return false;

  const fingers = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];

  let opened = 0;

  for (const [tip, pip] of fingers) {
    if (landmarks[tip].y < landmarks[pip].y) opened++;
  }

  return opened >= 3;
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * pow(x - 1, 3) + c1 * pow(x - 1, 2);
}

function initMediaPipe() {
  videoEl = document.getElementById("webcam-video");

  if (!videoEl) {
    videoEl = document.createElement("video");
    videoEl.id = "webcam-video";
    videoEl.style.display = "none";
    document.body.appendChild(videoEl);
  }

  handsDetector = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
  });

  handsDetector.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6,
  });

  handsDetector.onResults(onHandResults);

  const camera = new Camera(videoEl, {
    onFrame: async () => {
      await handsDetector.send({ image: videoEl });
    },
    width: 1280,
    height: 720,
  });

  camera.start().catch((err) => {
    console.warn("카메라 시작 실패:", err);
  });
}

function onHandResults(results) {
  leftHandPos = null;
  rightHandPos = null;
  leftLandmarks = null;
  rightLandmarks = null;

  if (!results.multiHandLandmarks) return;

  results.multiHandLandmarks.forEach((landmarks, i) => {
    const label = results.multiHandedness[i].label;
    const wrist = landmarks[0];

    const x = (1 - wrist.x) * width;
    const y = wrist.y * height;

    if (label === "Right") {
      leftHandPos = { x, y };
      leftLandmarks = landmarks;
    } else {
      rightHandPos = { x, y };
      rightLandmarks = landmarks;
    }
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cookieX = width / 2;
  cookieY = height / 2;
}