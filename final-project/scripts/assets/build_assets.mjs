// 把 3D 素材整理成網頁用的小檔案 (都是 CC0 授權)，輸出到 web/assets/。
// 用法：cd scripts/assets && npm install && node build_assets.mjs [--people <prep_characters.py 的輸出資料夾>] [UAL1_Standard.glb 的路徑]
//  1. 人物：Quaternius Universal Animation Library 的模特兒模型，只保留遊戲用到的動作 → mannequin.glb
//  2. 街道道具：KayKit City Builder Bits (從 GitHub 下載) 的車輛、路燈、水塔… → citybits.glb
import fs from 'fs';
import path from 'path';
import os from 'os';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, quantize, mergeDocuments, unpartition } from '@gltf-transform/functions';

const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../web/assets');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const KEEP = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Idle_Talking_Loop', 'Interact', 'Sitting_Idle_Loop', 'Dance_Loop', 'Walk_Formal_Loop'];
const FINGER = /^(index|middle|pinky|ring|thumb)_/;
const KAYKIT = ['car_hatchback', 'car_sedan', 'car_stationwagon', 'car_taxi', 'car_police', 'streetlight', 'trafficlight_A', 'bench', 'bush', 'firehydrant', 'trash_A', 'watertower'];
const KK_BASE = 'https://cdn.jsdelivr.net/gh/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0@main/addons/kaykit_city_builder_bits/Assets/gltf/';

async function mannequin(src) {
  const doc = await io.read(src);
  const drop = smp => { if (!smp) return; const i = smp.getInput(), o = smp.getOutput(); smp.dispose(); for (const x of [i, o]) if (x && x.listParents().length <= 1) x.dispose(); };
  for (const a of doc.getRoot().listAnimations()) {
    if (!KEEP.includes(a.getName())) { for (const ch of a.listChannels()) ch.dispose(); for (const smp of a.listSamplers()) drop(smp); a.dispose(); continue; }
    // 手指的動作在遊戲裡看不太出來，拿掉可以省下不少檔案大小
    for (const ch of a.listChannels()) { const n = ch.getTargetNode(); if (n && FINGER.test(n.getName())) { const smp = ch.getSampler(); ch.dispose(); drop(smp); } }
  }
  await doc.transform(resample(), prune({ keepLeaves: true }), dedup(), quantize(), prune({ keepLeaves: true }));
  await io.write(path.join(OUT, 'mannequin.glb'), doc);
}

async function download(url, file) {
  const r = await fetch(url); if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

async function citybits() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kaykit-'));
  await download(KK_BASE + 'citybits_texture.png', path.join(tmp, 'citybits_texture.png'));
  let target = null;
  for (const name of KAYKIT) {
    for (const ext of ['gltf', 'bin']) await download(KK_BASE + `${name}.${ext}`, path.join(tmp, `${name}.${ext}`));
    const doc = await io.read(path.join(tmp, `${name}.gltf`));
    // 每個模型包成一個以名稱命名的節點
    const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
    const wrap = doc.createNode(name);
    for (const n of scene.listChildren()) { scene.removeChild(n); wrap.addChild(n); }
    scene.addChild(wrap);
    if (!target) target = doc; else mergeDocuments(target, doc);
  }
  const root = target.getRoot(), main = root.listScenes()[0];
  for (const s of root.listScenes().slice(1)) { for (const n of s.listChildren()) { s.removeChild(n); main.addChild(n); } s.dispose(); }
  root.setDefaultScene(main);
  await target.transform(unpartition(), dedup(), prune(), quantize());
  await io.write(path.join(OUT, 'citybits.glb'), target);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// 3. 真人外觀的角色 (Quaternius Universal Base Characters)：先用 prep_characters.py 整理，再合併成 people.glb
async function people(dir) {
  const parts = { male: 'Superhero_Male_FullBody', female: 'Superhero_Female_FullBody', hair_short: 'Hair_SimpleParted', hair_long: 'Hair_Long' };
  let target = null;
  for (const [key, file] of Object.entries(parts)) {
    const doc = await io.read(path.join(dir, file + '.gltf'));
    const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0], wrap = doc.createNode(key);
    for (const n of scene.listChildren()) { scene.removeChild(n); wrap.addChild(n); }
    scene.addChild(wrap);
    if (!target) target = doc; else mergeDocuments(target, doc);
  }
  const root = target.getRoot(), main = root.listScenes()[0];
  for (const s of root.listScenes().slice(1)) { for (const n of s.listChildren()) { s.removeChild(n); main.addChild(n); } s.dispose(); }
  root.setDefaultScene(main);
  await target.transform(unpartition(), dedup(), prune({ keepLeaves: true }), quantize());
  await io.write(path.join(OUT, 'people.glb'), target);
}

fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2), pi = args.indexOf('--people');
if (pi >= 0) { await people(args[pi + 1]); args.splice(pi, 2); }
if (args[0]) await mannequin(args[0]); else console.log('沒有給 UAL1_Standard.glb，略過動作庫');
if (!process.env.SKIP_KAYKIT) await citybits();
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.glb')) console.log(f, fs.statSync(path.join(OUT, f)).size, 'bytes');
