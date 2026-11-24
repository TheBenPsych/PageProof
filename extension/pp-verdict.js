// The photo checker's answer rules, shared by the search results page (revsearch.js) and the
// Checker test (Settings › How PageProof is doing), so the test gives exactly the answers a real
// search would. Nothing here downloads or reads anything.
const PP_VERDICT = {
  // A line-up result (align.js, or the photo-check worker's answer) turned into the numbers kept
  // for each found picture.
  fields(best, sv) {
    // Only logos line up, or another shot of the same place: the % shown is what lines up of the
    // photo itself (without the logos / the parts that shift), so these show low, not 50-77%.
    const other = !!(best && (best.logos || best.place) && best.photo !== null && best.photo !== undefined);
    return {
      pct: best ? Math.max(0, Math.min(100, Math.round((other ? best.photo : best.sc.lines) * 100))) : 0,
      inl: best && best.inliers || 0,                       // matching details found in both pictures
      tiles: best ? best.sc.matched : 0,                    // small squares that line up
      str: best ? +best.sc.strength.toFixed(2) : 0,         // how closely they line up
      // Share of the middle of your picture (where the subject usually is) that lines up.
      mid: best && best.sc.midTex >= 8 ? +(best.sc.midMatched / best.sc.midTex).toFixed(2) : null,
      n: best ? best.sc.inside || 0 : 0,                   // small squares compared at all (the shared area)
      // Only a repeating press wall (the same logos printed over and over) lines up.
      wall: best && best.backdrop ? 1 : 0,
      logos: best && best.logos ? 1 : 0,                    // only printed logos / lettering line up
      place: best && best.place ? 1 : 0,                    // another shot of the same place (parallax)
      sv,
    };
  },
  // The worker's answer (score-worker.js) as a line-up result for fields().
  fromWorker(w) { return w && !w.none ? { inliers: w.inliers, sc: w, backdrop: w.backdrop, logos: w.logos, place: w.place, photo: w.photo } : null; },
  // Same photo, Maybe or Different, from the numbers alone ('cant' = could not be checked).
  // See revsearch.js (baseVerdict) for how these limits were found.
  score(l) {
    if (l.pct === null || l.pct < 0) return 'cant';
    if (l.n != null && l.n < 40) return 'no';   // shared area too small to say anything
    if (!(l.tiles >= 12)) return 'no';           // too few matching squares, whatever the %
    if (l.wall) return 'no';                     // only the repeating logos behind the people line up
    if (l.logos || l.place) return 'no';         // only logos / lettering, or another shot of the same place
    if (l.mid !== null && l.mid !== undefined && l.mid < 0.35) return 'no';
    const midOk = l.mid === null || l.mid === undefined || l.mid >= 0.42;
    // Most of the shared area must line up. Copies with a big headline over them (about 55%)
    // land in Maybe, as do different shots in front of the same logo wall (about 50%).
    if (midOk && l.str >= 0.8 && ((l.pct >= 75 && l.inl >= 15 && l.tiles >= 20) || (l.pct >= 85 && l.inl >= 10))) return 'same';
    // A high % on its own means nothing: two different photos can "line up" over a tiny shared patch.
    if (l.inl >= 11 && l.tiles >= 12 && l.pct >= 40) return 'maybe';
    return 'no';
  },
};
