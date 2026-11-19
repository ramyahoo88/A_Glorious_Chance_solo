/* Route layout uses CSS pixels and the actual public label rectangles. It
   never reads campaign state. The background geography keeps its own scale. */
const MAP_OBSERVED = new Set();
let mapResizeObserver;
function refreshCampaignMaps() {
  if (!mapResizeObserver && typeof ResizeObserver !== 'undefined')
    mapResizeObserver = new ResizeObserver(entries => entries.forEach(e => layoutCampaignMap(e.target)));
  for (const stage of MAP_OBSERVED) if (!stage.isConnected) {
    mapResizeObserver?.unobserve(stage); MAP_OBSERVED.delete(stage);
  }
  for (const stage of document.querySelectorAll('.map-stage')) {
    if (!MAP_OBSERVED.has(stage)) { MAP_OBSERVED.add(stage); mapResizeObserver?.observe(stage); }
    layoutCampaignMap(stage);
  }
}
function mapRectHit(a, b) {
  return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
}
function mapPolylinePoint(points, distance) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (distance <= length) return { x: a.x + (b.x - a.x) * distance / (length || 1), y: a.y + (b.y - a.y) * distance / (length || 1) };
    distance -= length;
  }
  return points[points.length - 1];
}
function mapClosestPoint(points, p) {
  let best, distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y;
    const f = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const q = { x: a.x + f * dx, y: a.y + f * dy }, d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < distance) { best = q; distance = d; }
  }
  return { point: best, distance };
}
function mapRoutePath(from, to, obstacles, width, height, lane, occupied) {
  // Four possible entrances for each label. Repeated voyages use different
  // points along its edge, and previously used corridors carry an extra cost.
  const anchors = r => {
    const f = [.35, .65, .5][lane % 3], x = r.l + (r.r - r.l) * f, y = r.t + (r.b - r.t) * f;
    return [{ x: r.l, y, nx: -1, ny: 0 }, { x: r.r, y, nx: 1, ny: 0 },
      { x, y: r.t, nx: 0, ny: -1 }, { x, y: r.b, nx: 0, ny: 1 }];
  };
  const starts = anchors(from), ends = anchors(to), all = starts.concat(ends);
  const coords = values => [...new Set(values.filter(n => Number.isFinite(n)))].sort((a, b) => a - b);
  const xs = coords([5, width - 5, ...obstacles.flatMap(r => [r.l, r.r]), ...all.map(p => p.x)]),
    ys = coords([5, height - 5, ...obstacles.flatMap(r => [r.t, r.b]), ...all.map(p => p.y)]);
  const cols = xs.length, size = cols * ys.length, point = i => ({ x: xs[i % cols], y: ys[Math.floor(i / cols)] });
  const index = p => ys.indexOf(p.y) * cols + xs.indexOf(p.x);
  const valid = Array.from({ length: size }, (_, i) => {
    const p = point(i);
    return p.x >= 4 && p.x <= width - 4 && p.y >= 4 && p.y <= height - 4 &&
      !obstacles.some(r => p.x > r.l + .01 && p.x < r.r - .01 && p.y > r.t + .01 && p.y < r.b - .01);
  });
  const goals = new Map(ends.map(p => [index(p), p])), sources = new Map(starts.map(p => [index(p), p]));
  const distance = new Float64Array(size * 3).fill(Infinity), previous = new Int32Array(size * 3).fill(-1), heap = [];
  const push = item => {
    let i = heap.length; heap.push(item);
    while (i) { const parent = (i - 1) >> 1; if (heap[parent][0] <= item[0]) break; heap[i] = heap[parent]; i = parent; }
    heap[i] = item;
  };
  const pop = () => {
    const first = heap[0], last = heap.pop();
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1][0] < heap[child][0]) child++;
        if (heap[child][0] >= last[0]) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  for (const p of starts) { const i = index(p); if (valid[i]) { distance[i * 3] = 0; push([0, i * 3]); } }
  let finish = -1;
  while (heap.length) {
    const [cost, key] = pop(); if (cost !== distance[key]) continue;
    const i = Math.floor(key / 3), direction = key % 3, a = point(i);
    if (direction && goals.has(i)) { finish = key; break; }
    for (const [delta, nextDirection] of [[-1, 1], [1, 1], [-cols, 2], [cols, 2]]) {
      const j = i + delta;
      if (j < 0 || j >= size || !valid[j] || (nextDirection === 1 && Math.floor(i / cols) !== Math.floor(j / cols))) continue;
      const b = point(j), dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
      if (!direction) { const start = sources.get(i); if (dx !== start.nx || dy !== start.ny) continue; }
      const goal = goals.get(j); if (goal && (dx !== -goal.nx || dy !== -goal.ny)) continue;
      const segment = { l: Math.min(a.x, b.x) + .01, r: Math.max(a.x, b.x) - .01,
        t: Math.min(a.y, b.y) + .01, b: Math.max(a.y, b.y) - .01 };
      if (obstacles.some(r => nextDirection === 1 ?
        a.y > r.t + .01 && a.y < r.b - .01 && segment.l < r.r - .01 && segment.r > r.l + .01 :
        a.x > r.l + .01 && a.x < r.r - .01 && segment.t < r.b - .01 && segment.b > r.t + .01)) continue;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const shared = occupied.some(([c, d]) => nextDirection === 1 ?
        Math.abs(c.y - a.y) < 5 && Math.abs(d.y - a.y) < 5 && Math.min(c.x, d.x) < segment.r && Math.max(c.x, d.x) > segment.l :
        Math.abs(c.x - a.x) < 5 && Math.abs(d.x - a.x) < 5 && Math.min(c.y, d.y) < segment.b && Math.max(c.y, d.y) > segment.t);
      const next = j * 3 + nextDirection, total = cost + length * (shared ? 2 : 1) + (direction && direction !== nextDirection ? 18 : 0);
      if (total < distance[next]) { distance[next] = total; previous[next] = key; push([total, next]); }
    }
  }
  if (finish < 0) return null;
  const points = [];
  for (let key = finish; key >= 0; key = previous[key]) points.push(point(Math.floor(key / 3)));
  points.reverse();
  return points.filter((p, i) => !i || i === points.length - 1 ||
    (points[i - 1].x === p.x) !== (p.x === points[i + 1].x));
}
function layoutCampaignMap(stage) {
  const width = stage.clientWidth, height = stage.clientHeight;
  if (!stage.isConnected || !width || !height) return; // Also supports DOM-only tests without invented geometry.
  const base = stage.getBoundingClientRect(), rects = new Map();
  for (const node of stage.querySelectorAll('[data-place]')) {
    const r = node.getBoundingClientRect();
    rects.set(node.dataset.place, { l: r.left - base.left - stage.clientLeft, r: r.right - base.left - stage.clientLeft,
      t: r.top - base.top - stage.clientTop, b: r.bottom - base.top - stage.clientTop });
  }
  const layer = stage.querySelector('.map-routes');
  layer.setAttribute('viewBox', `0 0 ${width} ${height}`);
  layer.querySelectorAll('.map-badge-leader').forEach(n => n.remove());
  const obstacles = [...rects.values()].map(r => ({ l: r.l - 9, r: r.r + 9, t: r.t - 9, b: r.b + 9 }));
  const occupied = [], badges = [], counts = new Map();
  for (const path of layer.querySelectorAll('.map-route')) {
    const from = path.dataset.from, to = path.dataset.to, pair = [from, to].sort().join('-');
    const lane = counts.get(pair) || 0; counts.set(pair, lane + 1);
    const source = rects.get(from), destination = rects.get(to);
    const a = obstacles[[...rects.keys()].indexOf(from)], b = obstacles[[...rects.keys()].indexOf(to)];
    if (!source || !destination) continue;
    let points = mapRoutePath(a, b, obstacles, width, height, lane, occupied);
    if (!points) {
      // If labels are unusually large, allow the route closer to their edges.
      const tight = [...rects.values()].map(r => ({ l: r.l - 4, r: r.r + 4, t: r.t - 4, b: r.b + 4 }));
      points = mapRoutePath(tight[[...rects.keys()].indexOf(from)], tight[[...rects.keys()].indexOf(to)], tight, width, height, lane, occupied);
    }
    if (!points) { path.setAttribute('d', 'M0 0'); continue; }
    path.setAttribute('d', points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '));
    for (let i = 1; i < points.length; i++) occupied.push([points[i - 1], points[i]]);
    const length = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0), middle = mapPolylinePoint(points, length / 2);
    const badge = stage.querySelector(`.map-route-badge[data-move="${path.dataset.move}"]`);
    const radius = Math.max(badge.offsetWidth, badge.offsetHeight) / 2 + 3;
    const fits = p => {
      const r = { l: p.x - radius, r: p.x + radius, t: p.y - radius, b: p.y + radius };
      return r.l >= 2 && r.r <= width - 2 && r.t >= 2 && r.b <= height - 2 &&
        ![...rects.values(), ...badges].some(b => mapRectHit(r, b));
    };
    let chosen;
    for (let d = 0; d <= length / 2 && !chosen; d += 12) for (const sign of [1, -1]) {
      const p = mapPolylinePoint(points, Math.max(0, Math.min(length, length / 2 + sign * d)));
      if (fits(p)) { chosen = p; break; }
    }
    if (!chosen) {
      let best = Infinity;
      for (let y = radius + 3; y < height - radius; y += 12) for (let x = radius + 3; x < width - radius; x += 12) {
        const p = { x, y }; if (!fits(p)) continue;
        const cost = mapClosestPoint(points, p).distance * 3 + Math.hypot(x - middle.x, y - middle.y);
        if (cost < best) { chosen = p; best = cost; }
      }
    }
    chosen ||= middle;
    const nearest = mapClosestPoint(points, chosen);
    if (nearest.distance > 2) layer.appendChild(mapSvg('path', { class: 'map-badge-leader',
      d: `M${chosen.x},${chosen.y} L${nearest.point.x},${nearest.point.y}`, stroke: path.getAttribute('stroke'), 'stroke-width': 1, fill: 'none' }));
    badge.style.left = chosen.x + 'px'; badge.style.top = chosen.y + 'px';
    badges.push({ l: chosen.x - radius, r: chosen.x + radius, t: chosen.y - radius, b: chosen.y + radius });
  }
}
window.addEventListener('resize', refreshCampaignMaps);
