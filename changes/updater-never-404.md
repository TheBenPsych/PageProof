type: fix
title: Update file works even when the download page hiccups
news: The Update PageProof file now tries the download 3 times and, if the Latest build page is missing, takes the newest numbered version instead. The release build also retries when GitHub has a hiccup, so the download page is never left empty.
timeline: Updater and release build retry GitHub hiccups
feature 9: **Updater never stuck on a missing download.** Update-PageProof.cmd retries and falls back to the newest numbered version; the release build retries and puts a lost download page back.
