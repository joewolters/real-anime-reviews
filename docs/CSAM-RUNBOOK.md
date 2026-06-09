<!-- author: Code | date: 2026-06-09 -->
# 🚨 CSAM RUNBOOK — what to do if an uploaded image looks like child sexual abuse material

> **Read this once now, calmly, so you never have to read it for the first time during an incident.**
> This file is deploy-ignored (`docs/**` in firebase.json) — it never reaches the public site.
> It exists because you are a US-based provider hosting user images: federal law
> (18 U.S.C. §2258A) makes a NCMEC report **mandatory**, and "just delete it" is
> itself mishandling. These steps keep you legal and keep the site safe.

## The 10-minute response, in order

**1. STOP uploads (one click, no deploy).**
Open `admin/reports.html` → click **🚫 Image uploads: OFF** (the kill-switch).
Every upload is now denied at the Storage-rules layer. Existing images stay up — that's next.

**2. PRESERVE — do NOT delete yet.**
The law requires you to preserve the material ~90 days for law enforcement, but
*never* leave it world-readable. Quarantine it out of the public path:
- Go to the [Firebase Console → Storage](https://console.firebase.google.com/project/real-anime-reviews/storage)
- Find the object (the report row shows its `uploads/{uid}/{docId}/{imageId}` path)
- **Download it is NOT needed and do not view it more than identification requires.**
  Use the console's **Move/Copy** (or rename) to a `quarantine/` folder —
  `quarantine/` matches NO allow rule in storage.rules, so it is instantly
  unreadable by the public while still preserved for the report.
- Note the exact original path, the uploader's UID, and the upload time (object metadata).

**3. REPORT to NCMEC (mandatory, you personally).**
- Go to **https://report.cybertip.org** (NCMEC CyberTipline) and file a report as
  an Electronic Service Provider. It asks for: your contact info, the user's
  identifiers (UID, email from Firebase Auth), timestamps, and the preserved file.
- Do this within 24 hours. Keep the CyberTipline report ID with your notes.

**4. REMOVE the public pointer.**
In the reports queue, the row's **Remove** does the atomic remove — but since you
*moved* (not copied) the object in step 2 it's already unreachable; Remove still
redacts the Firestore pointer so the post shows nothing. Either order is fine
**as long as steps 2-3 happened first**.

**5. BAN the uploader.**
Reports queue → **Ban author** (setBanState → the cascade tombstones their
backlog AND empties their `uploads/` prefix — already-quarantined material is
outside that prefix, so the preservation copy survives the ban cascade).

**6. WRITE DOWN what you did.**
A few lines in PERSONAL.md (never committed): date/time, the path, the UID, the
CyberTipline report ID, what you moved where. If law enforcement follows up,
this note is your timeline.

**7. Re-enable uploads when you're ready.**
Same kill-switch, **Turn on**. There is no rush.

## Notes, plainly
- **You are not in trouble for receiving it.** Providers aren't liable for what
  users upload; they're liable for mishandling it after they know. These steps
  ARE the correct handling.
- **Google scans GCS independently** and can suspend projects that *host* CSAM.
  Fast quarantine (step 2) is also what protects the site itself.
- **Never repost, forward, or share the material** with anyone except NCMEC —
  including "to get advice." Describing it is fine; transmitting it is not.
- If you're ever unsure whether an image qualifies: report it anyway. NCMEC
  triages; over-reporting is legal, under-reporting is not.
- Preservation duty is ~90 days from the report. After that, delete the
  quarantined object from the console.
