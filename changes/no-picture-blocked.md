type: fix
title: Far fewer "Picture blocked" links
news: Most "Picture blocked" links were never blocked: Google had not loaded their small picture yet when PageProof read the page, or the picture sat beside a second link (a Facebook group, an X account). PageProof now scrolls through the whole results list so every picture loads, finds pictures next to those links, and when a search site still gives no picture it reads the page itself and checks its own pictures. Links with nothing to check now say "No picture" instead of "Picture blocked".
timeline: Far fewer "Picture blocked" links (lazy pictures, Facebook/X links, page fallback)
