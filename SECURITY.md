# Security

PageProof is shared here on GitHub only. It is not in the Chrome Web Store, Edge Add-ons or
Firefox Add-ons, so the only real downloads are the ones on this repository's
[Releases page](https://github.com/TheBenPsych/PageProof/releases). Copies from anywhere else
are not ours.

PageProof keeps everything on your own computer (captures, finds, settings, photo lists).
Nothing is sent to us.

## Your Google Drive photos are read only

PageProof reads the photos folder you connect (Google Drive for desktop) and nothing else:

- It asks the browser for **read** access only, so the browser itself would block any change.
- It never changes, moves, renames, deletes or adds a file or folder there.
- Its own files (site lists, found-copies.txt, settings backup) go only in the
  Documents › PageProof folder you pick. It refuses a folder that is inside your photos
  folder, or holds it, and stops writing if that ever becomes true.
- To search for copies, a smaller copy of each photo is sent to Google Lens, Yandex and Bing
  (the search sites you have turned on). That copy is redrawn from the pixels, so it carries
  none of the photo's hidden data, and it is always called photo.jpg. Folder paths, client
  names and file names are never sent.

## Found a security problem?

Please don't open a public issue. Use **Security › Report a vulnerability** on this repository
(GitHub's private reporting), so it can be fixed before anyone else learns about it.
