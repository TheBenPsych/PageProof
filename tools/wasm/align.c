// PageProof photo checker: the slow number-crunching parts of extension/align.js, in C,
// compiled to WebAssembly (a fast language every Chrome, Edge and Firefox can run).
// Every function here does EXACTLY the same sums, in the same order, as its JavaScript twin in
// align.js (doubles in between, floats when stored), so both give the same answer. align.js
// uses these when they load and its own JavaScript otherwise.
// Build: tools/wasm/build.sh (needs clang with the wasm32 target). Nothing else to install.
#include <stdint.h>
#include <wasm_simd128.h>

typedef unsigned long size_t_;
extern unsigned char __heap_base;
static size_t_ top = 0;

// ---------- memory: a simple stack; align.js resets it before each picture ----------
__attribute__((export_name("reset"))) void reset(void) { top = (size_t_)&__heap_base; }
__attribute__((export_name("alloc"))) void *alloc(size_t_ n) {
  if (!top) reset();
  size_t_ p = (top + 15) & ~(size_t_)15, end = p + n;
  size_t_ have = __builtin_wasm_memory_size(0) * 65536;
  if (end > have) {
    size_t_ pages = (end - have + 65535) / 65536;
    if (__builtin_wasm_memory_grow(0, pages) == (size_t_)-1) return 0;
  }
  top = end;
  return (void *)p;
}
__attribute__((export_name("mark"))) size_t_ mark(void) { if (!top) reset(); return top; }
__attribute__((export_name("release"))) void release(size_t_ m) { top = m; }

static inline int imin(int a, int b) { return a < b ? a : b; }
static inline int imax(int a, int b) { return a > b ? a : b; }

// ---------- box blur (radius r), run twice (align.js blur) ----------
// src w*h floats -> out w*h floats. tmp and mid: scratch, w*h floats each.
// Four rows (then four columns) are worked on side by side with SIMD. Each one gets exactly the
// same sums, in the same order, as the JavaScript loop that does one at a time.
static inline v128_t pair(const float *p, const float *q) { return wasm_f64x2_make(*p, *q); }
static inline v128_t pair2(const float *p) { return wasm_f64x2_make(p[0], p[1]); }
static void hpass(const float *src, float *tmp, int w, int h, int r) {
  const double k = 2 * r + 1; const v128_t kk = wasm_f64x2_splat(k);
  int y = 0;
  for (; y + 3 < h; y += 4) {
    const float *s0 = src + y * w, *s1 = s0 + w, *s2 = s1 + w, *s3 = s2 + w;
    float *t0 = tmp + y * w, *t1 = t0 + w, *t2 = t1 + w, *t3 = t2 + w;
    v128_t A = wasm_f64x2_splat(0), B = wasm_f64x2_splat(0);
    for (int x = -r; x <= r; x++) { const int c = imin(w - 1, imax(0, x)); A = wasm_f64x2_add(A, pair(s0 + c, s1 + c)); B = wasm_f64x2_add(B, pair(s2 + c, s3 + c)); }
    for (int x = 0; x < w; x++) {
      const v128_t qa = wasm_f64x2_div(A, kk), qb = wasm_f64x2_div(B, kk);
      t0[x] = (float)wasm_f64x2_extract_lane(qa, 0); t1[x] = (float)wasm_f64x2_extract_lane(qa, 1);
      t2[x] = (float)wasm_f64x2_extract_lane(qb, 0); t3[x] = (float)wasm_f64x2_extract_lane(qb, 1);
      const int p = imin(w - 1, x + r + 1), m = imax(0, x - r);
      A = wasm_f64x2_add(A, wasm_f64x2_sub(pair(s0 + p, s1 + p), pair(s0 + m, s1 + m)));
      B = wasm_f64x2_add(B, wasm_f64x2_sub(pair(s2 + p, s3 + p), pair(s2 + m, s3 + m)));
    }
  }
  for (; y < h; y++) {
    double acc = 0; const int row = y * w;
    for (int x = -r; x <= r; x++) acc += src[row + imin(w - 1, imax(0, x))];
    for (int x = 0; x < w; x++) {
      tmp[row + x] = (float)(acc / k);
      acc += (double)src[row + imin(w - 1, x + r + 1)] - (double)src[row + imax(0, x - r)];
    }
  }
}
static void vpass(const float *tmp, float *dst, int w, int h, int r) {
  const double k = 2 * r + 1; const v128_t kk = wasm_f64x2_splat(k);
  int x = 0;
  for (; x + 3 < w; x += 4) {
    v128_t A = wasm_f64x2_splat(0), B = wasm_f64x2_splat(0);
    for (int y = -r; y <= r; y++) { const float *p = tmp + imin(h - 1, imax(0, y)) * w + x; A = wasm_f64x2_add(A, pair2(p)); B = wasm_f64x2_add(B, pair2(p + 2)); }
    for (int y = 0; y < h; y++) {
      const v128_t qa = wasm_f64x2_div(A, kk), qb = wasm_f64x2_div(B, kk);
      float *o = dst + y * w + x;
      o[0] = (float)wasm_f64x2_extract_lane(qa, 0); o[1] = (float)wasm_f64x2_extract_lane(qa, 1);
      o[2] = (float)wasm_f64x2_extract_lane(qb, 0); o[3] = (float)wasm_f64x2_extract_lane(qb, 1);
      const float *a = tmp + imin(h - 1, y + r + 1) * w + x, *b = tmp + imax(0, y - r) * w + x;
      A = wasm_f64x2_add(A, wasm_f64x2_sub(pair2(a), pair2(b)));
      B = wasm_f64x2_add(B, wasm_f64x2_sub(pair2(a + 2), pair2(b + 2)));
    }
  }
  for (; x < w; x++) {
    double acc = 0;
    for (int y = -r; y <= r; y++) acc += tmp[imin(h - 1, imax(0, y)) * w + x];
    for (int y = 0; y < h; y++) {
      dst[y * w + x] = (float)(acc / k);
      acc += (double)tmp[imin(h - 1, y + r + 1) * w + x] - (double)tmp[imax(0, y - r) * w + x];
    }
  }
}
__attribute__((export_name("blur"))) void blur(const float *src, float *out, float *tmp, float *mid, int w, int h, int r) {
  hpass(src, tmp, w, h, r); vpass(tmp, mid, w, h, r);
  hpass(mid, tmp, w, h, r); vpass(tmp, out, w, h, r);
}

// ---------- shrink by a factor (bilinear), align.js shrink ----------
__attribute__((export_name("shrink"))) void shrink(const float *g, int iw, int ih, float *out, int w, int h) {
  const double sx = (double)iw / w, sy = (double)ih / h;
  // Where each column samples from is the same on every row: worked out once.
  const size_t_ m0 = mark();
  int *X0 = alloc(w * 4); double *TX = alloc(w * 8);
  for (int x = 0; x < w; x++) {
    double fx = (x + 0.5) * sx - 0.5; if (iw - 1.001 < fx) fx = iw - 1.001;
    int x0 = (int)__builtin_floor(fx); if (x0 < 0) x0 = 0;
    double tx = fx - x0; if (tx < 0) tx = 0;
    X0[x] = x0; TX[x] = tx;
  }
  for (int y = 0; y < h; y++) {
    double fy = (y + 0.5) * sy - 0.5; if (ih - 1.001 < fy) fy = ih - 1.001;
    int y0 = (int)__builtin_floor(fy); if (y0 < 0) y0 = 0;
    double ty = fy - y0; if (ty < 0) ty = 0;
    const float *r0 = g + y0 * iw, *r1 = r0 + iw; float *o = out + y * w;
    for (int x = 0; x < w; x++) {
      const int x0 = X0[x]; const double tx = TX[x];
      o[x] = (float)(((double)r0[x0] * (1 - tx) + (double)r0[x0 + 1] * tx) * (1 - ty) + ((double)r1[x0] * (1 - tx) + (double)r1[x0 + 1] * tx) * ty);
    }
  }
  release(m0);
}

// ---------- corner points (Shi-Tomasi), align.js corners ----------
// Writes up to max points as (x, y) int pairs to outXY and their strength to outR. Returns how many.
#define RAD 15
static void msort(int *a, int *t, int n, const float *key) {   // stable, strongest first
  if (n < 2) return;
  int m = n / 2; msort(a, t, m, key); msort(a + m, t, n - m, key);
  int i = 0, j = m, k = 0;
  while (i < m && j < n) t[k++] = key[a[j]] > key[a[i]] ? a[j++] : a[i++];
  while (i < m) t[k++] = a[i++];
  while (j < n) t[k++] = a[j++];
  for (k = 0; k < n; k++) a[k] = t[k];
}
static int pickPoints(const float *resp, int w, int h, double topR, int max, int *outXY, float *outR) {
  const int n = w * h;
  const int B = RAD + 2; const double floorR = topR * 0.005;
  int *idx = (int *)alloc(n * 4); int cnt = 0;
  for (int y = B; y < h - B; y++) for (int x = B; x < w - B; x++) {
    const int i = y * w + x; const float r = resp[i];
    if ((double)r <= floorR) continue;
    int peak = 1;
    for (int dy = -2; dy <= 2 && peak; dy++) for (int dx = -2; dx <= 2; dx++) if ((dx || dy) && resp[i + dy * w + dx] > r) { peak = 0; break; }
    if (peak) idx[cnt++] = i;
  }
  int *t = (int *)alloc(cnt * 4 + 4);
  msort(idx, t, cnt, resp);
  const int cell = 20, cols = (w + cell - 1) / cell, rows = (h + cell - 1) / cell;
  unsigned char *used = alloc(cols * rows + 1);
  for (int i = 0; i < cols * rows; i++) used[i] = 0;
  int out = 0;
  for (int q = 0; q < cnt; q++) {
    const int i = idx[q], x = i % w, y = i / w, k = (y / cell) * cols + x / cell;
    if (used[k] >= 3) continue;
    used[k]++; outXY[out * 2] = x; outXY[out * 2 + 1] = y; outR[out] = resp[i]; out++;
    if (out >= max) break;
  }
  return out;
}
__attribute__((export_name("corners"))) int corners(const float *g, int w, int h, int max, int *outXY, float *outR) {
  const size_t_ m0 = mark();
  const int n = w * h;
  float *xx = alloc(n * 4), *yy = alloc(n * 4), *xy = alloc(n * 4);
  float *tmp = alloc(n * 4), *mid = alloc(n * 4);
  float *sxx = alloc(n * 4), *syy = alloc(n * 4), *sxy = alloc(n * 4), *resp = alloc(n * 4);
  for (int i = 0; i < n; i++) { xx[i] = 0; yy[i] = 0; xy[i] = 0; }
  for (int y = 1; y < h - 1; y++) for (int x = 1; x < w - 1; x++) {
    const int i = y * w + x;
    const double gx = ((double)g[i + 1] - (double)g[i - 1]) / 2, gy = ((double)g[i + w] - (double)g[i - w]) / 2;
    xx[i] = (float)(gx * gx); yy[i] = (float)(gy * gy); xy[i] = (float)(gx * gy);
  }
  blur(xx, sxx, tmp, mid, w, h, 2); blur(yy, syy, tmp, mid, w, h, 2); blur(xy, sxy, tmp, mid, w, h, 2);
  double topR = 0;
  for (int i = 0; i < n; i++) {
    const double a = sxx[i], c = syy[i], b = sxy[i];
    const double hd = (a - c) / 2;
    const double r = (a + c) / 2 - __builtin_sqrt(hd * hd + b * b);
    resp[i] = (float)r; if (r > topR) topR = r;
  }
  const int out = pickPoints(resp, w, h, topR, max, outXY, outR);
  release(m0);
  return out;
}

// The strongest corner points, spread out (at most 3 per 20 x 20 square). Also used on the
// corner strengths worked out by the graphics card (topR < 0: find the strongest here).
__attribute__((export_name("pick"))) int pick(const float *resp, int w, int h, double topR, int max, int *outXY, float *outR) {
  const size_t_ m0 = mark();
  if (topR < 0) { topR = 0; for (int i = 0; i < w * h; i++) if (resp[i] > topR) topR = resp[i]; }
  const int out = pickPoints(resp, w, h, topR, max, outXY, outR);
  release(m0);
  return out;
}


// ---------- fingerprints (BRIEF, 256 bits), align.js describe ----------
__attribute__((export_name("describe"))) void describe(const float *g, int w, const int *xy, int n, const signed char *pairs, uint32_t *d) {
  for (int k = 0; k < n; k++) {
    const int c = xy[k * 2 + 1] * w + xy[k * 2];
    uint32_t *o = d + k * 8;
    for (int j = 0; j < 8; j++) o[j] = 0;
    for (int i = 0; i < 256; i++) {
      const float a = g[c + pairs[i * 4 + 1] * w + pairs[i * 4]], b = g[c + pairs[i * 4 + 3] * w + pairs[i * 4 + 2]];
      if (a < b) o[i >> 5] |= 1u << (i & 31);
    }
  }
}

// ---------- pairing up fingerprints, align.js match ----------
// For each fingerprint j in B (j0 <= j < j1): the closest one in A, if clearly closer than the
// second closest. outI[j] = its number in A or -1, outD[j] = the distance.
__attribute__((export_name("match"))) void match(const uint64_t *A, int na, const uint64_t *Bd, int j0, int j1, int *outI, int *outD) {
  // Each distance is worked out in full, 32 bytes at a time with SIMD (no early stop): the
  // same closest and second-closest come out as the JavaScript version's early-stopping loop.
  const v128_t ones = wasm_i16x8_splat(1);
  for (int j = j0; j < j1; j++) {
    const v128_t b0 = wasm_v128_load(Bd + j * 4), b1 = wasm_v128_load(Bd + j * 4 + 2);
    int best = 999, second = 999, bi = -1;
#define DIST4(i) wasm_i32x4_dot_i16x8(wasm_u16x8_extadd_pairwise_u8x16(wasm_i8x16_add( \
      wasm_i8x16_popcnt(wasm_v128_xor(wasm_v128_load(A + (i) * 4), b0)), \
      wasm_i8x16_popcnt(wasm_v128_xor(wasm_v128_load(A + (i) * 4 + 2), b1)))), ones)
#define TAKE(dist, i) { const int d_ = (dist); if (d_ < second) { if (d_ < best) { second = best; best = d_; bi = (i); } else second = d_; } }
    int i = 0;
    // Four of your photo's fingerprints at a time; then taken one by one in order, as in JavaScript.
    for (; i + 3 < na; i += 4) {
      const v128_t d0 = DIST4(i), d1 = DIST4(i + 1), d2 = DIST4(i + 2), d3 = DIST4(i + 3);
      const v128_t s01 = wasm_i32x4_add(wasm_i32x4_shuffle(d0, d1, 0, 4, 2, 6), wasm_i32x4_shuffle(d0, d1, 1, 5, 3, 7));
      const v128_t s23 = wasm_i32x4_add(wasm_i32x4_shuffle(d2, d3, 0, 4, 2, 6), wasm_i32x4_shuffle(d2, d3, 1, 5, 3, 7));
      const v128_t t = wasm_i32x4_add(wasm_i32x4_shuffle(s01, s23, 0, 1, 4, 5), wasm_i32x4_shuffle(s01, s23, 2, 3, 6, 7));
      if (wasm_i32x4_bitmask(wasm_i32x4_lt(t, wasm_i32x4_splat(second))) == 0) continue;   // none can be closer
      TAKE(wasm_i32x4_extract_lane(t, 0), i) TAKE(wasm_i32x4_extract_lane(t, 1), i + 1)
      TAKE(wasm_i32x4_extract_lane(t, 2), i + 2) TAKE(wasm_i32x4_extract_lane(t, 3), i + 3)
    }
    for (; i < na; i++) {
      const v128_t s = DIST4(i);
      TAKE(wasm_i32x4_extract_lane(s, 0) + wasm_i32x4_extract_lane(s, 1) + wasm_i32x4_extract_lane(s, 2) + wasm_i32x4_extract_lane(s, 3), i)
    }
    outI[j] = bi >= 0 && best <= 70 && (double)best < 0.85 * (double)second ? bi : -1;
    outD[j] = best;
  }
}
