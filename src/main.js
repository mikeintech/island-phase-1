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
const hostButton = document.querySelector('#hostButton');
const joinButton = document.querySelector('#joinButton');
const peerCodeInput = document.querySelector('#peerCode');
const onlineStatusEl = document.querySelector('#onlineStatus');
const labToggle = document.querySelector('#labToggle');
const labPanel = document.querySelector('#labPanel');
const labReadout = document.querySelector('#labReadout');

const rim = new THREE.Vector3(0, 3.05, -5.85);
const rimFloor = new THREE.Vector3(0, 0, -5.85);
const courtBounds = { minX: -3.75, maxX: 3.75, minZ: -5.35, maxZ: 3.35 };
const netLines = [];
const roomCodeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090b);
scene.fog = new THREE.Fog(0x07090b, 10, 24);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
const cameraRig = {
  position: new THREE.Vector3(0, 3.08, 7.35),
  lookAt: new THREE.Vector3(0, 1.12, -0.8),
  targetPosition: new THREE.Vector3(),
  targetLookAt: new THREE.Vector3(),
  fov: 45
};

const hemi = new THREE.HemisphereLight(0xfff2d2, 0x111827, 1.75);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xffe4a8, 2.55);
keyLight.position.set(-3.2, 7.2, 4.8);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x79ffd2, 2.2, 7.5);
rimLight.position.set(2.2, 3.4, -4.7);
scene.add(rimLight);

const violetLight = new THREE.PointLight(0xb35cff, 1.45, 8.5);
violetLight.position.set(-3.2, 2.7, -1.8);
scene.add(violetLight);

const blueEdgeLight = new THREE.PointLight(0x4db6ff, 1.1, 8);
blueEdgeLight.position.set(3.1, 1.6, 1.8);
scene.add(blueEdgeLight);

const courtTexture = createCourtTexture();

const materials = {
  court: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: courtTexture,
    roughness: 0.58,
    metalness: 0.08
  }),
  paint: new THREE.LineBasicMaterial({ color: 0xf4f1e8, transparent: true, opacity: 0.62 }),
  sideline: new THREE.LineBasicMaterial({ color: 0xf7be4e, transparent: true, opacity: 0.78 }),
  paintFill: new THREE.MeshBasicMaterial({
    color: 0x2587d8,
    transparent: true,
    opacity: 0.56,
    side: THREE.DoubleSide
  }),
  keyFill: new THREE.MeshBasicMaterial({
    color: 0xe56c2f,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide
  }),
  courtGlow: new THREE.MeshBasicMaterial({
    color: 0x4bb6ff,
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  }),
  neonBlue: new THREE.MeshBasicMaterial({
    color: 0x52d6ff,
    transparent: true,
    opacity: 0.58,
    side: THREE.DoubleSide
  }),
  neonViolet: new THREE.MeshBasicMaterial({
    color: 0xb35cff,
    transparent: true,
    opacity: 0.44,
    side: THREE.DoubleSide
  }),
  offSkin: new THREE.MeshStandardMaterial({ color: 0xf1dfc7, roughness: 0.5 }),
  offJersey: new THREE.MeshStandardMaterial({ color: 0xf1dfc7, roughness: 0.48 }),
  offShorts: new THREE.MeshStandardMaterial({ color: 0xf1dfc7, roughness: 0.5 }),
  offShoe: new THREE.MeshStandardMaterial({ color: 0x131821, roughness: 0.36 }),
  defLimb: new THREE.MeshStandardMaterial({ color: 0x111719, roughness: 0.5 }),
  defJersey: new THREE.MeshStandardMaterial({ color: 0x111719, roughness: 0.54 }),
  defShorts: new THREE.MeshStandardMaterial({ color: 0x111719, roughness: 0.56 }),
  defShoe: new THREE.MeshStandardMaterial({ color: 0x8de7cb, roughness: 0.38 }),
  ball: new THREE.MeshStandardMaterial({ color: 0xe8752d, roughness: 0.54 }),
  ballSeam: new THREE.MeshBasicMaterial({ color: 0x2a1408 }),
  black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xf16f31, roughness: 0.38 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x14324b, roughness: 0.32, metalness: 0.18 }),
  boardFace: new THREE.MeshStandardMaterial({ color: 0xf1f3ed, roughness: 0.34 }),
  boardTrim: new THREE.MeshBasicMaterial({ color: 0x101418 }),
  net: new THREE.LineBasicMaterial({ color: 0xf9f7ee, transparent: true, opacity: 0.72 }),
  shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 }),
  glowGreen: new THREE.MeshBasicMaterial({ color: 0x96e1c8 }),
  glowGold: new THREE.MeshBasicMaterial({ color: 0xf7be4e }),
  labPlant: new THREE.MeshBasicMaterial({
    color: 0x96e1c8,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide
  }),
  labTrail: new THREE.LineBasicMaterial({ color: 0xf7be4e, transparent: true, opacity: 0.86 })
};

createCourt();
createHoop();

const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 28, 18), materials.ball);
ball.castShadow = true;
addBallSeams(ball);
scene.add(ball);

class StickPlayer {
  constructor({
    role = 'offense',
    limbMaterial,
    jointMaterial,
    headMaterial,
    accentMaterial,
    jerseyMaterial,
    shortsMaterial,
    shoeMaterial
  }) {
    this.role = role;
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
    this.footPlant = {
      ready: false,
      left: new THREE.Vector3(),
      right: new THREE.Vector3(),
      side: null,
      t: 0,
      duration: 0.18,
      from: new THREE.Vector3(),
      to: new THREE.Vector3()
    };
    this.material = limbMaterial;
    this.jointMaterial = jointMaterial;
    this.headMaterial = headMaterial;
    this.accentMaterial = accentMaterial;
    this.jerseyMaterial = jerseyMaterial;
    this.shortsMaterial = shortsMaterial;
    this.shoeMaterial = shoeMaterial;
    this.parts = {
      hips: sphere(0.045, shortsMaterial),
      chest: sphere(0.045, jerseyMaterial),
      head: sphere(0.115, headMaterial),
      leftHand: sphere(0.052, limbMaterial),
      rightHand: sphere(0.052, limbMaterial),
      leftFoot: foot(shoeMaterial),
      rightFoot: foot(shoeMaterial),
      jersey: new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.24, 8, 18), jerseyMaterial),
      shorts: new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.06, 6, 16), shortsMaterial),
      shoulderBridge: new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.9, 5, 12), jerseyMaterial),
      hipBridge: new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.9, 5, 12), shortsMaterial),
      pivot: ring(accentMaterial),
      ballHand: sphere(0.045, accentMaterial),
      joints: {
        neck: sphere(0.052, limbMaterial),
        leftShoulder: sphere(0.066, limbMaterial),
        rightShoulder: sphere(0.066, limbMaterial),
        leftElbow: sphere(0.058, limbMaterial),
        rightElbow: sphere(0.058, limbMaterial),
        leftHip: sphere(0.056, shortsMaterial),
        rightHip: sphere(0.056, shortsMaterial),
        leftKnee: sphere(0.062, limbMaterial),
        rightKnee: sphere(0.062, limbMaterial),
        leftAnkle: sphere(0.05, limbMaterial),
        rightAnkle: sphere(0.05, limbMaterial)
      },
      limbs: []
    };

    for (let i = 0; i < 10; i += 1) {
      const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.9, 5, 10), limbMaterial);
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
    Object.values(this.parts.joints).forEach((joint) => {
      joint.castShadow = true;
      this.group.add(joint);
    });
    this.parts.hips.visible = false;
    this.parts.chest.visible = false;
    this.group.add(this.parts.pivot);
    scene.add(this.group);
  }

  setPosition(x, z) {
    this.root.set(x, 0, z);
    this.group.position.copy(this.root);
    this.footPlant.ready = false;
  }

  handWorld(side) {
    const local = this.getPose().hands[side > 0 ? 'right' : 'left'];
    return this.group.localToWorld(local.clone());
  }

  getPose() {
    const speed = Math.min(this.velocity.length(), 5);
    const isOffense = this.role === 'offense';
    const activeMove = isOffense ? game.move : null;
    const moveKind = activeMove?.kind || '';
    const moveP = activeMove ? clamp01(activeMove.t / activeMove.duration) : 0;
    const moveEase = Math.sin(moveP * Math.PI);
    const defensivePose = this.action === 'defense' || this.action === 'bite' || this.action === 'beat';
    const crossLoad = moveKind === 'cross' ? moveEase : 0;
    const inoutLoad = moveKind === 'inout' ? moveEase : 0;
    const retreatLoad = moveKind === 'snatchback' || moveKind === 'stepback' ? moveEase : 0;
    const shotP = isOffense && game.shot ? clamp01(game.shot.t / 0.38) : 0;
    const stride = Math.sin(this.phase) * 0.16 * Math.min(speed / 3.2, 1);
    const cross = Math.cos(this.facing);
    const forward = Math.sin(this.facing);
    const stance =
      (defensivePose ? 0.37 : this.action === 'shot' ? 0.22 : 0.26) +
      crossLoad * 0.18 +
      retreatLoad * 0.08 +
      (this.action === 'gather' ? 0.08 : 0);
    const low =
      (defensivePose ? -0.08 : 0) +
      (this.action === 'bite' ? 0.05 : 0) +
      (this.action === 'gather' ? -0.13 : 0) -
      crossLoad * 0.12 -
      retreatLoad * 0.05;
    const rise = this.action === 'shot' ? 0.22 + Math.sin(shotP * Math.PI) * 0.12 : 0;
    const jump = this.contest > 0 ? 0.16 * Math.sin(this.contest * Math.PI) : 0;
    const moveLean = activeMove?.dir?.x || 0;
    const leanX = this.lean.x * 0.18 + this.shade * 0.08 + crossLoad * moveLean * 0.18 - this.beat * this.shade * 0.1;
    const leanZ = this.lean.y * 0.18 - this.beat * 0.1 + retreatLoad * 0.12 + this.bite * 0.08;
    const hipY = 0.86 + low + rise + jump;
    const shoulderY = 1.48 + low + rise + jump;
    const handLift = this.action === 'shot' ? 0.98 : this.contest > 0 ? 0.72 : 0;
    const footY = this.action === 'shot' ? 0.07 + rise * 0.16 : 0.035;

    const hips = new THREE.Vector3(leanX * 0.34, hipY, leanZ * 0.3);
    const chest = new THREE.Vector3(leanX, shoulderY, leanZ);
    const head = new THREE.Vector3(leanX * 1.05, 1.82 + low + rise + jump, leanZ * 1.05);
    const leftHip = new THREE.Vector3(-0.145 + leanX * 0.22, hipY - 0.04, leanZ * 0.16);
    const rightHip = new THREE.Vector3(0.145 + leanX * 0.22, hipY - 0.04, leanZ * 0.16);
    const leftShoulder = new THREE.Vector3(-0.245 + leanX, shoulderY, leanZ);
    const rightShoulder = new THREE.Vector3(0.245 + leanX, shoulderY, leanZ);
    const leftFoot = new THREE.Vector3(-stance - stride * cross, footY, stride * forward);
    const rightFoot = new THREE.Vector3(stance + stride * cross, footY, -stride * forward);
    if (crossLoad > 0) {
      const dir = activeMove?.dir?.x || 1;
      leftFoot.x -= 0.05 * crossLoad;
      rightFoot.x += 0.05 * crossLoad;
      leftFoot.z += (dir > 0 ? -0.06 : 0.1) * crossLoad;
      rightFoot.z += (dir > 0 ? 0.1 : -0.06) * crossLoad;
    }
    if (this.action === 'gather') {
      leftFoot.x *= 0.92;
      rightFoot.x *= 0.92;
      leftFoot.z -= 0.03;
      rightFoot.z += 0.03;
    }
    const leftKnee = leftHip.clone().lerp(leftFoot, 0.5).add(new THREE.Vector3(-0.06, -0.05, 0.05));
    const rightKnee = rightHip.clone().lerp(rightFoot, 0.5).add(new THREE.Vector3(0.06, -0.05, -0.05));
    const dribbleSide = this.ballHand;
    const offSide = -dribbleSide;
    const dribbleBeat = Math.abs(Math.sin(this.phase * 1.6));
    const ballY = 0.38 + dribbleBeat * 0.42;
    const activeHand = new THREE.Vector3(
      dribbleSide * (0.32 + 0.08 * Math.sin(this.phase)),
      ballY + 0.03,
      0.17 + leanZ * 0.36
    );
    const offHand = new THREE.Vector3(offSide * 0.28, 1.06 + handLift * 0.35, 0.15);
    if (defensivePose) {
      const wrong = this.action === 'beat' ? this.beat : this.bite;
      activeHand.set(dribbleSide * (0.54 + wrong * 0.08), 0.98 + handLift * 0.25 - wrong * 0.06, 0.08 - wrong * 0.08);
      offHand.set(offSide * (0.54 - wrong * 0.06), 0.98 + handLift * 0.25 + wrong * 0.08, 0.08 + wrong * 0.04);
    }
    if (crossLoad > 0 || inoutLoad > 0) {
      const from = activeMove.fromHand ?? -dribbleSide;
      const to = activeMove.toHand ?? dribbleSide;
      const fake = inoutLoad > 0 ? Math.sin(moveP * Math.PI) * activeMove.dir.x * 0.22 : 0;
      const side = THREE.MathUtils.lerp(from, to, easeInOut(moveP));
      activeHand.set(side * (0.5 - crossLoad * 0.08) + fake, 0.43 + (crossLoad + inoutLoad) * 0.1, 0.18);
      offHand.set(-side * 0.22, 0.94 - (crossLoad + inoutLoad) * 0.06, 0.18);
    } else if (retreatLoad > 0) {
      activeHand.set(dribbleSide * 0.42, 0.62 + retreatLoad * 0.12, 0.22 + retreatLoad * 0.08);
      offHand.set(offSide * 0.28, 1.0, 0.15);
    }
    if (this.action === 'gather') {
      activeHand.set(dribbleSide * 0.12, 1.36, 0.06);
      offHand.set(offSide * 0.12, 1.32, 0.08);
    }
    if (this.action === 'shot') {
      const follow = isOffense && game.shot ? clamp01((game.shot.t - 0.42) / 0.32) : 0;
      activeHand.set(dribbleSide * 0.11, 2.24 + follow * 0.14, -0.03);
      offHand.set(offSide * 0.12, 2.04 - follow * 0.18, 0.03);
    }
    const elbowDrop = this.action === 'shot' ? -0.03 : this.action === 'defense' ? -0.06 : -0.11;
    const leftElbow = leftShoulder.clone().lerp(
      dribbleSide > 0 ? offHand : activeHand,
      0.52
    ).add(new THREE.Vector3(-0.08, elbowDrop, 0.035));
    const rightElbow = rightShoulder.clone().lerp(
      dribbleSide > 0 ? activeHand : offHand,
      0.52
    ).add(new THREE.Vector3(0.08, elbowDrop, 0.035));

    return {
      hips,
      chest,
      head,
      shoulders: { left: leftShoulder, right: rightShoulder },
      hipsSide: { left: leftHip, right: rightHip },
      elbows: { left: leftElbow, right: rightElbow },
      knees: { left: leftKnee, right: rightKnee },
      feet: { left: leftFoot, right: rightFoot },
      hands: dribbleSide > 0 ? { right: activeHand, left: offHand } : { left: activeHand, right: offHand }
    };
  }

  applyFootPlants(pose, dt, speed) {
    const airborne = this.action === 'shot' || this.contest > 0.08;
    const plant = this.footPlant;
    if (airborne) {
      plant.ready = false;
      return;
    }

    const desiredLeft = pose.feet.left.clone().add(this.root);
    const desiredRight = pose.feet.right.clone().add(this.root);
    if (!plant.ready) {
      plant.left.copy(desiredLeft);
      plant.right.copy(desiredRight);
      plant.ready = true;
      plant.side = null;
    }

    const slide = clamp01(speed / 4.6);
    const groundedBlend = 1 - Math.exp(-dt * THREE.MathUtils.lerp(6.5, 13, slide));
    const plantedBlend = 1 - Math.exp(-dt * THREE.MathUtils.lerp(2.6, 6.2, slide));
    if (plant.side !== 'left') {
      plant.left.lerp(desiredLeft, speed < 0.12 ? groundedBlend : plantedBlend);
    }
    if (plant.side !== 'right') {
      plant.right.lerp(desiredRight, speed < 0.12 ? groundedBlend : plantedBlend);
    }

    const leftGap = flatDistance(plant.left, desiredLeft);
    const rightGap = flatDistance(plant.right, desiredRight);
    const defensivePose = this.action === 'defense' || this.action === 'bite' || this.action === 'beat';
    const stepThreshold = defensivePose ? 0.26 : THREE.MathUtils.lerp(0.2, 0.34, slide);

    if (!plant.side && (leftGap > stepThreshold || rightGap > stepThreshold)) {
      plant.side = leftGap > rightGap ? 'left' : 'right';
      plant.t = 0;
      plant.duration = THREE.MathUtils.lerp(0.1, 0.17, slide);
      plant.from.copy(plant[plant.side]);
      plant.to.copy(plant.side === 'left' ? desiredLeft : desiredRight);
    }

    if (plant.side) {
      plant.t += dt;
      const p = clamp01(plant.t / plant.duration);
      const footPos = plant[plant.side];
      footPos.lerpVectors(plant.from, plant.to, easeInOut(p));
      footPos.y = THREE.MathUtils.lerp(plant.from.y, plant.to.y, p) + Math.sin(p * Math.PI) * 0.052;
      if (p >= 1) {
        footPos.copy(plant.to);
        plant.side = null;
      }
    }

    pose.feet.left.copy(plant.left).sub(this.root);
    pose.feet.right.copy(plant.right).sub(this.root);
    pose.feet.left.y = Math.max(pose.feet.left.y, 0.035);
    pose.feet.right.y = Math.max(pose.feet.right.y, 0.035);
    pose.knees.left.copy(pose.hipsSide.left).lerp(pose.feet.left, 0.5).add(new THREE.Vector3(-0.06, -0.05, 0.05));
    pose.knees.right.copy(pose.hipsSide.right).lerp(pose.feet.right, 0.5).add(new THREE.Vector3(0.06, -0.05, -0.05));
  }

  update(dt) {
    const speed = this.velocity.length();
    this.phase += dt * (5.2 + speed * 1.2);
    this.contest = Math.max(0, this.contest - dt * 1.7);
    this.bite = Math.max(0, this.bite - dt * 2.8);
    this.beat = Math.max(0, this.beat - dt * 1.35);

    const shouldFaceRim = speed <= 0.04 && this.role === 'offense';
    if (speed > 0.04 || shouldFaceRim) {
      const faceVector = shouldFaceRim ? tmpA.copy(rimFloor).sub(this.root) : this.velocity;
      const targetFacing = Math.atan2(faceVector.z, faceVector.x);
      this.facing = lerpAngle(this.facing, targetFacing, 1 - Math.exp(-dt * 8));
      if (speed > 0.04) this.lean.set(this.velocity.x / 4.8, this.velocity.z / 4.8);
    } else {
      this.lean.multiplyScalar(Math.exp(-dt * 5));
    }

    this.group.position.copy(this.root);
    const pose = this.getPose();
    this.applyFootPlants(pose, dt, speed);
    this.parts.hips.position.copy(pose.hips);
    this.parts.chest.position.copy(pose.chest);
    this.parts.head.position.copy(pose.head);
    this.parts.head.scale.set(0.82, 1.12, 0.78);
    this.parts.leftHand.position.copy(pose.hands.left);
    this.parts.rightHand.position.copy(pose.hands.right);
    this.parts.leftFoot.position.copy(pose.feet.left);
    this.parts.rightFoot.position.copy(pose.feet.right);
    this.parts.ballHand.position.copy(this.ballHand > 0 ? pose.hands.right : pose.hands.left);
    placeBoxBetween(
      this.parts.jersey,
      tmpA.copy(pose.hips).add(new THREE.Vector3(0, 0.04, 0)),
      tmpC.copy(pose.chest).add(new THREE.Vector3(0, -0.09, 0)),
      0.36,
      0.17
    );
    this.parts.shorts.position.copy(pose.hips).add(new THREE.Vector3(0, -0.07, 0.02));
    this.parts.shorts.scale.set(0.38, 0.23, 0.22);
    this.parts.shorts.quaternion.identity();
    placeLimb(this.parts.shoulderBridge, pose.shoulders.left, pose.shoulders.right, 0.028);
    placeLimb(this.parts.hipBridge, pose.hipsSide.left, pose.hipsSide.right, 0.036);
    this.parts.joints.neck.position.copy(tmpA.copy(pose.chest).lerp(pose.head, 0.34));
    this.parts.joints.leftShoulder.position.copy(pose.shoulders.left);
    this.parts.joints.rightShoulder.position.copy(pose.shoulders.right);
    this.parts.joints.leftElbow.position.copy(pose.elbows.left);
    this.parts.joints.rightElbow.position.copy(pose.elbows.right);
    this.parts.joints.leftHip.position.copy(pose.hipsSide.left);
    this.parts.joints.rightHip.position.copy(pose.hipsSide.right);
    this.parts.joints.leftKnee.position.copy(pose.knees.left);
    this.parts.joints.rightKnee.position.copy(pose.knees.right);
    this.parts.joints.leftAnkle.position.copy(pose.feet.left);
    this.parts.joints.rightAnkle.position.copy(pose.feet.right);
    this.parts.joints.leftAnkle.position.y += 0.045;
    this.parts.joints.rightAnkle.position.y += 0.045;
    this.parts.pivot.visible = game.state === 'stop' || game.state === 'contact' || game.state === 'shotFake';
    this.parts.pivot.position.copy(this.pivotSide > 0 ? pose.feet.right : pose.feet.left);
    this.parts.pivot.position.y = 0.025;

    const limbs = this.parts.limbs;
    placeLimb(limbs[0], tmpA.copy(pose.chest).add(new THREE.Vector3(0, 0.03, 0)), pose.head, 0.03);
    placeLimb(limbs[1], pose.shoulders.left, pose.elbows.left, 0.028);
    placeLimb(limbs[2], pose.elbows.left, pose.hands.left, 0.026);
    placeLimb(limbs[3], pose.shoulders.right, pose.elbows.right, 0.028);
    placeLimb(limbs[4], pose.elbows.right, pose.hands.right, 0.026);
    placeLimb(limbs[5], pose.hipsSide.left, pose.knees.left, 0.033);
    placeLimb(limbs[6], pose.knees.left, pose.feet.left, 0.031);
    placeLimb(limbs[7], pose.hipsSide.right, pose.knees.right, 0.033);
    placeLimb(limbs[8], pose.knees.right, pose.feet.right, 0.031);
    limbs[9].visible = false;
  }
}

const offense = new StickPlayer({
  role: 'offense',
  limbMaterial: materials.offSkin,
  jointMaterial: materials.offSkin,
  headMaterial: materials.offSkin,
  accentMaterial: materials.glowGold,
  jerseyMaterial: materials.offJersey,
  shortsMaterial: materials.offShorts,
  shoeMaterial: materials.offShoe
});
const defense = new StickPlayer({
  role: 'defense',
  limbMaterial: materials.defLimb,
  jointMaterial: materials.defLimb,
  headMaterial: materials.defLimb,
  accentMaterial: materials.glowGreen,
  jerseyMaterial: materials.defJersey,
  shortsMaterial: materials.defShorts,
  shoeMaterial: materials.defShoe
});

const shadows = {
  offense: makeShadow(),
  defense: makeShadow(),
  ball: makeShadow(0.32)
};
const labGuides = createLabGuides();

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
  gather: null,
  shot: null,
  netPinch: 0,
  replay: null,
  feedback: null,
  lab: false
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

const online = {
  role: 'solo',
  peer: null,
  conn: null,
  hostId: '',
  status: 'Solo · AI defense',
  remoteInput: {
    active: false,
    pressure: 0,
    worldDir: new THREE.Vector3(),
    lastAt: 0
  },
  remoteSnapshot: null,
  snapshotTimer: 0,
  sendTimer: 0
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
hostButton.addEventListener('click', startOnlineHost);
joinButton.addEventListener('click', startOnlineJoin);
peerCodeInput.addEventListener('input', () => {
  peerCodeInput.value = normalizeRoomCode(peerCodeInput.value);
});
labToggle.addEventListener('click', toggleLab);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'l') toggleLab();
});

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

  if (game.mode === 'score' && !['gather', 'shot', 'finish', 'check'].includes(game.state)) {
    game.shotClock = Math.max(0, game.shotClock - dt);
    if (game.shotClock <= 0) {
      resolveDeadPossession('Clock', 'late', true);
    }
  }

  if (game.resultHold > 0) {
    game.resultHold = Math.max(0, game.resultHold - dt);
    if (game.resultHold === 0) resultPanel.classList.add('hidden');
  }

  if (online.role === 'guest') {
    applyRemoteSnapshot(dt);
    sendGuestDefenseInput(dt);
    updateNet(dt);
    offense.update(dt);
    defense.update(dt);
    updateCamera(dt);
    updateLab();
    updateUI();
    return;
  }

  updateOffense(dt);
  updateDefender(dt);
  updateAdvantage(dt);
  updateGather(dt);
  updateShot(dt);
  updateNet(dt);
  updateResetTimer(dt);
  offense.update(dt);
  defense.update(dt);
  updateBall();
  updateCamera(dt);
  updateLab();
  updateUI();
  sendHostSnapshot(dt);
}

function updateOffense(dt) {
  if (game.state === 'gather' || game.state === 'shot' || game.state === 'finish') {
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
  } else if (move.kind === 'inout') {
    desired.x += move.dir.x * (1.25 * ease - 0.38 * p);
    desired.z -= 1.55 * ease;
    game.balance = clamp01(game.balance + dt * 0.1);
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

  if (p > 0.52 && !move.handChanged) {
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
  if (online.role === 'host' && online.conn?.open) {
    updatePlayerDefense(dt);
    return;
  }

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
  const liveSep = flatDistance(offense.root, defense.root);
  if ((game.state === 'gather' || game.state === 'shot') && liveSep < 1.72) {
    game.defenderContest = Math.max(game.defenderContest, game.state === 'shot' ? 0.72 : 0.52);
  }

  const samplePos = delayed?.pos || offense.root;
  const sampleVel = delayed?.vel || offense.velocity;
  const toRim = tmpA.copy(rimFloor).sub(samplePos).normalize();
  const aiPressure = game.mode === 'score' ? 1 : 0.82;
  const guardGap = game.state === 'attack' ? 0.78 : game.state === 'retreat' ? 1.08 : 0.92;
  const ideal = tmpB.copy(samplePos).addScaledVector(toRim, guardGap);
  ideal.x += game.defenderShade * THREE.MathUtils.lerp(0.14, 0.24, aiPressure);
  ideal.addScaledVector(sampleVel, game.state === 'attack' ? 0.13 : 0.07);

  let maxSpeed = THREE.MathUtils.lerp(3.45, 4.15, aiPressure);
  game.defenderState = 'Neutral';
  if (liveSep < 0.72) {
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
    maxSpeed = 4.7;
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
  defense.action =
    game.defenderContest > 0 ? 'shot' : game.defenderWrongWay > 0 ? 'beat' : game.defenderBite > 0 ? 'bite' : 'defense';
  defense.ballHand = offense.ballHand;
  defense.beat = Math.max(defense.beat, game.defenderWrongWay);
}

function updatePlayerDefense(dt) {
  const control = online.remoteInput;
  const desired = tmpA.set(0, 0, 0);
  if (control.active && control.pressure > 0.08) {
    desired.copy(control.worldDir).multiplyScalar(0.72 + control.pressure * 3.55);
    game.defenderState = control.pressure > 0.68 ? 'Cutoff' : 'Slide';
  } else {
    game.defenderState = 'Disciplined';
  }

  game.defenderWrongWay = Math.max(0, game.defenderWrongWay - dt * 1.4);
  game.defenderBite = Math.max(0, game.defenderBite - dt * 1.8);
  game.defenderContest = Math.max(0, game.defenderContest - dt * 1.6);

  const toGuard = tmpB.copy(offense.root).sub(defense.root);
  const gap = toGuard.length();
  if (!control.active && gap > 1.55) {
    toGuard.normalize().multiplyScalar(Math.min(1.8, gap));
    desired.addScaledVector(toGuard, 0.55);
  }

  defense.velocity.lerp(desired, 1 - Math.exp(-dt * 8.5));
  defense.root.addScaledVector(defense.velocity, dt);
  clampPlayer(defense.root);

  const sep = flatDistance(offense.root, defense.root);
  game.defenderCrowd = sep < 0.78 ? clamp01(game.defenderCrowd + dt * 1.8) : clamp01(game.defenderCrowd - dt * 1.4);
  if (game.defenderContest > 0) game.defenderState = 'Contest';
  else if (game.defenderBite > 0) game.defenderState = 'Bite';
  else if (game.defenderWrongWay > 0) game.defenderState = 'Beat';

  defense.shade = clamp((defense.root.x - offense.root.x) * 0.65, -1, 1);
  defense.action =
    game.defenderContest > 0 ? 'shot' : game.defenderWrongWay > 0 ? 'beat' : game.defenderBite > 0 ? 'bite' : 'defense';
  defense.ballHand = offense.ballHand;
  defense.beat = Math.max(defense.beat, game.defenderWrongWay);
  defense.contest = Math.max(defense.contest, game.defenderContest);
}

function handleDefenseRelease() {
  const sep = flatDistance(offense.root, defense.root);
  if ((game.state === 'gather' || game.state === 'shot') && sep < 1.95) {
    game.defenderContest = Math.max(game.defenderContest, 0.86);
    defense.contest = Math.max(defense.contest, 0.86);
    game.defenderState = 'Contest';
  } else {
    game.defenderBite = Math.max(game.defenderBite, 0.42);
    if (sep > 1.15) game.defenderWrongWay = Math.max(game.defenderWrongWay, 0.14);
  }
}

function handleDefenseFlick(dir) {
  const toBall = tmpA.copy(offense.root).sub(defense.root);
  toBall.y = 0;
  if (toBall.lengthSq() > 0.001) toBall.normalize();
  const towardBall = dir.dot(toBall);
  if (towardBall > 0.62) {
    const sep = flatDistance(offense.root, defense.root);
    if (!game.gather && !game.shot && sep < 0.82 && game.fatigue > 0.18) {
      resolveDeadPossession('Poked', 'turnover', true);
    } else {
      game.defenderBite = Math.max(game.defenderBite, 0.24);
      game.defenderCrowd = clamp01(game.defenderCrowd + 0.16);
    }
    return;
  }
  game.defenderShade = clamp(dir.x, -1, 1);
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

function updateGather(dt) {
  if (!game.gather) return;
  const gather = game.gather;
  gather.t += dt;
  offense.action = 'gather';
  offense.velocity.multiplyScalar(Math.exp(-dt * 9));

  const p = easeInOut(clamp01(gather.t / gather.duration));
  const gatherPocket = offense.group.localToWorld(
    new THREE.Vector3(
      offense.ballHand * THREE.MathUtils.lerp(0.34, 0.09, p),
      THREE.MathUtils.lerp(0.64, 2.18, p),
      THREE.MathUtils.lerp(0.14, -0.02, p)
    )
  );
  ball.position.copy(gatherPocket);

  if (gather.t >= gather.duration) {
    const lockedMetrics = gather.metrics;
    game.gather = null;
    startShot(lockedMetrics);
  }
}

function updateShot(dt) {
  if (!game.shot) return;
  const shot = game.shot;
  shot.t += dt;
  offense.action = 'shot';
  const p = clamp01(shot.t / shot.flight);
  const arc = Math.sin(Math.PI * p) * shot.arc;
  ball.position.lerpVectors(shot.start, shot.end, easeInOut(p));
  ball.position.y += arc;

  if (!shot.audioPlayed && p >= shot.impactAt) {
    shot.audioPlayed = true;
    game.netPinch = shot.made ? 1 : 0;
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

  if (shot.t > shot.flight + shot.hold) {
    game.shot = null;
    setState('finish');
    game.resetTimer = shot.outcome === 'cookedSwish' ? 1.35 : 0.72;
  }
}

function updateNet(dt) {
  game.netPinch = Math.max(0, game.netPinch - dt * 2.8);
  const snap = Math.sin(game.netPinch * Math.PI);
  netLines.forEach((strand) => {
    const a = strand.userData.angle;
    const top = new THREE.Vector3(Math.cos(a) * 0.22, 3.02, rim.z + Math.sin(a) * 0.22);
    const bottomAngle = a + 0.22 + snap * 0.28;
    const bottomRadius = THREE.MathUtils.lerp(0.12, 0.055, snap);
    const bottom = new THREE.Vector3(
      Math.cos(bottomAngle) * bottomRadius,
      2.52 - snap * 0.16,
      rim.z + Math.sin(bottomAngle) * bottomRadius
    );
    strand.geometry.setFromPoints([top, bottom]);
  });
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

  if (game.gather) {
    shadows.ball.position.set(ball.position.x, 0.012, ball.position.z);
    shadows.ball.scale.setScalar(0.24);
    return;
  }

  if (game.move?.kind === 'cross') {
    const p = clamp01(game.move.t / game.move.duration);
    const side = THREE.MathUtils.lerp(game.move.fromHand, game.move.toHand, easeInOut(p));
    const pocket = Math.sin(p * Math.PI);
    ball.position.set(
      offense.root.x + side * (0.5 - pocket * 0.08),
      0.3 + pocket * 0.12,
      offense.root.z + 0.18 + pocket * 0.04
    );
    shadows.ball.position.set(ball.position.x, 0.012, ball.position.z);
    shadows.ball.scale.setScalar(0.26);
    return;
  }

  if (game.move?.kind === 'inout') {
    const p = clamp01(game.move.t / game.move.duration);
    const fake = Math.sin(p * Math.PI);
    ball.position.set(
      offense.root.x + offense.ballHand * 0.46 + game.move.dir.x * fake * 0.18,
      0.34 + fake * 0.16,
      offense.root.z + 0.16 + fake * 0.05
    );
    shadows.ball.position.set(ball.position.x, 0.012, ball.position.z);
    shadows.ball.scale.setScalar(0.26);
    return;
  }

  if (game.move && (game.move.kind === 'snatchback' || game.move.kind === 'stepback')) {
    const p = clamp01(game.move.t / game.move.duration);
    const pocket = Math.sin(p * Math.PI);
    ball.position.set(
      offense.root.x + offense.ballHand * 0.42,
      0.48 + pocket * 0.16,
      offense.root.z + 0.24 + pocket * 0.08
    );
    shadows.ball.position.set(ball.position.x, 0.012, ball.position.z);
    shadows.ball.scale.setScalar(0.26);
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
  const gather = game.state === 'stop' || game.state === 'gather' || game.state === 'shot' ? 1 : 0;
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
  if (online.role === 'guest') {
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
    sendGuestDefenseInput(0, true);
    return;
  }
  if (game.state === 'gather' && game.gather) {
    startShotFake();
    return;
  }
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
    screenVectorToWorld(dragX, dragY, input.worldDir);
  }

  const flickSpeed = input.velocity.length();
  if (online.role === 'guest') {
    if (flickSpeed > 900 && now - input.recentFlickAt > 170) {
      input.recentFlickAt = now;
      sendNetwork({
        type: 'defenseFlick',
        x: input.worldDir.x,
        z: input.worldDir.z
      });
    }
    sendGuestDefenseInput(0);
    return;
  }

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

  if (online.role === 'guest') {
    sendNetwork({ type: 'defenseRelease' });
    sendGuestDefenseInput(0, true);
    return;
  }

  if (['gather', 'shot', 'finish', 'check'].includes(game.state)) return;
  if (game.state === 'contact' && heldMs < 420) {
    startShotFake();
    return;
  }
  startGather();
}

function interpretFlick(vx, vy, speed) {
  const dir = screenVectorToWorld(vx, vy, tmpA);
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
    } else if (defenderOverplays && Math.sign(dir.x || 1) === offense.ballHand) {
      startMove('inout', dir);
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

  const durations = { cross: 0.34, inout: 0.36, snatchback: 0.42, stepback: 0.48, hesi: 0.32 };
  const x = Math.sign(dir.x || -offense.ballHand || 1);
  game.move = {
    kind,
    t: 0,
    duration: durations[kind],
    dir: new THREE.Vector3(x, 0, dir.z),
    forward: kind === 'cross' && dir.z < 0 ? -0.35 : 0.1,
    fromHand: offense.ballHand,
    toHand: kind === 'cross' ? -offense.ballHand : offense.ballHand,
    handChanged: false
  };

  game.lastMove = kind;
  game.lastMoveTime = 0;
  setState(kind === 'snatchback' || kind === 'stepback' ? 'retreat' : 'probe');

  const wrongFootChance =
    kind === 'hesi' ? 0.46 : kind === 'cross' ? 0.38 : kind === 'inout' ? 0.42 : kind === 'snatchback' ? 0.54 : 0.58;
  const contextBoost = game.defenderCrowd * 0.22 + (game.balance > 0.58 ? 0.08 : -0.05);
  if (Math.random() < wrongFootChance + contextBoost) {
    game.defenderWrongWay = kind === 'cross' ? 0.34 : 0.52;
  }
  if (kind === 'snatchback' || kind === 'stepback' || kind === 'hesi' || kind === 'inout') {
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

function startGather() {
  if (game.gather || game.shot || game.state === 'finish') return;
  const metrics = shotMetrics();
  const lateContest = metrics.contest < 0.42 || game.defenderWrongWay > 0.16;
  game.defenderContest = Math.max(game.defenderContest, lateContest ? 0.28 : 0.58);
  game.gather = {
    t: 0,
    duration: THREE.MathUtils.lerp(0.2, 0.32, 1 - metrics.balance),
    metrics
  };
  game.move = null;
  setState('gather');
  offense.action = 'gather';
  offense.velocity.multiplyScalar(0.38);
}

function startShotFake() {
  game.gather = null;
  game.move = null;
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

function startShot(lockedMetrics = null) {
  const metrics = lockedMetrics || shotMetrics();
  const madeRoll = metrics.quality + (Math.random() - 0.5) * 0.12;
  let outcome = 'miss';
  if (madeRoll > 0.88 && metrics.cooked) outcome = 'cookedSwish';
  else if (madeRoll > 0.78) outcome = 'pureSwish';
  else if (madeRoll > 0.65) outcome = 'cleanMake';
  else if (madeRoll > 0.5) outcome = 'rimMake';

  const made = outcome !== 'miss';
  setState('shot');
  offense.velocity.multiplyScalar(0.28);
  const start = offense.group.localToWorld(new THREE.Vector3(offense.ballHand * 0.1, 2.24, -0.02));
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
    ['cross', 'inout', 'snatchback', 'stepback', 'hesi'].includes(game.lastMove);
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

function showFeedback(shot, broadcast = true) {
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
  if (broadcast && online.role === 'host') {
    sendNetwork({
      type: 'feedback',
      shot: {
        outcome: shot.outcome,
        deadLabel: shot.deadLabel,
        deadResult: shot.deadResult,
        metrics: shot.metrics
      }
    });
  }
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
  if (online.role === 'guest') return;
  game.mode = mode;
  freeModeButton.classList.toggle('active', mode === 'free');
  scoreModeButton.classList.toggle('active', mode === 'score');
  game.userScore = 0;
  game.aiScore = 0;
  resetPossession(true);
  if (online.role === 'solo') {
    setOnlineStatus(mode === 'score' ? 'AI To 7 · solo defense' : 'Solo · AI defense');
  }
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
  game.gather = null;
  game.shot = null;
  game.replay = null;
  game.defenderSamples.length = 0;
  game.defenderWrongWay = 0;
  game.defenderBite = 0;
  game.defenderContest = 0;
  game.defenderCrowd = 0;
  game.netPinch = 0;
  game.lastMove = initial ? 'check' : 'reset';
  game.lastMoveTime = 2;
  labGuides.trail.length = 0;
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
  freeModeButton.classList.toggle('active', game.mode === 'free');
  scoreModeButton.classList.toggle('active', game.mode === 'score');
  updateOnlineUI();
}

function toggleLab() {
  game.lab = !game.lab;
  labToggle.classList.toggle('active', game.lab);
  labPanel.classList.toggle('hidden', !game.lab);
  if (!game.lab) labGuides.trail.length = 0;
}

function startOnlineHost() {
  if (!window.Peer) {
    setOnlineStatus('PeerJS unavailable');
    return;
  }
  if (online.role === 'host' && online.peer && online.hostId) {
    peerCodeInput.value = online.hostId;
    setOnlineStatus(`Code ${online.hostId} · waiting`);
    return;
  }
  closeOnline();
  online.role = 'host';
  setMode('score');
  setOnlineStatus('Creating host...');
  createHostPeer();
}

function createHostPeer(attempt = 0) {
  const hostId = makeRoomCode();
  const peer = new window.Peer(hostId);
  online.peer = peer;
  online.hostId = hostId;
  peerCodeInput.value = hostId;
  peer.on('open', (id) => {
    if (online.peer !== peer) return;
    online.hostId = id;
    peerCodeInput.value = id;
    setOnlineStatus(`Code ${id} · waiting`);
  });
  peer.on('connection', (conn) => setupConnection(conn, 'host'));
  peer.on('error', (error) => {
    if (online.peer !== peer) return;
    if (error.type === 'unavailable-id' && attempt < 6) {
      peer.destroy();
      setOnlineStatus('Code busy · retrying');
      createHostPeer(attempt + 1);
      return;
    }
    setOnlineStatus(`Host error: ${error.type || 'peer'}`);
  });
}

function startOnlineJoin() {
  if (!window.Peer) {
    setOnlineStatus('PeerJS unavailable');
    return;
  }
  const hostId = normalizeRoomCode(peerCodeInput.value);
  peerCodeInput.value = hostId;
  if (hostId.length !== 4) {
    setOnlineStatus('Enter 4-char code');
    return;
  }
  closeOnline();
  online.role = 'guest';
  setOnlineStatus('Joining...');
  online.peer = new window.Peer();
  online.peer.on('open', () => {
    const conn = online.peer.connect(hostId, { reliable: true });
    setupConnection(conn, 'guest');
  });
  online.peer.on('error', (error) => setOnlineStatus(`Join error: ${error.type || 'peer'}`));
}

function setupConnection(conn, role) {
  if (online.conn && online.conn !== conn) online.conn.close();
  online.conn = conn;
  online.role = role;
  conn.on('open', () => {
    setOnlineStatus(role === 'host' ? 'Connected · you attack' : 'Connected · you defend');
    if (role === 'host') {
      setMode('score');
      sendHostSnapshot(1, true);
    }
  });
  conn.on('data', handleNetworkData);
  conn.on('close', () => {
    if (online.conn !== conn) return;
    if (online.role !== 'solo') setOnlineStatus('Peer left · solo AI');
    online.role = 'solo';
    online.conn = null;
  });
  conn.on('error', () => {
    if (online.conn === conn) setOnlineStatus('Connection error');
  });
}

function closeOnline() {
  if (online.conn) online.conn.close();
  if (online.peer) online.peer.destroy();
  online.conn = null;
  online.peer = null;
  online.hostId = '';
  online.remoteSnapshot = null;
  online.remoteInput.active = false;
  online.snapshotTimer = 0;
  online.sendTimer = 0;
}

function makeRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += roomCodeChars[Math.floor(Math.random() * roomCodeChars.length)];
  }
  return code;
}

function normalizeRoomCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/[IO01]/g, '')
    .slice(0, 4);
}

function handleNetworkData(data) {
  if (!data || typeof data !== 'object') return;
  if (online.role === 'host') {
    if (data.type === 'defenseInput') {
      online.remoteInput.active = !!data.active;
      online.remoteInput.pressure = clamp01(Number(data.pressure) || 0);
      online.remoteInput.worldDir.set(Number(data.x) || 0, 0, Number(data.z) || 0);
      if (online.remoteInput.worldDir.lengthSq() > 1) online.remoteInput.worldDir.normalize();
      online.remoteInput.lastAt = performance.now();
    } else if (data.type === 'defenseRelease') {
      online.remoteInput.active = false;
      handleDefenseRelease();
    } else if (data.type === 'defenseFlick') {
      const dir = new THREE.Vector3(Number(data.x) || 0, 0, Number(data.z) || 0);
      if (dir.lengthSq() > 0.001) handleDefenseFlick(dir.normalize());
    }
    return;
  }

  if (online.role === 'guest') {
    if (data.type === 'snapshot') {
      online.remoteSnapshot = data.snapshot;
    } else if (data.type === 'feedback') {
      showFeedback(data.shot, false);
    }
  }
}

function sendNetwork(data) {
  if (online.conn?.open) online.conn.send(data);
}

function sendGuestDefenseInput(dt, force = false) {
  if (online.role !== 'guest' || !online.conn?.open) return;
  online.sendTimer += dt;
  if (!force && online.sendTimer < 0.045) return;
  online.sendTimer = 0;
  sendNetwork({
    type: 'defenseInput',
    active: input.active,
    pressure: input.pressure,
    x: input.worldDir.x,
    z: input.worldDir.z
  });
}

function sendHostSnapshot(dt, force = false) {
  if (online.role !== 'host' || !online.conn?.open) return;
  online.snapshotTimer += dt;
  if (!force && online.snapshotTimer < 0.05) return;
  online.snapshotTimer = 0;
  sendNetwork({ type: 'snapshot', snapshot: serializeSnapshot() });
}

function serializeSnapshot() {
  return {
    mode: game.mode,
    state: game.state,
    shotClock: Number(game.shotClock.toFixed(2)),
    userScore: game.userScore,
    aiScore: game.aiScore,
    defenderState: game.defenderState,
    defenderShade: Number(game.defenderShade.toFixed(3)),
    defenderWrongWay: Number(game.defenderWrongWay.toFixed(3)),
    defenderBite: Number(game.defenderBite.toFixed(3)),
    defenderContest: Number(game.defenderContest.toFixed(3)),
    netPinch: Number(game.netPinch.toFixed(3)),
    offense: serializePlayer(offense),
    defense: serializePlayer(defense),
    ball: serializeVec(ball.position)
  };
}

function serializePlayer(player) {
  return {
    root: serializeVec(player.root),
    velocity: serializeVec(player.velocity),
    ballHand: player.ballHand,
    action: player.action,
    facing: Number(player.facing.toFixed(3)),
    shade: Number(player.shade.toFixed(3)),
    contest: Number(player.contest.toFixed(3)),
    bite: Number(player.bite.toFixed(3)),
    beat: Number(player.beat.toFixed(3))
  };
}

function serializeVec(vec) {
  return [Number(vec.x.toFixed(3)), Number(vec.y.toFixed(3)), Number(vec.z.toFixed(3))];
}

function applyRemoteSnapshot(dt) {
  const snap = online.remoteSnapshot;
  if (!snap) return;
  game.mode = snap.mode || 'score';
  game.state = snap.state || game.state;
  game.shotClock = Number(snap.shotClock) || game.shotClock;
  game.userScore = Number(snap.userScore) || 0;
  game.aiScore = Number(snap.aiScore) || 0;
  game.defenderState = snap.defenderState || game.defenderState;
  game.defenderShade = Number(snap.defenderShade) || 0;
  game.defenderWrongWay = Number(snap.defenderWrongWay) || 0;
  game.defenderBite = Number(snap.defenderBite) || 0;
  game.defenderContest = Number(snap.defenderContest) || 0;
  game.netPinch = Math.max(game.netPinch, Number(snap.netPinch) || 0);
  applyRemotePlayer(offense, snap.offense, dt);
  applyRemotePlayer(defense, snap.defense, dt);
  if (snap.ball) {
    ball.position.set(snap.ball[0], snap.ball[1], snap.ball[2]);
    shadows.ball.position.set(ball.position.x, 0.012, ball.position.z);
    shadows.ball.scale.setScalar(clamp(0.3 - ball.position.y * 0.04, 0.12, 0.3));
  }
}

function applyRemotePlayer(player, data, dt) {
  if (!data) return;
  const blend = 1 - Math.exp(-dt * 18);
  player.root.lerp(tmpA.set(data.root[0], data.root[1], data.root[2]), blend);
  player.velocity.set(data.velocity[0], data.velocity[1], data.velocity[2]);
  player.ballHand = data.ballHand || player.ballHand;
  player.action = data.action || player.action;
  player.facing = data.facing ?? player.facing;
  player.shade = data.shade ?? player.shade;
  player.contest = Math.max(player.contest, data.contest || 0);
  player.bite = Math.max(player.bite, data.bite || 0);
  player.beat = Math.max(player.beat, data.beat || 0);
}

function setOnlineStatus(status) {
  online.status = status;
  updateOnlineUI();
}

function updateOnlineUI() {
  onlineStatusEl.textContent = online.status;
  hostButton.classList.toggle('active', online.role === 'host');
  joinButton.classList.toggle('active', online.role === 'guest');
}

function updateLab() {
  labGuides.group.visible = game.lab;
  if (!game.lab) return;

  const left = offense.parts.leftFoot.getWorldPosition(new THREE.Vector3());
  const right = offense.parts.rightFoot.getWorldPosition(new THREE.Vector3());
  labGuides.leftPlant.position.set(left.x, 0.05, left.z);
  labGuides.rightPlant.position.set(right.x, 0.05, right.z);
  labGuides.leftPlant.scale.setScalar(offense.pivotSide < 0 ? 1.14 : 0.94);
  labGuides.rightPlant.scale.setScalar(offense.pivotSide > 0 ? 1.14 : 0.94);

  const last = labGuides.trail[labGuides.trail.length - 1];
  if (!last || last.distanceTo(ball.position) > 0.045) {
    labGuides.trail.push(ball.position.clone());
    while (labGuides.trail.length > 30) labGuides.trail.shift();
  }
  const trail = labGuides.trail.length > 1 ? labGuides.trail : [ball.position, ball.position];
  labGuides.trailLine.geometry.setFromPoints(trail);

  const metrics = game.shot?.metrics || shotMetrics();
  const movePhase = game.move ? `${game.move.kind} ${Math.round((game.move.t / game.move.duration) * 100)}%` : '-';
  labReadout.innerHTML = [
    ['state', game.state],
    ['move', movePhase],
    ['def', game.defenderState],
    ['hand', offense.ballHand > 0 ? 'right' : 'left'],
    ['sep', `${metrics.sep.toFixed(2)}m`],
    ['balance', metrics.balance.toFixed(2)],
    ['release', metrics.release.toFixed(2)],
    ['contest', metrics.contest.toFixed(2)],
    ['quality', metrics.quality.toFixed(2)]
  ]
    .map(([key, value]) => `<span>${key}<b>${value}</b></span>`)
    .join('');
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

  const glow = new THREE.Mesh(new THREE.CircleGeometry(3.55, 64), materials.courtGlow);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.019, -0.75);
  scene.add(glow);

  paintPlane(0, -4.04, 3.86, 3.58, materials.paintFill, 0.021);
  paintPlane(0, -5.55, 1.18, 0.58, materials.keyFill, 0.023);
  paintPlane(0, 0.48, 1.58, 1.58, materials.keyFill, 0.021);
  paintPlane(-3.86, -1.15, 0.05, 9.95, materials.neonBlue, 0.025);
  paintPlane(3.86, -1.15, 0.05, 9.95, materials.neonViolet, 0.025);

  const gritty = new THREE.GridHelper(8.2, 18, 0x464844, 0x252724);
  gritty.position.set(0, 0.018, -1.05);
  gritty.material.transparent = true;
  gritty.material.opacity = 0.18;
  scene.add(gritty);

  lineRect(-3.7, -6.5, 3.7, 3.7, materials.sideline);
  lineRect(-1.9, -5.85, 1.9, -2.2, materials.paint);
  lineArc(0, -5.85, 4.35, Math.PI * 0.1, Math.PI * 0.9, materials.paint);
  lineArc(0, -5.85, 1.25, Math.PI * 0.12, Math.PI * 0.88, materials.paint);
  lineSegment(-2.35, 3.05, 2.35, 3.05, materials.paint);

  const logo = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 0.89, 64),
    new THREE.MeshBasicMaterial({ color: 0xf7be4e, transparent: true, opacity: 0.27 })
  );
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(0, 0.024, 0.45);
  scene.add(logo);
}

function createHoop() {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.1, 16), materials.metal);
  pole.position.set(0, 1.55, -6.65);
  pole.castShadow = true;
  scene.add(pole);

  const boardTrim = new THREE.Mesh(new THREE.BoxGeometry(1.68, 1.02, 0.055), materials.boardTrim);
  boardTrim.position.set(0, 3.24, -6.38);
  scene.add(boardTrim);

  const board = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.86, 0.06), materials.boardFace);
  board.position.set(0, 3.24, -6.34);
  scene.add(board);

  addBackboardBar(0, 3.09, 0.52, 0.035);
  addBackboardBar(0, 3.42, 0.52, 0.035);
  addBackboardBar(-0.26, 3.255, 0.035, 0.33);
  addBackboardBar(0.26, 3.255, 0.035, 0.33);

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
    const strand = new THREE.Line(geo, materials.net);
    strand.userData.angle = a;
    scene.add(strand);
    netLines.push(strand);
  }
}

function addBackboardBar(x, y, width, height) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.075), materials.boardTrim);
  bar.position.set(x, y, -6.295);
  scene.add(bar);
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

function paintPlane(x, z, width, depth, material, y = 0.02) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

function createCourtTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(256, 220, 20, 256, 256, 390);
  gradient.addColorStop(0, '#304256');
  gradient.addColorStop(0.48, '#26394d');
  gradient.addColorStop(1, '#11191f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = '#f4f1e8';
  for (let x = 0; x <= 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 40, 512);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#080b0e';
  for (let y = 18; y < 512; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + 8);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 1800; i += 1) {
    const v = 120 + Math.random() * 90;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addBallSeams(targetBall) {
  const seamGeometry = new THREE.TorusGeometry(0.132, 0.004, 8, 42);
  const seamA = new THREE.Mesh(seamGeometry, materials.ballSeam);
  const seamB = new THREE.Mesh(seamGeometry, materials.ballSeam);
  const seamC = new THREE.Mesh(seamGeometry, materials.ballSeam);
  seamA.rotation.x = Math.PI / 2;
  seamB.rotation.y = Math.PI / 2;
  seamC.rotation.set(Math.PI / 2, 0.62, 0);
  targetBall.add(seamA, seamB, seamC);
}

function makeShadow(size = 0.68) {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(size, 32), materials.shadow);
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  return shadow;
}

function createLabGuides() {
  const group = new THREE.Group();
  group.visible = false;

  const plantGeometry = new THREE.RingGeometry(0.18, 0.22, 36);
  const leftPlant = new THREE.Mesh(plantGeometry, materials.labPlant);
  const rightPlant = new THREE.Mesh(plantGeometry, materials.labPlant);
  leftPlant.rotation.x = -Math.PI / 2;
  rightPlant.rotation.x = -Math.PI / 2;

  const trailLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([ball.position, ball.position]), materials.labTrail);
  group.add(leftPlant, rightPlant, trailLine);
  scene.add(group);

  return { group, leftPlant, rightPlant, trailLine, trail: [] };
}

function sphere(radius, material) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material);
}

function foot(material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 10), material);
  mesh.scale.set(1.75, 0.34, 0.78);
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
  if (len < 0.001) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  mesh.position.copy(a).addScaledVector(tmpB, 0.5);
  mesh.scale.set(radius / 0.04, len, radius / 0.04);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpB.normalize());
}

function placeBoxBetween(mesh, a, b, width, depth) {
  tmpB.copy(b).sub(a);
  const len = tmpB.length();
  if (len < 0.001) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  mesh.position.copy(a).addScaledVector(tmpB, 0.5);
  mesh.scale.set(width, len, depth);
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

function screenVectorToWorld(dx, dy, out) {
  tmpB.copy(cameraRig.lookAt).sub(cameraRig.position);
  tmpB.y = 0;
  if (tmpB.lengthSq() < 0.0001) tmpB.set(0, 0, -1);
  tmpB.normalize();
  tmpC.set(-tmpB.z, 0, tmpB.x).normalize();
  out.copy(tmpC).multiplyScalar(dx).addScaledVector(tmpB, -dy);
  out.y = 0;
  if (out.lengthSq() < 0.0001) out.set(0, 0, 0);
  else out.normalize();
  return out;
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
