import * as THREE from 'three';
import './styles.css';

const container = document.querySelector('#game');
const scoreEl = document.querySelector('#score');
const clockEl = document.querySelector('#clock');
const resultPanel = document.querySelector('#resultPanel');
const resultText = document.querySelector('#resultText');
const breakdownEl = document.querySelector('#breakdown');
const freeModeButton = document.querySelector('#freeMode');
const scoreModeButton = document.querySelector('#scoreMode');

const rim = new THREE.Vector3(0, 3.05, -5.85);
const rimFloor = new THREE.Vector3(0, 0, -5.85);
const courtBounds = { minX: -3.75, maxX: 3.75, minZ: -5.35, maxZ: 3.35 };
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111411);
scene.fog = new THREE.Fog(0x111411, 12, 26);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
const cameraRig = {
  position: new THREE.Vector3(0, 3.08, 7.35),
  lookAt: new THREE.Vector3(0, 1.12, -0.8),
  targetPosition: new THREE.Vector3(),
  targetLookAt: new THREE.Vector3(),
  fov: 45
};

const hemi = new THREE.HemisphereLight(0xfff2d2, 0x22241f, 2.05);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xffe4a8, 2.85);
keyLight.position.set(-3.2, 7.2, 4.8);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x79ffd2, 2.2, 7.5);
rimLight.position.set(2.2, 3.4, -4.7);
scene.add(rimLight);

const materials = {
  court: new THREE.MeshStandardMaterial({
    color: 0x4a4942,
    roughness: 0.76,
    metalness: 0.03
  }),
  paint: new THREE.LineBasicMaterial({ color: 0xf4f1e8, transparent: true, opacity: 0.62 }),
  sideline: new THREE.LineBasicMaterial({ color: 0xf7be4e, transparent: true, opacity: 0.78 }),
  offense: new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.42 }),
  offenseJoint: new THREE.MeshStandardMaterial({ color: 0xf7be4e, roughness: 0.35 }),
  defense: new THREE.MeshStandardMaterial({ color: 0x8de7cb, roughness: 0.45 }),
  defenseJoint: new THREE.MeshStandardMaterial({ color: 0x243a36, roughness: 0.4 }),
  ball: new THREE.MeshStandardMaterial({ color: 0xd8772d, roughness: 0.62 }),
  black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xf16f31, roughness: 0.38 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xe6e1d1, roughness: 0.26, metalness: 0.25 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xd8f5ff,
    transparent: true,
    opacity: 0.28,
    roughness: 0.18,
    metalness: 0.02
  }),
  net: new THREE.LineBasicMaterial({ color: 0xf9f7ee, transparent: true, opacity: 0.72 }),
  shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24 }),
  glowGreen: new THREE.MeshBasicMaterial({ color: 0x96e1c8 }),
  glowGold: new THREE.MeshBasicMaterial({ color: 0xf7be4e })
};

createCourt();
createHoop();

const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 18), materials.ball);
ball.castShadow = true;
scene.add(ball);

class StickPlayer {
  constructor({ material, jointMaterial, accentMaterial }) {
    this.group = new THREE.Group();
    this.root = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.facing = 0;
    this.lean = new THREE.Vector2();
    this.ballHand = 1;
    this.phase = 0;
    this.action = 'idle';
    this.shade = 0;
    this.balance = 1;
    this.contest = 0;
    this.bite = 0;
    this.beat = 0;
    this.pivotSide = -1;
    this.material = material;
    this.jointMaterial = jointMaterial;
    this.accentMaterial = accentMaterial;
    this.parts = {
      hips: sphere(0.1, jointMaterial),
      chest: sphere(0.12, jointMaterial),
      head: sphere(0.15, jointMaterial),
      leftHand: sphere(0.08, jointMaterial),
      rightHand: sphere(0.08, jointMaterial),
      leftFoot: foot(accentMaterial),
      rightFoot: foot(accentMaterial),
      pivot: ring(accentMaterial),
      ballHand: sphere(0.045, accentMaterial),
      limbs: []
    };

    for (let i = 0; i < 10; i += 1) {
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1, 8), material);
      limb.castShadow = true;
      this.parts.limbs.push(limb);
      this.group.add(limb);
    }

    Object.values(this.parts).forEach((part) => {
      if (part instanceof THREE.Mesh) {
        part.castShadow = true;
        this.group.add(part);
      }
    });
    this.group.add(this.parts.pivot);
    scene.add(this.group);
  }

  setPosition(x, z) {
    this.root.set(x, 0, z);
    this.group.position.copy(this.root);
  }

  handWorld(side) {
    const local = this.getPose().hands[side > 0 ? 'right' : 'left'];
    return this.group.localToWorld(local.clone());
  }

  getPose() {
    const speed = Math.min(this.velocity.length(), 5);
    const stride = Math.sin(this.phase) * 0.16 * Math.min(speed / 3.2, 1);
    const cross = Math.cos(this.facing);
    const forward = Math.sin(this.facing);
    const stance = this.action === 'defense' ? 0.34 : 0.26;
    const low = this.action === 'defense' ? 0.09 : this.action === 'gather' ? -0.02 : 0;
    const rise = this.action === 'shot' ? 0.24 : 0;
    const jump = this.contest > 0 ? 0.16 * Math.sin(this.contest * Math.PI) : 0;
    const leanX = this.lean.x * 0.18 + this.shade * 0.08;
    const leanZ = this.lean.y * 0.18 - this.beat * 0.05;
    const hipY = 0.86 + low + rise + jump;
    const shoulderY = 1.48 + low + rise + jump;
    const handDrop = this.action === 'shot' ? 0.95 : this.action === 'gather' ? 0.72 : 0.45;
    const handLift = this.action === 'shot' ? 0.98 : this.contest > 0 ? 0.72 : 0;

    const hips = new THREE.Vector3(leanX * 0.34, hipY, leanZ * 0.3);
    const chest = new THREE.Vector3(leanX, shoulderY, leanZ);
    const head = new THREE.Vector3(leanX * 1.05, 1.82 + low + rise + jump, leanZ * 1.05);
    const leftHip = new THREE.Vector3(-0.19 + leanX * 0.22, hipY - 0.04, leanZ * 0.16);
    const rightHip = new THREE.Vector3(0.19 + leanX * 0.22, hipY - 0.04, leanZ * 0.16);
    const leftShoulder = new THREE.Vector3(-0.32 + leanX, shoulderY, leanZ);
    const rightShoulder = new THREE.Vector3(0.32 + leanX, shoulderY, leanZ);
    const leftFoot = new THREE.Vector3(-stance - stride * cross, 0.035, stride * forward);
    const rightFoot = new THREE.Vector3(stance + stride * cross, 0.035, -stride * forward);
    const leftKnee = leftHip.clone().lerp(leftFoot, 0.5).add(new THREE.Vector3(-0.06, -0.05, 0.05));
    const rightKnee = rightHip.clone().lerp(rightFoot, 0.5).add(new THREE.Vector3(0.06, -0.05, -0.05));
    const dribbleSide = this.ballHand;
    const offSide = -dribbleSide;
    const ballY = 0.48 + Math.abs(Math.sin(this.phase * 1.6)) * 0.36;
    const activeHand = new THREE.Vector3(
      dribbleSide * (0.34 + 0.08 * Math.sin(this.phase)),
      this.action === 'shot' ? 2.35 : this.action === 'gather' ? 1.26 : ballY + handDrop * 0.05,
      0.08 + leanZ * 0.4
    );
    const offHand = new THREE.Vector3(
      offSide * (0.44 + this.contest * 0.18),
      0.98 + handLift,
      0.02
    );

    return {
      hips,
      chest,
      head,
      shoulders: { left: leftShoulder, right: rightShoulder },
      hipsSide: { left: leftHip, right: rightHip },
      knees: { left: leftKnee, right: rightKnee },
      feet: { left: leftFoot, right: rightFoot },
      hands: dribbleSide > 0 ? { right: activeHand, left: offHand } : { left: activeHand, right: offHand }
    };
  }

  update(dt) {
    const speed = this.velocity.length();
    this.phase += dt * (5.2 + speed * 1.2);
    this.contest = Math.max(0, this.contest - dt * 1.7);
    this.bite = Math.max(0, this.bite - dt * 2.8);
    this.beat = Math.max(0, this.beat - dt * 1.35);

    if (speed > 0.04) {
      const targetFacing = Math.atan2(this.velocity.z, this.velocity.x);
      this.facing = lerpAngle(this.facing, targetFacing, 1 - Math.exp(-dt * 8));
      this.lean.set(this.velocity.x / 4.8, this.velocity.z / 4.8);
    } else {
      this.lean.multiplyScalar(Math.exp(-dt * 5));
    }

    this.group.position.copy(this.root);
    const pose = this.getPose();
    this.parts.hips.position.copy(pose.hips);
    this.parts.chest.position.copy(pose.chest);
    this.parts.head.position.copy(pose.head);
    this.parts.leftHand.position.copy(pose.hands.left);
    this.parts.rightHand.position.copy(pose.hands.right);
    this.parts.leftFoot.position.copy(pose.feet.left);
    this.parts.rightFoot.position.copy(pose.feet.right);
    this.parts.ballHand.position.copy(this.ballHand > 0 ? pose.hands.right : pose.hands.left);
    this.parts.pivot.visible = game.state === 'stop' || game.state === 'contact' || game.state === 'shotFake';
    this.parts.pivot.position.copy(this.pivotSide > 0 ? pose.feet.right : pose.feet.left);
    this.parts.pivot.position.y = 0.025;

    const limbs = this.parts.limbs;
    placeLimb(limbs[0], pose.hips, pose.chest, 0.045);
    placeLimb(limbs[1], pose.chest, pose.head, 0.04);
    placeLimb(limbs[2], pose.shoulders.left, pose.hands.left, 0.035);
    placeLimb(limbs[3], pose.shoulders.right, pose.hands.right, 0.035);
    placeLimb(limbs[4], pose.hipsSide.left, pose.knees.left, 0.04);
    placeLimb(limbs[5], pose.knees.left, pose.feet.left, 0.038);
    placeLimb(limbs[6], pose.hipsSide.right, pose.knees.right, 0.04);
    placeLimb(limbs[7], pose.knees.right, pose.feet.right, 0.038);
    placeLimb(limbs[8], pose.shoulders.left, pose.shoulders.right, 0.035);
    placeLimb(limbs[9], pose.hipsSide.left, pose.hipsSide.right, 0.035);
  }
}

const offense = new StickPlayer({
  material: materials.offense,
  jointMaterial: materials.offense,
  accentMaterial: materials.glowGold
});
const defense = new StickPlayer({
  material: materials.defense,
  jointMaterial: materials.defense,
  accentMaterial: materials.glowGreen
});

const shadows = {
  offense: makeShadow(),
  defense: makeShadow(),
  ball: makeShadow(0.32)
};

const game = {
  mode: 'free',
  userScore: 0,
  aiScore: 0,
  targetScore: 7,
  state: 'check',
  stateTime: 0,
  shotClock: 12,
  resultHold: 0,
  resetTimer: 0,
  possession: 0,
  balance: 0.86,
  fatigue: 0,
  gatherQuality: 0.75,
  releaseRhythm: 0.7,
  lastMove: 'check',
  lastMoveTime: 5,
  move: null,
  defenderState: 'Neutral',
  defenderDelay: 0.24,
  defenderSamples: [],
  defenderReactTimer: 0,
  defenderShade: 0,
  defenderWrongWay: 0,
  defenderBite: 0,
  defenderContest: 0,
  defenderCrowd: 0,
  shot: null,
  replay: null,
  feedback: null
};

const input = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
  lastX: 0,
  lastY: 0,
  startTime: 0,
  lastTime: 0,
  pressure: 0,
  worldDir: new THREE.Vector3(),
  velocity: new THREE.Vector2(),
  recentFlickAt: 0,
  totalDistance: 0
};

const audio = createAudioEngine();
const clock = new THREE.Clock();

resetPossession(true);
resize();
window.addEventListener('resize', resize);
renderer.domElement.addEventListener('pointerdown', onPointerDown);
renderer.domElement.addEventListener('pointermove', onPointerMove);
renderer.domElement.addEventListener('pointerup', onPointerUp);
renderer.domElement.addEventListener('pointercancel', onPointerUp);
freeModeButton.addEventListener('click', () => setMode('free'));
scoreModeButton.addEventListener('click', () => setMode('score'));

requestAnimationFrame(loop);

function loop() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function update(dt) {
  game.stateTime += dt;
  game.lastMoveTime += dt;

  if (game.mode === 'score' && !['shot', 'finish', 'check'].includes(game.state)) {
    game.shotClock = Math.max(0, game.shotClock - dt);
    if (game.shotClock <= 0) {
      resolveDeadPossession('Clock', 'late', true);
    }
  }

  if (game.resultHold > 0) {
    game.resultHold = Math.max(0, game.resultHold - dt);
    if (game.resultHold === 0) resultPanel.classList.add('hidden');
  }

  updateOffense(dt);
  updateDefender(dt);
  updateAdvantage(dt);
  updateShot(dt);
  updateResetTimer(dt);
  offense.update(dt);
  defense.update(dt);
  updateBall();
  updateCamera(dt);
  updateUI();
}

function updateOffense(dt) {
  if (game.state === 'shot' || game.state === 'finish') {
    offense.velocity.multiplyScalar(Math.exp(-dt * 8));
    return;
  }

  if (game.state === 'check' && game.stateTime > 0.45) {
    setState('tripleThreat');
  }

  let desired = tmpA.set(0, 0, 0);
  const canMove = ['tripleThreat', 'probe', 'attack', 'retreat', 'sizeup', 'stop', 'contact'].includes(
    game.state
  );

  if (input.active && canMove) {
    if (input.pressure < 0.12) {
      setState(game.state === 'contact' ? 'contact' : 'sizeup');
      game.balance = clamp01(game.balance + dt * 0.28);
      desired.set(0, 0, 0);
    } else {
      const forward = input.worldDir.z < -0.28;
      const backward = input.worldDir.z > 0.28;
      const speed = 0.85 + input.pressure * 3.95;
      desired.copy(input.worldDir).multiplyScalar(speed);
      if (forward && input.pressure > 0.62) setState('attack');
      else if (backward) setState('retreat');
      else setState('probe');
      game.balance = clamp01(game.balance - dt * (0.05 + input.pressure * 0.08));
      game.fatigue = clamp01(game.fatigue + dt * input.pressure * 0.028);
    }
  } else {
    game.balance = clamp01(game.balance + dt * 0.18);
  }

  if (game.move) {
    applyMove(dt, desired);
  }

  const defenderGap = flatDistance(offense.root, defense.root);
  const driveIntoDefender = defenderGap < 0.72 && offense.velocity.z < -0.25 && defense.root.z < offense.root.z;
  if (driveIntoDefender && !game.move && game.state !== 'contact') {
    startBumpStop();
  }

  const blend = 1 - Math.exp(-dt * (game.state === 'contact' ? 7 : 10));
  offense.velocity.lerp(desired, blend);
  offense.root.addScaledVector(offense.velocity, dt);
  clampPlayer(offense.root);

  if (!input.active && !game.move && offense.velocity.length() < 0.2 && game.state !== 'check') {
    setState('stop');
  }
}

function applyMove(dt, desired) {
  const move = game.move;
  move.t += dt;
  const p = clamp01(move.t / move.duration);
  const ease = Math.sin(p * Math.PI);
  if (move.kind === 'cross') {
    desired.x += move.dir.x * (3.7 * ease + 0.8);
    desired.z += move.forward * 1.15 * ease;
    game.balance = clamp01(game.balance - dt * 0.04 + (p > 0.45 ? dt * 0.08 : 0));
  } else if (move.kind === 'snatchback') {
    desired.z += 3.6 * ease + 0.75;
    desired.x += move.dir.x * 0.9 * ease;
    game.balance = clamp01(game.balance + dt * 0.16);
  } else if (move.kind === 'stepback') {
    desired.z += 3.95 * ease + 1;
    desired.x += move.dir.x * 1.6 * ease;
    game.balance = clamp01(game.balance + dt * 0.22);
  } else if (move.kind === 'hesi') {
    desired.z += -0.45 * ease;
    desired.x += move.dir.x * 0.25;
    game.balance = clamp01(game.balance + dt * 0.2);
  }

  if (p > 0.38 && !move.handChanged) {
    if (move.kind === 'cross') offense.ballHand *= -1;
    move.handChanged = true;
  }

  if (p >= 1) {
    finishMove(move.kind);
    game.move = null;
  }
}

function finishMove(kind) {
  game.lastMove = kind;
  game.lastMoveTime = 0;
  if (kind === 'snatchback' || kind === 'stepback') {
    setState('stop');
    offense.pivotSide = offense.ballHand;
  } else {
    setState('probe');
  }
}

function updateDefender(dt) {
  game.defenderSamples.push({
    age: 0,
    pos: offense.root.clone(),
    vel: offense.velocity.clone(),
    hand: offense.ballHand
  });
  game.defenderSamples.forEach((sample) => {
    sample.age += dt;
  });
  while (game.defenderSamples.length > 50 && game.defenderSamples[0].age > 1.1) {
    game.defenderSamples.shift();
  }

  const delayed =
    game.defenderSamples.find((sample) => sample.age >= game.defenderDelay) ||
    game.defenderSamples[game.defenderSamples.length - 1];

  game.defenderReactTimer -= dt;
  if (game.defenderReactTimer <= 0) {
    const ballSide = delayed?.hand || offense.ballHand;
    const courtSide = Math.sign(offense.root.x);
    game.defenderShade = clamp(ballSide * 0.65 + courtSide * 0.25, -1, 1);
    game.defenderReactTimer = 0.34 + Math.random() * 0.15;
  }

  game.defenderWrongWay = Math.max(0, game.defenderWrongWay - dt);
  game.defenderBite = Math.max(0, game.defenderBite - dt);
  game.defenderContest = Math.max(0, game.defenderContest - dt);

  const samplePos = delayed?.pos || offense.root;
  const sampleVel = delayed?.vel || offense.velocity;
  const toRim = tmpA.copy(rimFloor).sub(samplePos).normalize();
  const ideal = tmpB.copy(samplePos).addScaledVector(toRim, 0.94);
  ideal.x += game.defenderShade * 0.18;

  let maxSpeed = 3.75;
  game.defenderState = 'Neutral';
  if (flatDistance(offense.root, defense.root) < 0.72) {
    game.defenderCrowd = clamp01(game.defenderCrowd + dt * 1.4);
    game.defenderState = 'Crowd';
  } else {
    game.defenderCrowd = clamp01(game.defenderCrowd - dt * 1.2);
  }

  if (game.defenderWrongWay > 0) {
    ideal.x -= Math.sign(offense.root.x - defense.root.x || game.defenderShade || 1) * 0.85;
    ideal.z -= 0.22;
    maxSpeed = 1.8;
    game.defenderState = 'Beat';
  }

  if (game.defenderBite > 0) {
    ideal.z -= 0.42;
    maxSpeed = 1.25;
    game.defenderState = 'Bite';
    defense.bite = Math.max(defense.bite, game.defenderBite);
  }

  if (game.defenderContest > 0) {
    ideal.copy(offense.root).addScaledVector(toRim, 0.55);
    maxSpeed = 4.4;
    game.defenderState = 'Contest';
    defense.contest = Math.max(defense.contest, game.defenderContest);
  } else if (Math.abs(game.defenderShade) > 0.42) {
    game.defenderState = game.defenderShade > 0 ? 'Shade Right' : 'Shade Left';
  }

  const desired = ideal.sub(defense.root);
  const distance = desired.length();
  if (distance > 0.001) {
    desired.normalize().multiplyScalar(Math.min(maxSpeed, distance / Math.max(dt, 0.001)));
  }
  defense.velocity.lerp(desired, 1 - Math.exp(-dt * 5.5));

  if (sampleVel.length() > 3.2 && game.defenderWrongWay <= 0) {
    defense.velocity.addScaledVector(sampleVel, 0.05);
  }

  defense.root.addScaledVector(defense.velocity, dt);
  clampPlayer(defense.root);
  defense.shade = game.defenderShade;
  defense.action = game.defenderContest > 0 ? 'shot' : 'defense';
  defense.ballHand = offense.ballHand;
  defense.beat = Math.max(defense.beat, game.defenderWrongWay);
}

function updateAdvantage(dt) {
  const sep = flatDistance(offense.root, defense.root);
  const speed = offense.velocity.length();
  const facingMismatch = clamp01(game.defenderWrongWay / 0.55);
  const space = smoothstep(0.72, 2.1, sep);
  const underControl = clamp01(game.balance - speed * 0.045);
  game.gatherQuality = clamp01(underControl * 0.62 + space * 0.18 + facingMismatch * 0.2);

  const rhythmAge = game.lastMoveTime;
  const rhythmWindow = 1 - clamp01(Math.abs(rhythmAge - 0.44) / 0.85);
  const dribbleWindow = 1 - clamp01(Math.abs(Math.sin(offense.phase * 1.6)) * 0.72);
  game.releaseRhythm = clamp01(0.35 + rhythmWindow * 0.43 + dribbleWindow * 0.22);
  if (speed > 4.1) game.releaseRhythm *= 0.82;
  if (dt > 0) game.fatigue = clamp01(game.fatigue + dt * 0.006);
}

function updateShot(dt) {
  if (!game.shot) return;
  const shot = game.shot;
  shot.t += dt;
  const releaseDelay = 0.22;

  if (shot.t < releaseDelay) {
    offense.action = 'gather';
    ball.position.copy(offense.handWorld(offense.ballHand));
    return;
  }

  offense.action = 'shot';
  const p = clamp01((shot.t - releaseDelay) / shot.flight);
  const arc = Math.sin(Math.PI * p) * shot.arc;
  ball.position.lerpVectors(shot.start, shot.end, easeInOut(p));
  ball.position.y += arc;

  if (!shot.audioPlayed && p >= shot.impactAt) {
    shot.audioPlayed = true;
    audio.playResult(shot.outcome);
    showFeedback(shot);
    applyScore(shot);
  }

  if (p >= 1 && !shot.fell) {
    shot.fell = true;
    if (shot.made) {
      ball.position.set(rim.x + shot.dropX, 2.48, rim.z + 0.02);
    }
  }

  if (shot.t > releaseDelay + shot.flight + shot.hold) {
    game.shot = null;
    setState('finish');
    game.resetTimer = shot.outcome === 'cookedSwish' ? 1.35 : 0.72;
  }
}

function updateResetTimer(dt) {
  if (game.shot || game.resetTimer <= 0) return;
  game.resetTimer -= dt;
  if (game.resetTimer <= 0) resetPossession(false);
}

function updateBall() {
  if (game.shot) {
    shadows.ball.position.set(ball.position.x, 0.012, ball.position.z);
    shadows.ball.scale.setScalar(clamp(0.3 - ball.position.y * 0.04, 0.12, 0.3));
    return;
  }

  const hand = offense.handWorld(offense.ballHand);
  const bounce = Math.abs(Math.sin(offense.phase * 1.6));
  const stateLift = game.state === 'sizeup' ? 0.08 : 0;
  ball.position.set(
    hand.x,
    game.state === 'check' || game.state === 'tripleThreat' ? 0.76 + stateLift : 0.28 + bounce * 0.5,
    hand.z + 0.03
  );
  shadows.ball.position.set(ball.position.x, 0.012, ball.position.z);
  shadows.ball.scale.setScalar(0.26);
}

function updateCamera(dt) {
  const midpoint = tmpA.copy(offense.root).lerp(defense.root, 0.5);
  const sep = flatDistance(offense.root, defense.root);
  const burst = game.state === 'attack' ? 1 : 0;
  const gather = game.state === 'stop' || game.state === 'shot' ? 1 : 0;
  const shot = game.shot ? 1 : 0;

  cameraRig.targetLookAt.set(
    midpoint.x * 0.52,
    1.1 + gather * 0.12,
    THREE.MathUtils.lerp(midpoint.z, -2.2, 0.56 + shot * 0.16)
  );
  cameraRig.targetPosition.set(
    midpoint.x * 0.38,
    3.05 + burst * 0.18 - gather * 0.1,
    7.25 + burst * 0.72 - gather * 0.32 + sep * 0.08
  );

  if (game.shot) {
    cameraRig.targetLookAt.lerp(rim, 0.34);
    cameraRig.targetPosition.z = 7.15;
    cameraRig.targetPosition.y = 3.22;
  }

  if (game.replay && game.replay > 0) {
    game.replay -= dt;
    cameraRig.targetPosition.set(-3.45, 2.1, 2.15);
    cameraRig.targetLookAt.copy(offense.root).lerp(rimFloor, 0.5).setY(1.28);
  }

  cameraRig.fov = THREE.MathUtils.lerp(cameraRig.fov, 49 + burst * 4 - gather * 2, 1 - Math.exp(-dt * 3));
  camera.fov = cameraRig.fov;
  camera.updateProjectionMatrix();
  cameraRig.position.lerp(cameraRig.targetPosition, 1 - Math.exp(-dt * 4.6));
  cameraRig.lookAt.lerp(cameraRig.targetLookAt, 1 - Math.exp(-dt * 5.4));
  camera.position.copy(cameraRig.position);
  camera.lookAt(cameraRig.lookAt);

  shadows.offense.position.set(offense.root.x, 0.014, offense.root.z);
  shadows.defense.position.set(defense.root.x, 0.014, defense.root.z);
}

function onPointerDown(event) {
  if (event.clientY < window.innerHeight * 0.34 || input.active) return;
  audio.unlock();
  renderer.domElement.setPointerCapture(event.pointerId);
  input.active = true;
  input.pointerId = event.pointerId;
  input.startX = event.clientX;
  input.startY = event.clientY;
  input.x = event.clientX;
  input.y = event.clientY;
  input.lastX = event.clientX;
  input.lastY = event.clientY;
  input.startTime = performance.now();
  input.lastTime = input.startTime;
  input.pressure = 0;
  input.velocity.set(0, 0);
  input.totalDistance = 0;
  if (game.state === 'check') setState('tripleThreat');
}

function onPointerMove(event) {
  if (!input.active || event.pointerId !== input.pointerId) return;
  const now = performance.now();
  const dt = Math.max(16, now - input.lastTime) / 1000;
  const dx = event.clientX - input.lastX;
  const dy = event.clientY - input.lastY;
  input.totalDistance += Math.hypot(dx, dy);
  input.velocity.set(dx / dt, dy / dt);
  input.x = event.clientX;
  input.y = event.clientY;
  input.lastX = event.clientX;
  input.lastY = event.clientY;
  input.lastTime = now;

  const dragX = input.x - input.startX;
  const dragY = input.y - input.startY;
  const drag = Math.hypot(dragX, dragY);
  input.pressure = clamp01(drag / 145);
  if (drag > 3) {
    input.worldDir.set(dragX, 0, dragY).normalize();
  }

  const flickSpeed = input.velocity.length();
  if (flickSpeed > 900 && now - input.recentFlickAt > 170 && game.state !== 'shot') {
    input.recentFlickAt = now;
    interpretFlick(input.velocity.x, input.velocity.y, flickSpeed);
  }
}

function onPointerUp(event) {
  if (!input.active || event.pointerId !== input.pointerId) return;
  renderer.domElement.releasePointerCapture(event.pointerId);
  const heldMs = performance.now() - input.startTime;
  input.active = false;
  input.pointerId = null;
  input.pressure = 0;

  if (['shot', 'finish', 'check'].includes(game.state)) return;
  if (heldMs < 190 && input.totalDistance < 28) {
    startShotFake();
    return;
  }
  if (game.state === 'contact' && heldMs < 420) {
    startShotFake();
    return;
  }
  startShot();
}

function interpretFlick(vx, vy, speed) {
  const dir = tmpA.set(vx, 0, vy).normalize();
  const lateral = Math.abs(dir.x) > Math.abs(dir.z) * 1.08;
  const crowd = flatDistance(offense.root, defense.root) < 1.05;
  const defenderOverplays =
    Math.sign(game.defenderShade || offense.ballHand) === Math.sign(dir.x || offense.ballHand);

  if (dir.z > 0.54) {
    startMove(Math.abs(dir.x) > 0.35 || offense.velocity.length() > 2.4 ? 'stepback' : 'snatchback', dir);
  } else if (dir.z < -0.62) {
    if (crowd && game.balance > 0.5) startMove('hesi', dir);
    else {
      setState('attack');
      offense.velocity.z -= Math.min(1.6, speed / 820);
      game.balance = clamp01(game.balance - 0.08);
    }
  } else if (lateral) {
    if (crowd && defenderOverplays && game.balance < 0.56) {
      startMove('snatchback', dir);
    } else {
      startMove('cross', dir);
    }
  }
}

function startMove(kind, dir) {
  if (game.state === 'shot' || game.state === 'finish') return;
  const canInterrupt =
    !game.move || game.move.t / game.move.duration > 0.32 || kind === 'snatchback' || kind === 'stepback';
  if (!canInterrupt) return;

  const durations = { cross: 0.34, snatchback: 0.42, stepback: 0.48, hesi: 0.32 };
  const x = Math.sign(dir.x || -offense.ballHand || 1);
  game.move = {
    kind,
    t: 0,
    duration: durations[kind],
    dir: new THREE.Vector3(x, 0, dir.z),
    forward: kind === 'cross' && dir.z < 0 ? -0.35 : 0.1,
    handChanged: false
  };

  game.lastMove = kind;
  game.lastMoveTime = 0;
  setState(kind === 'snatchback' || kind === 'stepback' ? 'retreat' : 'probe');

  const wrongFootChance =
    kind === 'hesi' ? 0.46 : kind === 'cross' ? 0.38 : kind === 'snatchback' ? 0.54 : 0.58;
  const contextBoost = game.defenderCrowd * 0.22 + (game.balance > 0.58 ? 0.08 : -0.05);
  if (Math.random() < wrongFootChance + contextBoost) {
    game.defenderWrongWay = kind === 'cross' ? 0.34 : 0.52;
  }
  if (kind === 'snatchback' || kind === 'stepback' || kind === 'hesi') {
    game.defenderBite = Math.max(game.defenderBite, kind === 'hesi' ? 0.28 : 0.18);
  }
}

function startBumpStop() {
  setState('contact');
  offense.velocity.multiplyScalar(0.42);
  game.balance = clamp01(game.balance + 0.14);
  game.defenderBite = Math.max(game.defenderBite, 0.16);
  offense.pivotSide = offense.ballHand;
}

function startShotFake() {
  setState('shotFake');
  offense.action = 'gather';
  game.balance = clamp01(game.balance + 0.08);
  game.lastMove = 'shotFake';
  game.lastMoveTime = 0;
  const biteChance = 0.48 + game.defenderCrowd * 0.35 + game.gatherQuality * 0.12;
  if (Math.random() < biteChance) {
    game.defenderBite = 0.58;
    game.defenderWrongWay = Math.max(game.defenderWrongWay, 0.24);
  }
  window.setTimeout(() => {
    if (game.state === 'shotFake') setState('stop');
  }, 360);
}

function startShot() {
  const metrics = shotMetrics();
  const madeRoll = metrics.quality + (Math.random() - 0.5) * 0.12;
  let outcome = 'miss';
  if (madeRoll > 0.88 && metrics.cooked) outcome = 'cookedSwish';
  else if (madeRoll > 0.78) outcome = 'pureSwish';
  else if (madeRoll > 0.65) outcome = 'cleanMake';
  else if (madeRoll > 0.5) outcome = 'rimMake';

  const made = outcome !== 'miss';
  const lateContest = metrics.contest < 0.42 || game.defenderWrongWay > 0.16;
  if (lateContest) game.defenderContest = Math.max(game.defenderContest, 0.28);
  else game.defenderContest = Math.max(game.defenderContest, 0.58);

  setState('shot');
  offense.velocity.multiplyScalar(0.28);
  const start = offense.handWorld(offense.ballHand);
  start.y = 2.25;
  const missX = made ? 0 : (Math.random() > 0.5 ? 1 : -1) * THREE.MathUtils.lerp(0.28, 0.66, 1 - metrics.quality);
  const end = new THREE.Vector3(rim.x + missX, made ? 2.72 : 3.0, rim.z + (made ? 0.02 : -0.05));
  const arc = THREE.MathUtils.lerp(1.05, 1.58, clamp01(flatDistance(offense.root, rimFloor) / 8));

  game.shot = {
    t: 0,
    start,
    end,
    arc,
    flight: 0.86,
    impactAt: made ? 0.88 : 0.82,
    hold: outcome === 'cookedSwish' ? 1.1 : 0.72,
    outcome,
    made,
    metrics,
    audioPlayed: false,
    fell: false,
    scored: false,
    dropX: made ? (Math.random() - 0.5) * 0.04 : 0
  };

  if (outcome === 'cookedSwish') game.replay = 1.45;
  audio.playAir(metrics.quality);
}

function shotMetrics() {
  const sep = flatDistance(offense.root, defense.root);
  const separation = smoothstep(0.78, 2.12, sep);
  const wrongWay = clamp01(game.defenderWrongWay / 0.55);
  const contest = clamp01((1 - separation) * 0.78 + game.defenderContest * 0.22 - wrongWay * 0.35);
  const balance = clamp01(game.balance - offense.velocity.length() * 0.035);
  const gather = clamp01(game.gatherQuality + (game.lastMove === 'stepback' ? 0.08 : 0));
  const release = game.releaseRhythm;
  const fatigue = game.fatigue;
  const quality = clamp01(
    separation * 0.28 +
      balance * 0.23 +
      gather * 0.2 +
      release * 0.2 +
      wrongWay * 0.1 -
      contest * 0.22 -
      fatigue * 0.12
  );
  const cooked =
    wrongWay > 0.32 &&
    separation > 0.55 &&
    balance > 0.58 &&
    release > 0.56 &&
    ['cross', 'snatchback', 'stepback', 'hesi'].includes(game.lastMove);
  return { sep, separation, wrongWay, contest, balance, gather, release, fatigue, quality, cooked };
}

function applyScore(shot) {
  if (shot.scored) return;
  shot.scored = true;
  if (game.mode === 'score') {
    if (shot.made) {
      const points = flatDistance(offense.root, rimFloor) > 6.0 ? 2 : 1;
      game.userScore = Math.min(game.targetScore, game.userScore + points);
    } else {
      game.aiScore = Math.min(game.targetScore, game.aiScore + 1);
    }
  }
}

function resolveDeadPossession(label, result, defenderPoint) {
  const metrics = {
    separation: 0,
    balance: game.balance,
    release: 0,
    contest: 1,
    quality: 0,
    gather: game.gatherQuality
  };
  if (defenderPoint && game.mode === 'score') {
    game.aiScore = Math.min(game.targetScore, game.aiScore + 1);
  }
  showFeedback({ outcome: 'miss', metrics, deadLabel: label, deadResult: result });
  audio.playResult('miss');
  setState('finish');
  game.resetTimer = 0.8;
}

function showFeedback(shot) {
  const label = shot.deadLabel || outcomeLabel(shot.outcome);
  resultText.textContent = label;
  const metrics = shot.metrics;
  const rows = [
    ['Separation', grade(metrics.separation ?? 0)],
    ['Balance', grade(metrics.balance ?? 0)],
    ['Release', grade(metrics.release ?? 0)],
    ['Contest', contestGrade(metrics.contest ?? 1)],
    ['Result', shot.deadResult || outcomeLabel(shot.outcome)]
  ];
  breakdownEl.innerHTML = rows
    .map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`)
    .join('');
  resultPanel.classList.remove('hidden');
  game.resultHold = shot.outcome === 'cookedSwish' ? 2.3 : 1.75;
}

function outcomeLabel(outcome) {
  return {
    miss: 'Miss',
    rimMake: 'Rim Make',
    cleanMake: 'Clean Make',
    pureSwish: 'Pure Swish',
    cookedSwish: 'Cooked Swish'
  }[outcome];
}

function grade(value) {
  if (value >= 0.78) return 'excellent';
  if (value >= 0.58) return 'clean';
  if (value >= 0.38) return 'okay';
  return 'poor';
}

function contestGrade(value) {
  if (value <= 0.24) return 'late';
  if (value <= 0.48) return 'soft';
  if (value <= 0.68) return 'there';
  return 'heavy';
}

function setMode(mode) {
  game.mode = mode;
  freeModeButton.classList.toggle('active', mode === 'free');
  scoreModeButton.classList.toggle('active', mode === 'score');
  game.userScore = 0;
  game.aiScore = 0;
  resetPossession(true);
}

function resetPossession(initial) {
  offense.setPosition(0, 2.38);
  defense.setPosition(0, 0.92);
  offense.velocity.set(0, 0, 0);
  defense.velocity.set(0, 0, 0);
  offense.ballHand = Math.random() > 0.5 ? 1 : -1;
  offense.action = 'idle';
  defense.action = 'defense';
  game.state = 'check';
  game.stateTime = 0;
  game.shotClock = 12;
  game.balance = 0.88;
  game.fatigue = 0;
  game.move = null;
  game.shot = null;
  game.replay = null;
  game.defenderSamples.length = 0;
  game.defenderWrongWay = 0;
  game.defenderBite = 0;
  game.defenderContest = 0;
  game.defenderCrowd = 0;
  game.lastMove = initial ? 'check' : 'reset';
  game.lastMoveTime = 2;
  input.active = false;
  if (game.mode === 'score' && (game.userScore >= game.targetScore || game.aiScore >= game.targetScore)) {
    resultText.textContent = game.userScore >= game.targetScore ? 'Game' : 'Clamped';
    breakdownEl.innerHTML = '';
    resultPanel.classList.remove('hidden');
    game.resultHold = 2.2;
    game.userScore = 0;
    game.aiScore = 0;
  }
}

function setState(state) {
  if (game.state === state) return;
  game.state = state;
  game.stateTime = 0;
  if (state === 'attack' || state === 'probe' || state === 'retreat' || state === 'sizeup') {
    offense.action = 'idle';
  }
  if (state === 'stop' || state === 'contact') {
    offense.pivotSide = offense.ballHand;
  }
}

function updateUI() {
  scoreEl.textContent = game.mode === 'score' ? `${game.userScore} - ${game.aiScore}` : '0 - 0';
  clockEl.textContent = game.mode === 'score' ? game.shotClock.toFixed(1) : 'FREE';
}

function resize() {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function createCourt() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 11.4), materials.court);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -1.05;
  floor.receiveShadow = true;
  scene.add(floor);

  const gritty = new THREE.GridHelper(8.2, 18, 0x464844, 0x252724);
  gritty.position.set(0, 0.018, -1.05);
  gritty.material.transparent = true;
  gritty.material.opacity = 0.22;
  scene.add(gritty);

  lineRect(-3.7, -6.5, 3.7, 3.7, materials.sideline);
  lineRect(-1.9, -5.85, 1.9, -2.2, materials.paint);
  lineArc(0, -5.85, 4.35, Math.PI * 0.1, Math.PI * 0.9, materials.paint);
  lineArc(0, -5.85, 1.25, Math.PI * 0.12, Math.PI * 0.88, materials.paint);
  lineSegment(-2.35, 3.05, 2.35, 3.05, materials.paint);

  const logo = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 0.82, 64),
    new THREE.MeshBasicMaterial({ color: 0xf7be4e, transparent: true, opacity: 0.17 })
  );
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(0, 0.024, 0.45);
  scene.add(logo);
}

function createHoop() {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.1, 16), materials.metal);
  pole.position.set(0, 1.55, -6.65);
  pole.castShadow = true;
  scene.add(pole);

  const board = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.92, 0.05), materials.glass);
  board.position.set(0, 3.24, -6.36);
  board.castShadow = true;
  scene.add(board);

  const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 10, 44), materials.rim);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.copy(rim);
  rimMesh.castShadow = true;
  scene.add(rimMesh);

  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const top = new THREE.Vector3(Math.cos(a) * 0.22, 3.02, rim.z + Math.sin(a) * 0.22);
    const bottom = new THREE.Vector3(Math.cos(a + 0.22) * 0.12, 2.52, rim.z + Math.sin(a + 0.22) * 0.12);
    const geo = new THREE.BufferGeometry().setFromPoints([top, bottom]);
    scene.add(new THREE.Line(geo, materials.net));
  }
}

function lineRect(x1, z1, x2, z2, material) {
  const pts = [
    new THREE.Vector3(x1, 0.035, z1),
    new THREE.Vector3(x2, 0.035, z1),
    new THREE.Vector3(x2, 0.035, z2),
    new THREE.Vector3(x1, 0.035, z2),
    new THREE.Vector3(x1, 0.035, z1)
  ];
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material));
}

function lineSegment(x1, z1, x2, z2, material) {
  const pts = [new THREE.Vector3(x1, 0.035, z1), new THREE.Vector3(x2, 0.035, z2)];
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material));
}

function lineArc(cx, cz, r, start, end, material) {
  const pts = [];
  for (let i = 0; i <= 48; i += 1) {
    const a = THREE.MathUtils.lerp(start, end, i / 48);
    pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 0.035, cz + Math.sin(a) * r));
  }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material));
}

function makeShadow(size = 0.68) {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(size, 32), materials.shadow);
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  return shadow;
}

function sphere(radius, material) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material);
}

function foot(material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.16), material);
  mesh.castShadow = true;
  return mesh;
}

function ring(material) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.22, 28), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return mesh;
}

function placeLimb(mesh, a, b, radius) {
  tmpB.copy(b).sub(a);
  const len = tmpB.length();
  mesh.position.copy(a).addScaledVector(tmpB, 0.5);
  mesh.scale.set(radius / 0.04, len, radius / 0.04);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpB.normalize());
}

function clampPlayer(pos) {
  pos.x = clamp(pos.x, courtBounds.minX, courtBounds.maxX);
  pos.z = clamp(pos.z, courtBounds.minZ, courtBounds.maxZ);
  pos.y = 0;
}

function flatDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function smoothstep(edge0, edge1, value) {
  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function easeInOut(value) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
}

function lerpAngle(a, b, t) {
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + delta * t;
}

function createAudioEngine() {
  let ctx;

  function ensure() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!ctx) ctx = new AudioCtor();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noise(duration, filterFreq, gain, when = 0, type = 'highpass') {
    const ac = ensure();
    const buffer = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0.0001, ac.currentTime + when);
    amp.gain.exponentialRampToValueAtTime(gain, ac.currentTime + when + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + when + duration);
    src.connect(filter).connect(amp).connect(ac.destination);
    src.start(ac.currentTime + when);
  }

  function tone(freq, duration, gain, when = 0, type = 'sine') {
    const ac = ensure();
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, ac.currentTime + when);
    amp.gain.exponentialRampToValueAtTime(gain, ac.currentTime + when + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + when + duration);
    osc.connect(amp).connect(ac.destination);
    osc.start(ac.currentTime + when);
    osc.stop(ac.currentTime + when + duration + 0.04);
  }

  return {
    unlock: ensure,
    playAir(quality) {
      noise(0.22, 2400, 0.012 + quality * 0.012, 0, 'highpass');
    },
    playResult(outcome) {
      if (outcome === 'miss') {
        tone(138, 0.16, 0.08, 0, 'square');
        tone(92, 0.2, 0.05, 0.035, 'sawtooth');
        noise(0.18, 900, 0.05, 0.01, 'bandpass');
      } else if (outcome === 'rimMake') {
        tone(172, 0.08, 0.045, 0, 'square');
        noise(0.18, 2600, 0.045, 0.065, 'highpass');
        tone(420, 0.08, 0.025, 0.09, 'triangle');
      } else if (outcome === 'cleanMake') {
        noise(0.2, 3000, 0.055, 0, 'highpass');
        tone(620, 0.09, 0.025, 0.035, 'triangle');
      } else if (outcome === 'pureSwish') {
        noise(0.26, 3400, 0.078, 0, 'highpass');
        tone(710, 0.1, 0.028, 0.04, 'triangle');
      } else if (outcome === 'cookedSwish') {
        noise(0.28, 3600, 0.095, 0, 'highpass');
        tone(760, 0.1, 0.032, 0.035, 'triangle');
        tone(210, 0.18, 0.035, 0.18, 'sine');
        noise(0.22, 1200, 0.035, 0.18, 'bandpass');
      }
    }
  };
}
