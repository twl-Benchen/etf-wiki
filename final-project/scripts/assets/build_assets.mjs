// 把 3D 素材整理成網頁用的小檔案 (都是 CC0 授權)，輸出到 web/assets/。
// 用法：cd scripts/assets && npm install && node build_assets.mjs [--minis <Kenney Mini Characters 的 Models/GLB format 資料夾>]
//  1. 街道道具：KayKit City Builder Bits (從 GitHub 下載) 的車輛、紅綠燈、消防栓… → citybits.glb (設 SKIP_KAYKIT=1 略過)
//  2. Q 版人物：Kenney Mini Characters 2.0 (從 kenney.nl 下載後解壓縮) → minis.glb
import fs from 'fs';
import path from 'path';
import os from 'os';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, quantize, mergeDocuments, unpartition } from '@gltf-transform/functions';

const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../web/assets');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const KAYKIT = ['car_hatchback', 'car_sedan', 'car_stationwagon', 'car_taxi', 'car_police', 'streetlight', 'trafficlight_A', 'bench', 'bush', 'firehydrant', 'trash_A', 'watertower'];
const KK_BASE = 'https://cdn.jsdelivr.net/gh/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0@main/addons/kaykit_city_builder_bits/Assets/gltf/';

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

// Q 版人物 (Kenney Mini Characters 2.0)：選休閒服的角色合併成 minis.glb，動作只保留第一個角色的 (骨架都一樣)
const MINIS = ['character-male-a', 'character-male-b', 'character-male-c', 'character-male-d', 'character-male-e', 'character-male-f', 'character-male-g',
  'character-female-a', 'character-female-b', 'character-female-c', 'character-female-d', 'character-female-e', 'character-female-f', 'character-worker'];
const MINI_ANIMS = ['idle', 'walk', 'sprint', 'jump', 'fall', 'sit', 'interact-right', 'emote-yes', 'emote-no', 'holding-both', 'pick-up'];
async function minis(dir) {
  let target = null;
  for (const name of MINIS) {
    const doc = await io.read(path.join(dir, name + '.glb'));
    for (const a of doc.getRoot().listAnimations()) if (target || !MINI_ANIMS.includes(a.getName())) {
      for (const ch of a.listChannels()) ch.dispose();
      for (const smp of a.listSamplers()) { const i = smp.getInput(), o = smp.getOutput(); smp.dispose(); for (const x of [i, o]) if (x && x.listParents().length <= 1) x.dispose(); }
      a.dispose();
    }
    const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0], wrap = doc.createNode('M_' + name);   // 外層節點加前綴，避免和場景或原本的節點撞名
    for (const n of scene.listChildren()) { scene.removeChild(n); wrap.addChild(n); }
    scene.addChild(wrap);
    if (!target) target = doc; else mergeDocuments(target, doc);
  }
  const root = target.getRoot(), main = root.listScenes()[0];
  for (const s of root.listScenes().slice(1)) { for (const n of s.listChildren()) { s.removeChild(n); main.addChild(n); } s.dispose(); }
  root.setDefaultScene(main); main.setName('minis');
  await target.transform(unpartition(), dedup(), prune({ keepLeaves: true }), resample(), prune({ keepLeaves: true }), quantize());
  await io.write(path.join(OUT, 'minis.glb'), target);
}

fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2), mi = args.indexOf('--minis');
if (mi >= 0) await minis(args[mi + 1]); else console.log('沒有給 --minis，略過人物');
if (!process.env.SKIP_KAYKIT) await citybits();
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.glb')) console.log(f, fs.statSync(path.join(OUT, f)).size, 'bytes');
