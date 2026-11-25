type: fix
title: Instagram no longer says "too many requests"
news: PageProof was reading Instagram posts very quickly in the background, so Instagram blocked /p/ post links for a while (HTTP ERROR 429), even in your own browser. Now all of PageProof reads at most one Instagram (or Threads) page every 30 seconds and 300 a day. If Instagram still says "too many requests" (in PageProof or in your own tabs), PageProof leaves Instagram alone for 1 hour (longer if it happens again the same day). Settings › Read account details shows when.
timeline: Instagram paced, rests after "too many requests"
feature 9: **Instagram paced.** At most one Instagram page every 30 seconds for all of PageProof; a "too many requests" answer makes that site rest 1 hour (up to 12).
