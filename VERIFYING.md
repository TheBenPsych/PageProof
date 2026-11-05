# How PageProof fingerprints work, and how to check a pack

This guide is for anyone who needs to check a PageProof evidence pack: you, a colleague, a lawyer, or the other side.

> **Easiest way:** in PageProof, open **Verify a pack** (a link at the top of the capture page and the capture log) and drop the zip on it. It runs every check below and shows a green "Unchanged" or red "Warning" result. The manual steps below are for people who don't have PageProof, or who want to check independently.

## 1. What a fingerprint is

A **SHA-256 fingerprint** (also called a "hash") is a 64-character code calculated from every bit of a file. For example:

```
87bae80edab7e4fd700cbfc4b505128aabc4b5ff01c6eb7e8823595d592a2e98  images/001_photo.jpg
```

Three things make it useful as proof:

- **Same file, same code, every time.** Anyone, on any computer, with any SHA-256 tool, gets the exact same code for the same file.
- **Any change, totally different code.** Change one pixel in a photo or one letter in a PDF, and the code changes completely. There's no such thing as "almost matching."
- **You can't fake it backwards.** Nobody can edit a file so that it still produces the old code. It's the same standard banks, governments and forensic labs rely on.

A fingerprint doesn't hide or lock anything. The files open normally. It just lets you prove later that they haven't changed.

## 2. What's in each evidence pack

| File | What it is |
| --- | --- |
| `...pdf`, `...html`, `..._source.html`, `images/...` | The evidence itself |
| `fingerprints.sha256` | One line per evidence file: its fingerprint, then its name |
| `timestamps/digicert.tsr`, `sectigo.tsr`, `freetsa.tsr` | **Trusted timestamp receipts**: up to three independent services each signed the fingerprint list with their own clock |
| `timestamps/*.tsq` | The requests sent to the timestamp services (only the fingerprint, never your files) |
| `capture-details.txt` | Everything recorded about the capture, including all fingerprints in readable form |
| `README.txt` | A plain-language guide for whoever receives the pack |

## 3. How the pieces lock together

```
evidence files ──► each gets a fingerprint ──► all listed in fingerprints.sha256
                                                        │
                                   fingerprint of that list is signed by
                                   DigiCert, Sectigo and FreeTSA (separately)
                                                        │
                                                        ▼
                                          timestamps/*.tsr receipts
```

- If someone changes an **evidence file**, its fingerprint no longer matches the line in `fingerprints.sha256`.
- If someone also edits **`fingerprints.sha256`** to cover it up, the list no longer matches the timestamp receipt.
- Each **receipt** is signed by its timestamp service, so it can't be edited or forged without the check failing. With several services, the proof doesn't depend on any one company.

So to tamper without being caught, someone would have to break SHA-256 *and* forge the timestamp service's digital signature. In practice, that isn't possible.

## 4. How to check a pack (step by step)

First, **unzip** the evidence pack into a folder (Windows: right-click > Extract All. Mac: double-click).

### Check A: are the files unchanged?

**Windows** (built in, nothing to install). Open the unzipped folder, click the address bar, type `powershell` and press Enter. Then paste:

```powershell
Get-Content fingerprints.sha256 | ForEach-Object { $h,$f = $_ -split '  ',2; if ((Get-FileHash -Algorithm SHA256 $f).Hash -eq $h.ToUpper()) { "OK        $f" } else { "CHANGED!  $f" } }
```

**Mac.** Open Terminal, type `cd ` (with a space), drag the unzipped folder into the Terminal window, and press Enter. Then run:

```
shasum -a 256 -c fingerprints.sha256
```

**What you should see:** every file says `OK`.
- `CHANGED!` or `FAILED` means that file is not the original.
- A "No such file" message means a file was removed or renamed.

**To check a single file** (for example, a PDF someone emailed you):
- Windows PowerShell: `Get-FileHash -Algorithm SHA256 "C:\path\to\file.pdf"`
- Mac Terminal: `shasum -a 256 /path/to/file.pdf`

Then compare the code with that file's line in `fingerprints.sha256` or `capture-details.txt`. Capital or small letters don't matter.

### Check B: is the timestamp genuine, and when was it?

This needs OpenSSL. It's built into Mac. On Windows, it comes with [Git for Windows](https://git-scm.com/download/win), so use the "Git Bash" app.

1. Pick one receipt from the `timestamps` folder and download that service's root certificate into the unzipped folder, saved as `cacert.pem`:
   - `freetsa.tsr`: [cacert.pem](https://freetsa.org/files/cacert.pem)
   - `digicert.tsr`: "DigiCert Trusted Root G4" from [DigiCert's root certificates page](https://www.digicert.com/kb/digicert-root-certificates.htm)
   - `sectigo.tsr`: the "USERTrust RSA Certification Authority" root from sectigo.com
2. In Terminal or Git Bash, inside that folder, run (change `freetsa` to the receipt you picked):
   ```
   openssl ts -verify -in timestamps/freetsa.tsr -data fingerprints.sha256 -CAfile cacert.pem
   ```
   `Verification: OK` means the service really signed this exact fingerprint list.
3. To see the signed date and time:
   ```
   openssl ts -reply -in timestamps/freetsa.tsr -text
   ```
   Look for the `Time stamp:` line. It is in UTC.

**Check A + Check B together prove:** every file is exactly what existed at the time the independent service signed it.

### Check C (optional): was the zip itself swapped?

Each time you save a pack, PageProof records **the whole zip's fingerprint** in your capture log (Capture log > Pack SHA-256). Run the single-file check from Check A on the .zip and compare. If it matches, it's the exact zip you saved that day.

## 5. Common questions

**Opening a file changed its date. Is it ruined?** No. Fingerprints only look at the file's contents, not its dates or name. Opening, copying, emailing or renaming a file is fine. Only *editing and re-saving* changes the fingerprint.

**Can I rename the files?** Yes, but Check A looks for the original names, so keep them as they are if you can.

**Does the timestamp service keep a copy?** No. It only ever saw the fingerprint code, never your files, and it doesn't need to store anything. The receipt in your zip is the proof.

**What if a timestamp service shuts down?** Its receipt still checks out, as long as you have its root certificate. Keep a copy of the certificates with your case files. And each pack has receipts from more than one service.

**Older packs** (before version 2.0) have a single receipt named `fingerprints.sha256.tsr` in the main folder. Use that file name in the commands above.
